# GovAI Contracts

A free, independent index of every U.S. federal **AI / ML / data-science** contract award.

- **Live site:** https://govai-contract.pages.dev (after deploy)
- **Data source:** [USAspending.gov](https://api.usaspending.gov/) (public domain)
- **Refresh cadence:** weekly via GitHub Actions

## Why

Federal AI contract intelligence is locked behind enterprise tools (Deltek GovWin, GovTribe, etc.) costing $10K–$30K/year. This site does the obvious thing the public APIs already enable: aggregate, filter, and make every AI/ML award searchable for free.

## Stack

- [Astro 5](https://astro.build) — static site
- TypeScript
- USAspending.gov public API (no auth required)
- GitHub Actions weekly cron
- Cloudflare Pages (free hosting)

## Local dev

```bash
npm install
npm run scrape    # pulls latest contracts → src/data/contracts.json
npm run dev       # http://localhost:4321
npm run build     # production build → dist/
```

## How it works

1. `scripts/scrape.ts` queries USAspending.gov for awards in AI-relevant NAICS codes (`541511`, `541512`, `541513`, `541519`, `541715`, `518210`).
2. It then filters by AI/ML keyword presence in each award's description (so generic IT contracts are excluded).
3. Deduplicated results are written to `src/data/contracts.json`.
4. Astro builds static pages at build time:
   - `/` — landing + recent awards
   - `/contracts/` — searchable list (URL-state filters)
   - `/contracts/[id]/` — programmatic SEO detail page per contract
   - `/agencies/` and `/agencies/[slug]/`
   - `/vendors/` and `/vendors/[slug]/`
5. GitHub Actions reruns the scraper every Sunday and commits the refreshed dataset.

## Disclaimer

GovAI Contracts is an independent project and is not affiliated with, endorsed by, or connected to any U.S. government agency. Data is provided as-is for informational purposes.

