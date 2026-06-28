// Grounded answer synthesis: retrieve the relevant contracts, then ask Claude to
// answer ONLY from those records, with citations and a refuse-to-invent guardrail.
// Raw fetch (no SDK) to keep the dependency surface at zero.

import { retrieve, type Hit } from './retrieve.ts';

const MODEL = process.env.ASK_MODEL ?? 'claude-haiku-4-5-20251001'; // cheap/fast tier for high-volume synthesis; override with ASK_MODEL
const API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

const SYSTEM = `You answer questions about U.S. federal AI/ML contract awards using ONLY the contract records provided in the user's message. Rules:
- Cite the award_id in square brackets for every fact you state, e.g. [W911QX20C0023].
- If the provided records do not contain the answer, reply exactly: "I don't have that in the indexed dataset." Never use outside knowledge or guess.
- Be concise and specific — name vendors, agencies, and dollar amounts.`;

function formatContext(hits: Hit[]): string {
  return hits
    .map((h) => {
      const c = h.contract;
      const sub = c.sub_agency ? ` / ${c.sub_agency}` : '';
      return `[${c.award_id}] ${c.recipient} — ${c.agency}${sub} — $${Math.round(c.amount).toLocaleString('en-US')} — ${c.start_date ?? '?'}→${c.end_date ?? '?'} — NAICS ${c.naics_code ?? '?'} (${c.naics_desc ?? ''}) — ${c.description}`;
    })
    .join('\n');
}

export interface AnswerResult {
  text: string;
  hits: Hit[];
  usage?: { input: number; output: number };
  ms: number;
}

export async function answer(query: string, k = 8): Promise<AnswerResult> {
  const hits = retrieve(query, k);
  if (!API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Retrieval works without it; answer synthesis needs a key.',
    );
  }

  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM,
      messages: [
        { role: 'user', content: `Contracts:\n${formatContext(hits)}\n\nQuestion: ${query}` },
      ],
    }),
  });
  const ms = Date.now() - t0;

  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens: number; output_tokens: number };
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  return {
    text,
    hits,
    usage: data.usage ? { input: data.usage.input_tokens, output: data.usage.output_tokens } : undefined,
    ms,
  };
}
