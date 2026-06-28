// Measured eval for the Ask-GovAI RAG pipeline.
//  - Retrieval recall@k  → runs with NO key (this is the honest, always-on metric).
//  - Answer accuracy + latency + cost → runs only when ANTHROPIC_API_KEY is set.
//
// Run:  npm run ask:eval
//
// Note on non-circularity: the gold questions are written in natural language
// (vendor / agency / mission terms), NOT by pasting award_ids or description text,
// so retrieval recall measures real lexical generalization, not a copy-match.

import { readFileSync } from 'node:fs';
import { retrieve } from '../retrieve.ts';
import { answer, hasLLM } from '../answer.ts';

interface Gold {
  question: string;
  expectAwardIds?: string[];
  answerMustInclude?: string[];
}

const gold = JSON.parse(readFileSync(new URL('./gold.json', import.meta.url), 'utf8')) as Gold[];
const K = 8;
const hasKey = hasLLM();

// Illustrative pricing — PLACEHOLDER, verify current rates and override via env.
const PRICE_IN = Number(process.env.ASK_PRICE_IN ?? 1) / 1e6; // $/input token
const PRICE_OUT = Number(process.env.ASK_PRICE_OUT ?? 5) / 1e6; // $/output token

let retHits = 0;
let retTotal = 0;
let ansCorrect = 0;
let ansTotal = 0;
let totalMs = 0;
let totalIn = 0;
let totalOut = 0;

for (const g of gold) {
  if (g.expectAwardIds?.length) {
    retTotal++;
    const ids = new Set(retrieve(g.question, K).map((h) => h.contract.award_id));
    const hit = g.expectAwardIds.some((id) => ids.has(id));
    if (hit) retHits++;
    console.log(`${hit ? 'PASS' : 'MISS'} [retrieve] ${g.question}`);
  }

  if (hasKey && g.answerMustInclude?.length) {
    try {
      const r = await answer(g.question, K);
      totalMs += r.ms;
      if (r.usage) {
        totalIn += r.usage.input;
        totalOut += r.usage.output;
      }
      ansTotal++;
      const lc = r.text.toLowerCase();
      const ok = g.answerMustInclude.every((s) => lc.includes(s.toLowerCase()));
      if (ok) ansCorrect++;
      console.log(`${ok ? 'PASS' : 'FAIL'} [answer]   ${g.question}`);
    } catch (e) {
      console.log(`ERR  [answer]   ${g.question} — ${String(e).slice(0, 80)}`);
    }
  }
}

console.log('\n===== RESULTS =====');
console.log(`Retrieval recall@${K}: ${retHits}/${retTotal} = ${((100 * retHits) / (retTotal || 1)).toFixed(0)}%`);
if (hasKey) {
  console.log(`Answer accuracy:      ${ansCorrect}/${ansTotal} = ${((100 * ansCorrect) / (ansTotal || 1)).toFixed(0)}%`);
  const cost = totalIn * PRICE_IN + totalOut * PRICE_OUT;
  console.log(
    `Latency: avg ${(totalMs / (ansTotal || 1)).toFixed(0)}ms · tokens ${totalIn} in / ${totalOut} out · est cost $${cost.toFixed(4)} (~$${(cost / (ansTotal || 1)).toFixed(5)}/query, placeholder pricing)`,
  );
} else {
  console.log('Answer accuracy + latency + cost: SKIPPED — set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY to run the full eval.');
}
