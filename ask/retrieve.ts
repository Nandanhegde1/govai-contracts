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

/** Classic BM25 (k1=1.5, b=0.75). Returns the top-k scoring contracts. */
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
