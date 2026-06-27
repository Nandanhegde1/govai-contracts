/**
 * Scraper: federal AI/ML/data contracts from USAspending.gov.
 * Pulls awards for the last N months across AI-related NAICS codes
 * AND filters titles/descriptions by AI keyword set.
 * Writes deduplicated JSON to src/data/contracts.json.
 *
 * No API key required. Public endpoint.
 * Docs: https://api.usaspending.gov/
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'src', 'data', 'contracts.json');

const API = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';

// AI/ML/data-related NAICS codes
const NAICS_CODES = [
  '541511', // custom computer programming services
  '541512', // computer systems design services
  '541513', // computer facilities management services
  '541519', // other computer related services
  '541715', // R&D in physical/engineering/life sciences
  '518210', // computing infrastructure / data processing / hosting
];

// Keywords that strongly indicate AI/ML scope
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

// Look back window. Federal fiscal year starts Oct 1.
const START_DATE = '2023-10-01';
const END_DATE = new Date().toISOString().slice(0, 10);

// Award type codes: A=BPA Call, B=Purchase Order, C=Delivery Order, D=Definitive Contract
const AWARD_TYPES = ['A', 'B', 'C', 'D'];

const FIELDS = [
  'Award ID',
  'Recipient Name',
  'Award Amount',
  'Awarding Agency',
  'Awarding Sub Agency',
  'Description',
  'Start Date',
  'End Date',
  'NAICS',
  'PSC',
  'Place of Performance State Code',
  'recipient_id',
];

interface Raw {
  internal_id: number;
  generated_internal_id?: string;
  ['Award ID']: string;
  ['Recipient Name']: string;
  ['Award Amount']: number;
  ['Awarding Agency']: string;
  ['Awarding Sub Agency']: string;
  Description: string;
  ['Start Date']: string;
  ['End Date']: string;
  NAICS?: { code: string; description: string };
  PSC?: { code: string; description: string };
  ['Place of Performance State Code']?: string;
  recipient_id?: string;
  agency_slug?: string;
}

export interface Contract {
  id: string;
  award_id: string;
  recipient: string;
  recipient_slug: string;
  amount: number;
  agency: string;
  agency_slug: string;
  sub_agency: string;
  description: string;
  start_date: string;
  end_date: string;
  naics_code?: string;
  naics_desc?: string;
  psc_code?: string;
  psc_desc?: string;
  pop_state?: string;
  matched_keywords: string[];
}

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

async function fetchPage(
  keyword: string,
  page: number,
  limit = 100
): Promise<{ results: Raw[]; hasNext: boolean }> {
  const body = {
    filters: {
      award_type_codes: AWARD_TYPES,
      time_period: [{ start_date: START_DATE, end_date: END_DATE }],
      naics_codes: NAICS_CODES,
      keywords: [keyword],
    },
    fields: FIELDS,
    page,
    limit,
    sort: 'Award Amount',
    order: 'desc',
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        results: Raw[];
        page_metadata: { hasNext: boolean };
      };
      return { results: data.results ?? [], hasNext: data.page_metadata?.hasNext ?? false };
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return { results: [], hasNext: false };
}

function matchKeywords(description: string): string[] {
  const desc = ` ${description.toLowerCase()} `;
  return AI_KEYWORDS.filter((kw) => desc.includes(kw)).map((kw) => kw.trim());
}

function normalize(raw: Raw): Contract | null {
  const desc = raw.Description ?? '';
  const matched = matchKeywords(desc);
  // Skip if no AI keyword in description (NAICS alone is too broad)
  if (matched.length === 0) return null;
  // Skip absurdly tiny entries
  if (!raw['Award Amount'] || raw['Award Amount'] < 1000) return null;

  return {
    id: raw.generated_internal_id ?? String(raw.internal_id),
    award_id: raw['Award ID'],
    recipient: raw['Recipient Name'],
    recipient_slug: slugify(raw['Recipient Name']),
    amount: raw['Award Amount'],
    agency: raw['Awarding Agency'],
    agency_slug: raw.agency_slug ?? slugify(raw['Awarding Agency']),
    sub_agency: raw['Awarding Sub Agency'],
    description: desc,
    start_date: raw['Start Date'],
    end_date: raw['End Date'],
    naics_code: raw.NAICS?.code,
    naics_desc: raw.NAICS?.description,
    psc_code: raw.PSC?.code,
    psc_desc: raw.PSC?.description,
    pop_state: raw['Place of Performance State Code'],
    matched_keywords: matched,
  };
}

async function main(): Promise<void> {
  console.log(`[scrape] window: ${START_DATE} → ${END_DATE}`);
  // Use multiple keyword queries to widen recall (USAspending OR's words within a keyword
  // string but treats list as OR across entries).
  const queries = ['artificial intelligence', 'machine learning', 'large language model'];

  const seen = new Map<string, Contract>();

  for (const q of queries) {
    console.log(`[scrape] query="${q}"`);
    let page = 1;
    const MAX_PAGES = 20; // 20 * 100 = 2000 per query, plenty
    while (page <= MAX_PAGES) {
      const { results, hasNext } = await fetchPage(q, page, 100);
      console.log(`  page ${page}: ${results.length} raw`);
      let added = 0;
      for (const r of results) {
        const c = normalize(r);
        if (!c) continue;
        if (!seen.has(c.id)) {
          seen.set(c.id, c);
          added++;
        }
      }
      console.log(`  page ${page}: +${added} kept (total ${seen.size})`);
      if (!hasNext || results.length === 0) break;
      page++;
      await new Promise((r) => setTimeout(r, 400)); // be polite
    }
  }

  const all = [...seen.values()].sort((a, b) => b.amount - a.amount);
  console.log(`[scrape] DONE. ${all.length} contracts kept.`);

  // Sanity gate: never overwrite a healthy dataset with an empty or drastically
  // smaller result (e.g. an API outage or a transient zero-result fetch).
  if (all.length === 0) {
    console.error('[scrape] ABORT: 0 contracts fetched — keeping existing data.');
    process.exit(1);
  }
  if (existsSync(OUT_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
      const prevCount = Array.isArray(prev?.contracts) ? prev.contracts.length : 0;
      if (prevCount > 0 && all.length < prevCount * 0.5) {
        console.error(
          `[scrape] ABORT: new count ${all.length} < 50% of existing ${prevCount} — likely a bad fetch. Keeping existing data.`,
        );
        process.exit(1);
      }
    } catch {
      // existing file unreadable/corrupt — fall through and write fresh data
    }
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  const payload = {
    generated_at: new Date().toISOString(),
    count: all.length,
    window: { start: START_DATE, end: END_DATE },
    contracts: all,
  };
  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[scrape] wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
