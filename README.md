# GovAI Contracts

A free, independent index of every U.S. federal **AI / ML / data-science** contract award and open opportunity.

- **Live site:** https://govai-contracts.nandanhegde1096.workers.dev/
- **Data sources:** [USAspending.gov](https://api.usaspending.gov/) (awards) and [SAM.gov](https://sam.gov/data-services) (open opportunities) — both public domain
- **Refresh cadence:** every 6 hours via GitHub Actions cron
- **License:** MIT (code) · CC0 1.0 (dataset). See [LICENSE](./LICENSE).
- **Free downloads:** [/export/all.csv](https://govai-contracts.nandanhegde1096.workers.dev/export/all.csv) · [/export/all.json](https://govai-contracts.nandanhegde1096.workers.dev/export/all.json)

## Why

Federal AI contract intelligence is locked behind enterprise tools (Deltek GovWin, GovTribe, etc.) costing $10K–$30K/year. This site does the obvious thing the public APIs already enable: aggregate, filter, and make every AI/ML award searchable for free.

## Ask GovAI (RAG)

[`ask/`](./ask/) is a small, dependency-free RAG layer over this dataset: a **query router + BM25 retrieval** (key-free — superlative/NAICS questions answered structurally) feeds **grounded, provider-agnostic LLM synthesis** (free Gemini or paid Claude) with citations and a refuse-to-invent guardrail — backed by a **reproducible eval** (retrieval recall@8 = **92%** routed; 69% BM25 baseline). See [`ask/README.md`](./ask/README.md).

```bash
npm run ask -- "which vendors won the biggest DoD AI contracts?"   # retrieval works with no key
npm run ask:eval                                                    # the measured eval
```

## Stack

- [Astro 5](https://astro.build) — static site, file-based routing
- TypeScript
- [USAspending.gov](https://api.usaspending.gov/) public API (no auth)
- [SAM.gov](https://open.gsa.gov/api/get-opportunities-public-api/) opportunities API (free key, ~1k req/day)
- GitHub Actions scheduled cron (every 6h)
- Cloudflare Workers (free tier, static assets via `wrangler deploy`)

## Local dev

```bash
npm install
npm run scrape         # awards → src/data/contracts.json
SAM_API_KEY=xxx npm run scrape:opps   # opportunities → src/data/opportunities.json
npm run dev            # http://localhost:4321
npm run build          # production build → dist/
```

## How it works

1. `scripts/scrape.ts` queries USAspending.gov for awards in AI-relevant NAICS codes (`541511`, `541512`, `541513`, `541519`, `541715`, `518210`).
2. It then filters by AI/ML keyword presence in each award's description (so generic IT contracts are excluded).
3. `scripts/scrape-opportunities.ts` does the same for active SAM.gov solicitations (last 60 days). Skips gracefully if `SAM_API_KEY` is not set or daily quota is exhausted.
4. Deduplicated results are written to `src/data/contracts.json` and `src/data/opportunities.json`.
5. Astro builds ~1,400 static pages at build time:
   - `/` — landing + recent awards
   - `/contracts/` — searchable list (URL-state filters)
   - `/contracts/[id]/` — programmatic SEO detail page per award
   - `/agencies/`, `/agencies/[slug]/`, `/agencies/[slug]/vendors/`
   - `/vendors/`, `/vendors/[slug]/`
   - `/naics/`, `/naics/[code]/`, `/naics/[code]/vendors/`
   - `/opportunities/`, `/opportunities/[id]/`
   - `/export/all.csv`, `/export/all.json`, `/export/{agency,vendor,naics}/{slug}.csv`
   - `/alerts/`, `/claim/`, `/about/`, `/methodology/`, `/insights/`
6. GitHub Actions reruns both scrapers every 6 hours and commits the refreshed datasets.

## API quota usage (SAM.gov)

- Free public quota: **1,000 requests/day per IP**
- Per cron run: 6 NAICS × up to 10 pages = **≤ 60 requests**
- 4 runs/day = **~240 requests/day** (~24% of quota). Headroom for backfills and retries.

## Disclaimer

GovAI Contracts is an independent project and is not affiliated with, endorsed by, or connected to any U.S. government agency. Data is provided as-is for informational purposes.

