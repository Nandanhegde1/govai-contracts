// Freeze the current dataset as the eval corpus (eval/corpus.snapshot.json).
//
// The scrape rewrites src/data/contracts.json every 6 hours, so a gate scored
// against it measures data drift as much as code changes. The CI gate scores
// against this frozen copy instead. Refreshing it is a deliberate commit: re-run
// this, check gold.json against the new corpus, then re-measure.
//
// Run:  npm run ask:snapshot

import { readFileSync, writeFileSync } from 'node:fs';
import type { Contract } from '../retrieve.ts';

// Only the fields retrieval (retrieve.ts) and synthesis (answer.ts) read.
const FIELDS: (keyof Contract)[] = [
  'id', 'award_id', 'recipient', 'amount', 'agency', 'sub_agency', 'description',
  'start_date', 'end_date', 'naics_code', 'naics_desc', 'psc_desc', 'pop_state', 'matched_keywords',
];

const src = new URL('../../src/data/contracts.json', import.meta.url);
const out = new URL('./corpus.snapshot.json', import.meta.url);
const data = JSON.parse(readFileSync(src, 'utf8'));
const contracts = (data.contracts as Contract[]).map((c) =>
  Object.fromEntries(FIELDS.filter((f) => c[f] !== undefined).map((f) => [f, c[f]])),
);

// One contract per line keeps future snapshot refreshes readable in a diff.
const header = JSON.stringify({ generated_at: data.generated_at, window: data.window, count: contracts.length });
writeFileSync(
  out,
  `${header.slice(0, -1)},\n"contracts": [\n${contracts.map((c) => JSON.stringify(c)).join(',\n')}\n]}\n`,
);
console.log(`Wrote ${contracts.length} contracts (generated_at ${data.generated_at}) to ask/eval/corpus.snapshot.json`);
