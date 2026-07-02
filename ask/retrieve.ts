// Lexical (BM25) retrieval over the federal AI/ML contracts dataset.
// Deliberately key-free + dependency-free: retrieval is cheap and runs offline;
// only the answer-synthesis step (answer.ts) calls an LLM. This is the cost
// strategy — don't pay a model to find documents a ranking function can find.

import { readFileSync } from 'node:fs';

export interface Contract {
  id: string;
  award_id: string;
  recipient: string;
  amount: number;
  agency: string;
  sub_agency?: string;
  description: string;
  start_date?: string;
  end_date?: string;
  naics_code?: string;
  naics_desc?: string;
  psc_desc?: string;
  pop_state?: string;
  matched_keywords?: string[];
}

const DATA_URL = new URL('../src/data/contracts.json', import.meta.url);

// Small stoplist + boilerplate that's noise across federal contract text.
const STOP = new Set(
  ('the a an and or of to for in on with by is are be this that it as at from into ' +
   'shall will contractor support services service contract award task order')
    .split(' '),
);

// Light suffix stemmer so "prototype" matches "prototypes", "algorithm" ~ "algorithms", etc.
function stem(t: string): string {
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`;
  if (t.length > 4 && t.endsWith('es')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1);
  return t;
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((t) => t.length >= 2 && !STOP.has(t))
    .map(stem);
}

function docText(c: Contract): string {
  return [
    c.description,
    c.recipient,
    c.agency,
    c.sub_agency,
    c.naics_desc,
    c.psc_desc,
    c.pop_state,
    (c.matched_keywords ?? []).join(' '),
  ]
    .filter(Boolean)
    .join(' ');
}

let _contracts: Contract[] | null = null;
let _index: { tf: Map<string, number>[]; df: Map<string, number>; len: number[]; avg: number } | null = null;

export function loadContracts(): Contract[] {
  if (_contracts) return _contracts;
  const raw = JSON.parse(readFileSync(DATA_URL, 'utf8'));
  _contracts = raw.contracts as Contract[];
  buildIndex(_contracts);
  return _contracts;
}

function buildIndex(docs: Contract[]): void {
  const tf: Map<string, number>[] = [];
  const df = new Map<string, number>();
  const len: number[] = [];
  for (const d of docs) {
    const toks = tokenize(docText(d));
    const m = new Map<string, number>();
    for (const t of toks) m.set(t, (m.get(t) ?? 0) + 1);
    for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    tf.push(m);
    len.push(toks.length);
  }
  const avg = len.reduce((a, b) => a + b, 0) / (len.length || 1);
  _index = { tf, df, len, avg };
}

export interface Hit {
  contract: Contract;
  score: number;
}

/** Classic BM25 (k1=1.5, b=0.75). Returns the top-k scoring contracts. Pure lexical baseline. */
export function retrieve(query: string, k = 8): Hit[] {
  const docs = loadContracts();
  const idx = _index!;
  const N = docs.length;
  const qTerms = [...new Set(tokenize(query))];
  const k1 = 1.5;
  const b = 0.75;

  const scored: Hit[] = docs.map((c, i) => {
    let s = 0;
    for (const t of qTerms) {
      const f = idx.tf[i].get(t);
      if (!f) continue;
      const n = idx.df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += (idf * (f * (k1 + 1))) / (f + k1 * (1 - b + (b * idx.len[i]) / idx.avg));
    }
    return { contract: c, score: s };
  });

  return scored
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// ---------------------------------------------------------------------------
// Structured query routing.
//
// BM25 ranks by term overlap, so it cannot answer superlative/aggregate
// questions ("largest contract at the DoD") by construction — the eval's
// documented failure mode. The router detects two STRUCTURED signals and,
// only then, answers them structurally against the data:
//   - a superlative ("largest", "biggest", "top", ... / "smallest") → sort by amount
//   - an explicit 6-digit NAICS code → filter by naics_code
// An agency mention narrows the pool only when one of those signals is present;
// plain topical queries (which BM25 already handles well) are untouched.
// Structured hits fill the top half of k; BM25 fills the rest, deduped.
// General mechanism — no per-question rules; see eval/gold.json + README.
// ---------------------------------------------------------------------------

const AGENCY_ALIASES: Record<string, string> = {
  dod: 'department of defense',
  doj: 'department of justice',
  hhs: 'health and human services',
  gsa: 'general services administration',
  nasa: 'aeronautics and space',
  dhs: 'homeland security',
  va: 'veterans affairs',
};

interface Filters {
  naics?: string;
  agency?: string;
  superlative: 'asc' | 'desc' | null;
}

function detectFilters(query: string, docs: Contract[]): Filters {
  const q = query.toLowerCase();
  const naics = (q.match(/\b(\d{6})\b/) ?? [])[1];
  let agency: string | undefined;
  for (const a of new Set(docs.map((d) => d.agency))) {
    if (q.includes(a.toLowerCase())) { agency = a.toLowerCase(); break; }
  }
  if (!agency) {
    for (const [alias, full] of Object.entries(AGENCY_ALIASES)) {
      if (new RegExp(`\\b${alias}\\b`).test(q)) { agency = full; break; }
    }
  }
  const superlative = /\b(largest|biggest|top|highest|most valuable|most expensive)\b/.test(q)
    ? 'desc' as const
    : /\b(smallest|lowest|cheapest)\b/.test(q)
      ? 'asc' as const
      : null;
  return { naics, agency, superlative };
}

export interface Routed {
  hits: Hit[];
  /** How the result was produced, e.g. "structured(agency~\"department of defense\", amount desc) + bm25 fill" */
  strategy: string;
}

/** Router + BM25 — the retrieval entry point the CLI, synthesis, and eval all use. */
export function retrieveSmart(query: string, k = 8): Routed {
  const docs = loadContracts();
  const { naics, agency, superlative } = detectFilters(query, docs);

  // No structured signal → pure BM25 (the common, already-working path).
  if (!naics && !superlative) return { hits: retrieve(query, k), strategy: 'bm25' };

  let pool = docs;
  const parts: string[] = [];
  if (naics) { pool = pool.filter((c) => c.naics_code === naics); parts.push(`naics=${naics}`); }
  if (agency) {
    const a = agency;
    pool = pool.filter((c) => `${c.agency} ${c.sub_agency ?? ''}`.toLowerCase().includes(a));
    parts.push(`agency~"${a}"`);
  }
  if (pool.length === 0) return { hits: retrieve(query, k), strategy: 'bm25 (structured pool empty)' };

  const dir = superlative === 'asc' ? 1 : -1;
  const structured: Hit[] = [...pool]
    .sort((a, b) => dir * (a.amount - b.amount))
    .slice(0, Math.ceil(k / 2))
    .map((c, i) => ({ contract: c, score: 100 - i }));
  parts.push(`amount ${superlative ?? 'desc'}`);

  const seen = new Set(structured.map((h) => h.contract.award_id));
  const fill = retrieve(query, k).filter((h) => !seen.has(h.contract.award_id));
  return { hits: [...structured, ...fill].slice(0, k), strategy: `structured(${parts.join(', ')}) + bm25 fill` };
}
