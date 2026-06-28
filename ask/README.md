# Ask GovAI — a measured RAG over the federal AI/ML contracts

A small, dependency-free Retrieval-Augmented-Generation pipeline that answers
natural-language questions about the 670 U.S. federal AI/ML contract awards this
project already indexes — with **citations**, a **refuse-to-invent guardrail**, and
a **measured eval**. Built to demonstrate the methodology (retrieval design +
grounding + evaluation + cost strategy), not as a production service.

## Architecture & the cost decision
```
question ──▶ BM25 lexical retrieval (key-free, offline) ──▶ top-k contracts
                                                              │
                                          grounded Claude synthesis ──▶ cited answer
                                          (cite award_ids, refuse if unsupported)
```
The deliberate call: **don't pay a model to find documents a ranking function can
find.** Retrieval is plain BM25 over the contract text (description, vendor,
agency, NAICS, PSC, location, matched keywords) — it runs offline, for free, in
milliseconds. The LLM is used only for the one thing it's uniquely good at:
synthesizing a grounded answer from the retrieved records. Synthesis defaults to a
cheap/fast tier (`claude-haiku-4-5`, override with `ASK_MODEL`).

## Run
```bash
# Retrieval works with no key:
npm run ask -- "which vendors won the biggest DoD AI contracts?"

# Grounded, cited answers + the full eval need a key:
ANTHROPIC_API_KEY=sk-ant-... npm run ask -- "who supports the DoD JAIC?"
ANTHROPIC_API_KEY=sk-ant-... npm run ask:eval
```

## Evaluation
A 14-item gold set (`eval/gold.json`) written in **natural language** — vendor /
agency / mission terms, **not** pasted award_ids or description text — so
retrieval recall measures real generalization, not a copy-match (non-circular).

| Metric | Result | Notes |
|---|---|---|
| **Retrieval recall@8** | **69% (9/13)** | Measured, no key. `k=10` gives the same — not a tuning artifact. |
| Answer accuracy | *run with key* | substring check on `answerMustInclude`; swap for an LLM-judge next |
| Latency / cost per query | *run with key* | printed by `ask:eval` (set `ASK_PRICE_IN`/`ASK_PRICE_OUT` to current rates) |

### The 4 misses — diagnosed (this is the point)
1. **"Largest contract" / "largest at DoD" (2 misses)** — superlative/aggregate
   queries. Lexical retrieval ranks by term overlap, not by a numeric field, so it
   *cannot* answer "largest" by construction. **Fix:** a structured query path
   (sort/filter on `amount`) routed to before retrieval.
2. **NAICS 541715 (1 miss)** — dozens of awards share that code, so demanding one
   *specific* award is a flawed test, not a retriever failure. **Fix:** score the
   gold item as "any 541715 award retrieved," or drop it.
3. **R&D-prototype query (1 miss)** — corpus homogeneity: 670 contracts that all
   say "research / development / AI / ML," so generic terms don't isolate one
   award. **Fix:** embeddings for semantic disambiguation + entity-name handling
   (e.g. "Scale AI" the vendor vs "at scale" the phrase).

**In-scope topical lookup** (find contracts by vendor / agency / mission — the
system's actual job) lands ~9/10. The headline 69% is reported straight,
un-massaged, because the *diagnosis* matters more than the number.

## Roadmap (what production would add)
- **Hybrid retrieval:** BM25 + dense embeddings, with a structured pre-filter
  (amount, agency, NAICS, date) for aggregate/superlative queries.
- **LLM-as-judge** answer scoring (faithfulness + citation-correctness) instead of
  substring matching.
- A live `/ask` endpoint (Cloudflare Worker, key as a secret) so the site itself
  demonstrates the AI.

*Honest scope: a deliberately minimal baseline to make the retrieval + grounding +
evaluation loop legible and reproducible — every number here you can re-run.*
