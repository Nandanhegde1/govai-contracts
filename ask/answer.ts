// Grounded answer synthesis: retrieve the relevant contracts, then ask an LLM to
// answer ONLY from those records, with citations and a refuse-to-invent guardrail.
//
// Provider-agnostic by design — set ONE of:
//   GEMINI_API_KEY      (free: https://aistudio.google.com — no card)   [default if present]
//   ANTHROPIC_API_KEY   (pay-as-you-go: https://console.anthropic.com)
// Force one with LLM_PROVIDER=gemini|anthropic. Retrieval works with neither.
// Raw fetch, no SDKs.

import { retrieve, type Hit } from './retrieve.ts';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? '';

export type Provider = 'anthropic' | 'gemini' | 'none';

export function provider(): Provider {
  const p = (process.env.LLM_PROVIDER ?? '').toLowerCase();
  if (p === 'anthropic' || p === 'gemini') return p;
  if (GEMINI_KEY) return 'gemini'; // prefer the free tier when both/neither specified
  if (ANTHROPIC_KEY) return 'anthropic';
  return 'none';
}

export function hasLLM(): boolean {
  return provider() !== 'none';
}

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

interface LLMResponse {
  text: string;
  usage?: { input: number; output: number };
}

async function callAnthropic(user: string): Promise<LLMResponse> {
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 700, system: SYSTEM, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { input_tokens: number; output_tokens: number } };
  return {
    text: (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
    usage: data.usage ? { input: data.usage.input_tokens, output: data.usage.output_tokens } : undefined,
  };
}

async function callGemini(user: string): Promise<LLMResponse> {
  // gemini-2.0-flash is on the free tier; override with GEMINI_MODEL if names change.
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: 700, temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  const u = data.usageMetadata;
  return { text, usage: u ? { input: u.promptTokenCount ?? 0, output: u.candidatesTokenCount ?? 0 } : undefined };
}

export interface AnswerResult {
  text: string;
  hits: Hit[];
  usage?: { input: number; output: number };
  ms: number;
  provider: Provider;
}

export async function answer(query: string, k = 8): Promise<AnswerResult> {
  const hits = retrieve(query, k);
  const pv = provider();
  if (pv === 'none') {
    throw new Error('No LLM key set. Set GEMINI_API_KEY (free) or ANTHROPIC_API_KEY. Retrieval works without either.');
  }
  if (pv === 'anthropic' && !ANTHROPIC_KEY) {
    throw new Error('LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set. Set it, or unset LLM_PROVIDER to fall back to GEMINI_API_KEY.');
  }
  if (pv === 'gemini' && !GEMINI_KEY) {
    throw new Error('LLM_PROVIDER=gemini but GEMINI_API_KEY is not set. Set it (free: https://aistudio.google.com), or unset LLM_PROVIDER.');
  }
  const user = `Contracts:\n${formatContext(hits)}\n\nQuestion: ${query}`;
  const t0 = Date.now();
  const r = pv === 'anthropic' ? await callAnthropic(user) : await callGemini(user);
  return { text: r.text, hits, usage: r.usage, ms: Date.now() - t0, provider: pv };
}
