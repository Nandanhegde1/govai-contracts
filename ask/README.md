# Ask GovAI — a measured RAG over the federal AI/ML contracts

A small, dependency-free Retrieval-Augmented-Generation pipeline that answers
natural-language questions about the 670+ U.S. federal AI/ML contract awards this
project already indexes — with **citations**, a **refuse-to-invent guardrail**, and
a **measured eval**. Built to demonstrate the methodology (retrieval design +
grounding + evaluation + cost strategy), not as a production service.

## Architecture & the cost decision
```
question ──▶ query router ──▶ structured path (superlative / NAICS → filter + sort by amount)
                 │                    │
                 ▼                    ▼
          BM25 lexical retrieval ──▶ top-k contracts (structured hits first, BM25 fill)
             (key-free, offline)       │
                                    grounded LLM synthesis (Gemini/Claude) ──▶ cited answer
                                          (cite award_ids, refuse if unsupported)
```
The deliberate call: **don't pay a model to find documents a ranking function can
find.** Retrieval is BM25 over the contract text (description, vendor,
agency, NAICS, PSC, location, matched keywords) — it runs offline, for free, in
milliseconds. A thin **query router** in front of it handles what lexical ranking
*cannot* do by construction: superlative/aggregate questions ("largest contract
at the DoD") and explicit NAICS codes are answered structurally (filter + sort on
the data) and blended with BM25 fill — a general mechanism, not per-question
rules. The LLM is used only for the one thing it's uniquely good at:
synthesizing a grounded answer from the retrieved records. **Synthesis is
provider-agnostic** — point it at a free **Gemini** key or a paid **Claude** key
(`GEMINI_API_KEY` / `ANTHROPIC_API_KEY`; models via `GEMINI_MODEL` /
`ANTHROPIC_MODEL`), both cheap/fast tiers by default.

## Run
```bash
# Retrieval works with no key:
npm run ask -- "which vendors won the biggest DoD AI contracts?"

# Grounded, cited answers + the full eval need ONE key (free Gemini OR paid Claude):
GEMINI_API_KEY=...           npm run ask -- "who supports the DoD JAIC?"   # free: aistudio.google.com (no card)
ANTHROPIC_API_KEY=sk-ant-... npm run ask:eval                              # or pay-as-you-go Claude
# Free-tier 429s? The eval self-paces (~5s/call) + retries once; if they persist, let the per-minute quota reset or set GEMINI_MODEL to another free-tier model (see aistudio.google.com)
```

## Evaluation
A 14-item gold set (`eval/gold.json`) written in **natural language** — vendor /
agency / mission terms, **not** pasted award_ids or description text — so
retrieval recall measures real generalization, not a copy-match (non-circular).

| Metric | Result | Notes |
|---|---|---|
| **Retrieval recall@8 (routed)** | **92% (12/13)** | Measured, no key. Router + BM25 — the pipeline's actual entry point. |
| Retrieval recall@8 (BM25 baseline) | 69% (9/13) | The pure-lexical baseline, kept in the eval output for honesty. |
| Answer accuracy | *run with key* | substring check on `answerMustInclude`; swap for an LLM-judge next |
| Latency / cost per query | *run with key* | printed by `ask:eval` (set `ASK_PRICE_IN`/`ASK_PRICE_OUT` to current rates) |

### Measure → diagnose → fix (this is the point)
The BM25 baseline measured **69%** with 4 misses. Diagnosis, then the fix:
1. **"Largest contract" / "largest at DoD" (2 misses)** — superlative/aggregate
   queries. Lexical retrieval ranks by term overlap, not by a numeric field, so it
   *cannot* answer "largest" by construction. **Fixed** by the structured router
   (superlative → sort by `amount`, agency mention narrows the pool). Both pass now.
2. **NAICS 541715 (1 miss)** — an explicit code is a filter, not a search phrase.
   **Fixed** by the router (six-digit code → `naics_code` filter, amount-ordered).
   Passes now.
3. **R&D-prototype query (1 miss)** — corpus homogeneity: 670+ contracts that all
   say "research / development / AI / ML," so generic terms don't isolate one
   award. **The honest residual** — a structural limit of lexical retrieval that
   routing can't fix; embeddings for semantic disambiguation + entity-name
   handling (e.g. "Scale AI" the vendor vs "at scale" the phrase) are the next step.

The router is a **general mechanism** (superlative regex + NAICS/agency detection
against the dataset), not per-question rules — the gold set was frozen before it
was built, and the eval prints both numbers so the baseline stays visible.

## Roadmap (what production would add)
- **Hybrid retrieval:** BM25 + dense embeddings for the remaining semantic miss
  (the structured pre-filter for aggregate/superlative queries shipped as the router).
- **LLM-as-judge** answer scoring (faithfulness + citation-correctness) instead of
  substring matching.
- A live `/ask` endpoint (Cloudflare Worker, key as a secret) so the site itself
  demonstrates the AI.

*Honest scope: a deliberately minimal baseline to make the retrieval + grounding +
evaluation loop legible and reproducible — every number here you can re-run.*
