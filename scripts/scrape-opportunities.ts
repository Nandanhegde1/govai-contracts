/**
 * Scraper: open federal AI/ML opportunities from SAM.gov.
 * Pre-award (RFPs, sources sought, etc.) — the high-value pre-decision intel.
 *
 * Requires SAM.gov API key (free at https://sam.gov/data-services).
 * Set env var SAM_API_KEY. If missing, this script no-ops gracefully so the
 * site still builds and the awards dataset still refreshes.
 *
 * Docs: https://open.gsa.gov/api/get-opportunities-public-api/
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'data', 'opportunities.json');

const API = 'https://api.sam.gov/opportunities/v2/search';

const NAICS_CODES = [
  '541511',
  '541512',
  '541513',
  '541519',
  '541715',
  '518210',
];

const AI_KEYWORDS = [
  'artificial intelligence',
  'machine learning',
  'deep learning',
  'large language model',
  'generative ai',
  'natural language processing',
  ' ai ',
  ' ml ',
  ' llm ',
  'mlops',
  'computer vision',
  'predictive analytics',
  'neural network',
];

interface Raw {
  noticeId: string;
  title: string;
  solicitationNumber?: string;
  fullParentPathName?: string;
  fullParentPathCode?: string;
  postedDate: string;
  type?: string;
  baseType?: string;
  archiveDate?: string;
  responseDeadLine?: string;
  naicsCode?: string;
  classificationCode?: string;
  active?: string;
  description?: string;
  uiLink?: string;
  organizationType?: string;
  officeAddress?: { city?: string; state?: string };
  placeOfPerformance?: { city?: { name?: string }; state?: { code?: string; name?: string } };
  pointOfContact?: Array<{ fullName?: string; email?: string; title?: string }>;
}

export interface Opportunity {
  id: string;
  title: string;
  solicitation_number?: string;
  agency_path: string;
  agency_top: string;
  agency_top_slug: string;
  type: string;
  posted_date: string;
  response_deadline?: string;
  archive_date?: string;
  naics_code?: string;
  psc_code?: string;
  active: boolean;
  description: string;
  description_url?: string;
  ui_link?: string;
  pop_state?: string;
  contact_email?: string;
  matched_keywords: string[];
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

function matchKeywords(text: string): string[] {
  const t = ` ${text.toLowerCase()} `;
  return AI_KEYWORDS.filter((kw) => t.includes(kw)).map((kw) => kw.trim());
}

function fmtDate(d: Date): string {
  // SAM expects MM/dd/yyyy
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
}

async function fetchPage(
  apiKey: string,
  naics: string,
  postedFrom: string,
  postedTo: string,
  offset: number,
  limit = 100
): Promise<{ raw: Raw[]; total: number }> {
  const url = new URL(API);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('postedFrom', postedFrom);
  url.searchParams.set('postedTo', postedTo);
  url.searchParams.set('ncode', naics);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString());
      if (res.status === 429 || res.status === 403) {
        const body = await res.text().catch(() => '');
        throw new Error(`THROTTLED: HTTP ${res.status} ${body.slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
      const data = (await res.json()) as { opportunitiesData?: Raw[]; totalRecords?: number };
      return { raw: data.opportunitiesData ?? [], total: data.totalRecords ?? 0 };
    } catch (err) {
      if ((err as Error).message?.startsWith('THROTTLED')) throw err; // bubble up immediately
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return { raw: [], total: 0 };
}

async function fetchDescription(apiKey: string, descUrlOrText: string): Promise<string> {
  if (!descUrlOrText) return '';
  // SAM returns the description as a URL string when not inlined
  if (!/^https?:\/\//i.test(descUrlOrText)) return descUrlOrText;
  try {
    const u = new URL(descUrlOrText);
    u.searchParams.set('api_key', apiKey);
    const res = await fetch(u.toString());
    if (res.status === 429 || res.status === 403) {
      throw new Error(`THROTTLED: HTTP ${res.status}`);
    }
    if (!res.ok) {
      const sample = await res.text().catch(() => '');
      console.warn(`[desc] HTTP ${res.status} ${u.host}${u.pathname}: ${sample.slice(0, 150)}`);
      return '';
    }
    const ct = res.headers.get('content-type') || '';
    const body = await res.text();
    if (!body) return '';
    // Path 1: JSON with { description }
    if (ct.includes('json') || body.trimStart().startsWith('{')) {
      try {
        const data = JSON.parse(body) as { description?: string };
        if (data.description) return data.description;
      } catch {
        // fall through to raw
      }
    }
    // Path 2: raw HTML/text body IS the description (SAM noticedesc returns raw HTML)
    return body;
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith('THROTTLED')) throw e;
    console.warn(`[desc] fetch error: ${msg}`);
    return '';
  }
}

function normalize(raw: Raw, fetchedDesc: string): Opportunity | null {
  const rawDesc = raw.description ?? '';
  // SAM returns description as a URL stub when not fetched separately. Don't show that.
  const isUrl = /^https?:\/\//i.test(rawDesc);
  const desc = fetchedDesc || (isUrl ? '' : rawDesc);
  // Match keywords on title + any usable description
  const blob = `${raw.title ?? ''} ${desc}`;
  const matched = matchKeywords(blob);
  if (matched.length === 0) return null;

  const path = raw.fullParentPathName ?? '';
  const top = path.split('.')[0]?.trim() || 'Unknown';

  const contact = raw.pointOfContact?.find((p) => p.email)?.email;

  // Strip HTML tags from description, collapse whitespace
  const cleanDesc = desc
    .replace(/<\/?[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);

  return {
    id: raw.noticeId,
    title: raw.title,
    solicitation_number: raw.solicitationNumber,
    agency_path: path,
    agency_top: top,
    agency_top_slug: slugify(top),
    type: raw.type ?? raw.baseType ?? 'Unknown',
    posted_date: raw.postedDate,
    response_deadline: raw.responseDeadLine,
    archive_date: raw.archiveDate,
    naics_code: raw.naicsCode,
    psc_code: raw.classificationCode,
    active: (raw.active ?? '').toLowerCase() === 'yes',
    description: cleanDesc,
    description_url: rawDesc && /^https?:\/\//i.test(rawDesc) ? rawDesc : undefined,
    ui_link: raw.uiLink,
    pop_state: raw.placeOfPerformance?.state?.code,
    contact_email: contact,
    matched_keywords: matched,
  };
}

function writeEmpty(reason: string): void {
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  const payload = {
    generated_at: new Date().toISOString(),
    count: 0,
    note: reason,
    opportunities: [] as Opportunity[],
  };
  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[sam] wrote empty dataset → ${OUT_PATH}`);
}

async function main(): Promise<void> {
  const apiKey = process.env.SAM_API_KEY;
  if (!apiKey) {
    // Never wipe a healthy published dataset just because the secret went missing
    // (e.g. an expired/renamed repo secret) — that's a config failure, not empty data.
    if (existsSync(OUT_PATH)) {
      console.error('[sam] SAM_API_KEY not set — keeping the existing opportunities dataset untouched.');
      if (process.env.CI) process.exit(1); // make the cron run red instead of silently publishing stale/no data
      return;
    }
    console.warn('[sam] SAM_API_KEY not set — seeding an empty opportunities dataset (none exists yet).');
    writeEmpty('SAM_API_KEY not configured. Get a free key at https://sam.gov/data-services and set the SAM_API_KEY env var.');
    return;
  }

  // If existing dataset shows we hit the daily quota, skip until reset (midnight UTC).
  if (existsSync(OUT_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(OUT_PATH, 'utf8')) as { generated_at?: string; note?: string };
      const sameUtcDay =
        prev.generated_at &&
        new Date(prev.generated_at).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
      const wasThrottled = prev.note?.includes('throttled') || prev.note?.includes('exceeded your quota');
      if (sameUtcDay && wasThrottled) {
        console.warn('[sam] daily quota already exhausted today. Skipping until UTC midnight reset.');
        return;
      }
    } catch {
      // ignore parse errors
    }
  }

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 60); // last 60 days of postings
  const postedFrom = fmtDate(from);
  const postedTo = fmtDate(now);
  console.log(`[sam] window: ${postedFrom} → ${postedTo}`);

  // Quota plan per run (free SAM API: 1,000 req/day per IP, ~250/run @ 4 runs/day):
  //   - List requests:        6 NAICS × ≤10 pages = ≤60
  //   - Description fetches:  capped at MAX_DESC_FETCHES (default 50)
  //   - Total per run: ≤110 req. Daily: ≤440 (well under quota + room for burst).
  // SAM also enforces a per-minute burst limit, so we sleep 1500ms between desc fetches.
  const MAX_DESC_FETCHES = 50;
  const DESC_SLEEP_MS = 1500;
  let descFetches = 0;

  // Incremental: load existing dataset and reuse cached descriptions.
  // Drop entries whose archive_date is in the past to keep the index fresh.
  const cached = new Map<string, Opportunity>();
  if (existsSync(OUT_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(OUT_PATH, 'utf8')) as { opportunities?: Opportunity[] };
      const today = now.toISOString().slice(0, 10);
      for (const o of prev.opportunities ?? []) {
        const stillActive = !o.archive_date || o.archive_date.slice(0, 10) >= today;
        if (stillActive) cached.set(o.id, o);
      }
      console.log(`[sam] loaded ${cached.size} cached opportunities (skipping their description re-fetch)`);
    } catch {
      // ignore parse errors; treat as fresh run
    }
  }

  const seen = new Map<string, Opportunity>();

  // PRIORITY PASS: backfill descriptions for cached opps that previously came back empty.
  // This guarantees we slowly fill in description gaps over multiple runs even if today's
  // listing returns mostly the same notices.
  const needsBackfill = [...cached.values()].filter(
    (o) => (!o.description || o.description.length <= 50) && o.description_url
  );
  if (needsBackfill.length > 0) {
    console.log(`[sam] backfill: ${needsBackfill.length} cached opps need descriptions (budget ${MAX_DESC_FETCHES})`);
    for (const o of needsBackfill) {
      if (descFetches >= MAX_DESC_FETCHES) break;
      try {
        const desc = await fetchDescription(apiKey, o.description_url!);
        descFetches++;
        if (desc && desc.length > 50) {
          const cleanDesc = desc
            .replace(/<\/?[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 4000);
          const updated = { ...o, description: cleanDesc };
          cached.set(o.id, updated);
          seen.set(o.id, updated);
          console.log(`  backfilled ${o.id} (${cleanDesc.length} chars)`);
        } else {
          console.warn(`  backfill empty for ${o.id} (got ${desc.length} chars)`);
        }
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.startsWith('THROTTLED')) throw e;
        console.warn(`  backfill failed for ${o.id}: ${msg}`);
      }
      await new Promise((r) => setTimeout(r, DESC_SLEEP_MS));
    }
    console.log(`[sam] backfill done. descFetches=${descFetches}/${MAX_DESC_FETCHES}`);
  }

  for (const naics of NAICS_CODES) {
    console.log(`[sam] naics=${naics}`);
    let offset = 0;
    const PAGE = 100;
    const MAX_PAGES = 10;
    for (let page = 0; page < MAX_PAGES; page++) {
      const { raw, total } = await fetchPage(apiKey, naics, postedFrom, postedTo, offset, PAGE);
      console.log(`  offset=${offset} got=${raw.length} total=${total}`);
      let added = 0;
      for (const r of raw) {
        if (!r.noticeId) continue;

        // 1) If we already have this notice cached with a usable description, reuse it.
        const prior = cached.get(r.noticeId);
        if (prior && prior.description && prior.description.length > 50) {
          if (!seen.has(prior.id)) {
            seen.set(prior.id, prior);
            added++;
          }
          continue;
        }

        // 2) Cheap path: try title-only match first (no extra API call).
        const titleMatch = matchKeywords(r.title ?? '');
        let desc = '';
        if (titleMatch.length === 0) {
          // 3) Title didn't match. Spend a description request to check the body —
          // but only up to MAX_DESC_FETCHES per run.
          if (descFetches >= MAX_DESC_FETCHES) continue;
          if (r.description && /^https?:\/\//i.test(r.description)) {
            desc = await fetchDescription(apiKey, r.description);
            descFetches++;
            await new Promise((res) => setTimeout(res, DESC_SLEEP_MS));
          } else {
            desc = r.description ?? '';
          }
        } else {
          // Title matches — still fetch description for the detail page (worth the quota).
          if (descFetches < MAX_DESC_FETCHES && r.description && /^https?:\/\//i.test(r.description)) {
            desc = await fetchDescription(apiKey, r.description);
            descFetches++;
            await new Promise((res) => setTimeout(res, DESC_SLEEP_MS));
          } else {
            desc = r.description && !/^https?:\/\//i.test(r.description) ? r.description : '';
          }
        }

        const o = normalize(r, desc);
        if (!o) continue;
        if (!seen.has(o.id)) {
          seen.set(o.id, o);
          added++;
        }
      }
      console.log(`  +${added} kept (total ${seen.size}, descFetches=${descFetches}/${MAX_DESC_FETCHES})`);
      offset += raw.length;
      if (raw.length < PAGE || offset >= total) break;
      if (descFetches >= MAX_DESC_FETCHES) {
        console.warn('  description fetch budget exhausted for this run; remaining results will be picked up next cron');
        break;
      }
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  // Carry over any still-active cached opportunities the listing didn't return this run
  // (e.g. dropped off the window). Avoids losing data between runs.
  for (const [id, o] of cached) {
    if (!seen.has(id)) seen.set(id, o);
  }

  const all = [...seen.values()].sort(
    (a, b) => new Date(b.posted_date).getTime() - new Date(a.posted_date).getTime()
  );
  console.log(`[sam] DONE. ${all.length} opportunities kept. (description fetches this run: ${descFetches})`);

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  const payload = {
    generated_at: new Date().toISOString(),
    count: all.length,
    window: { posted_from: postedFrom, posted_to: postedTo },
    opportunities: all,
  };
  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[sam] wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  const msg = (err as Error).message ?? String(err);
  const throttled = msg.startsWith('THROTTLED') || msg.includes('exceeded your quota') || msg.includes('OVER_RATE_LIMIT');

  if (throttled && existsSync(OUT_PATH)) {
    // Tag the existing dataset so we skip until UTC midnight on the next run.
    try {
      const prev = JSON.parse(readFileSync(OUT_PATH, 'utf8')) as Record<string, unknown>;
      prev.generated_at = new Date().toISOString();
      prev.note = `throttled: ${msg.slice(0, 200)}`;
      writeFileSync(OUT_PATH, JSON.stringify(prev, null, 2), 'utf8');
      console.warn('[sam] tagged dataset as throttled; will skip until UTC midnight.');
    } catch (e) {
      console.warn(`[sam] could not tag dataset: ${(e as Error).message}`);
    }
    process.exit(0);
  }

  // Don't wipe an existing dataset on a transient error (rate limits, network, etc.)
  // Only seed an empty file if none exists yet.
  if (!existsSync(OUT_PATH)) {
    writeEmpty(throttled ? `throttled: ${msg.slice(0, 200)}` : `Indexing in progress.`);
  } else {
    console.warn(`[sam] keeping existing dataset at ${OUT_PATH} (scrape failed: ${msg})`);
  }
  process.exit(0);
});
