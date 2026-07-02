// CLI:  npm run ask -- "which vendors won the biggest DoD AI contracts?"
// Without a key it prints the retrieved contracts (retrieval is key-free).
// With GEMINI_API_KEY (free) or ANTHROPIC_API_KEY set it prints a grounded, cited answer.

import { retrieveSmart } from './retrieve.ts';
import { answer, hasLLM } from './answer.ts';

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Usage: npm run ask -- "your question about federal AI/ML contracts"');
  process.exit(1);
}

if (!hasLLM()) {
  console.log('No LLM key set — showing retrieved contracts only.');
  console.log('Set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY for a synthesized, cited answer.\n');
  const { hits, strategy } = retrieveSmart(query, 8);
  console.log(`retrieval: ${strategy}\n`);
  for (const h of hits) {
    const c = h.contract;
    console.log(
      `• [${c.award_id}] ${c.recipient} — ${c.agency} — $${Math.round(c.amount).toLocaleString('en-US')}  (score ${h.score.toFixed(2)})\n  ${c.description.slice(0, 150)}`,
    );
  }
} else {
  const r = await answer(query, 8);
  console.log(r.text);
  const tok = r.usage ? `${r.usage.input} in / ${r.usage.output} out tokens` : '';
  console.log(`\n— ${r.provider} · ${r.ms}ms · ${tok} · retrieval: ${r.retrievalStrategy}`);
}
