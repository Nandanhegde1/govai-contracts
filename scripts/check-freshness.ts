/**
 * Watchdog: fail if the LIVE site's contract data is more than 24 hours old.
 *
 * Runs daily from .github/workflows/freshness.yml, separately from the scrape
 * workflow. It reads the deployed /api/v1/index.json rather than the repo
 * copy, so it catches a broken scrape and a broken deploy (scrape green,
 * site still serving old data) alike.
 *
 * Usage: tsx scripts/check-freshness.ts [url-or-file]
 *   Defaults to the live index. Pass a local JSON file to test the check.
 */
import { readFileSync } from 'node:fs';

const LIVE_INDEX = 'https://govai-contracts.nandanhegde1096.workers.dev/api/v1/index.json';
const MAX_AGE_HOURS = 24;

interface ApiIndex {
  contracts?: { generated_at?: string };
}

async function load(src: string): Promise<ApiIndex> {
  if (!/^https?:\/\//i.test(src)) return JSON.parse(readFileSync(src, 'utf8')) as ApiIndex;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${src}`);
  return (await res.json()) as ApiIndex;
}

async function main(): Promise<void> {
  const src = process.argv[2] ?? LIVE_INDEX;
  const generatedAt = (await load(src)).contracts?.generated_at;
  const ts = generatedAt ? new Date(generatedAt).getTime() : NaN;
  if (Number.isNaN(ts)) throw new Error(`no valid contracts.generated_at in ${src}`);

  const ageHours = (Date.now() - ts) / 36e5;
  console.log(`[freshness] contracts.generated_at=${generatedAt} age=${ageHours.toFixed(1)}h (limit ${MAX_AGE_HOURS}h)`);
  if (ageHours > MAX_AGE_HOURS) {
    console.log(
      `::error::Live contracts data is ${ageHours.toFixed(1)}h old (limit ${MAX_AGE_HOURS}h). Check the Scheduled scrape runs and the Workers Builds check on the latest commit.`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.log(`::error::Freshness check could not run: ${(err as Error).message}`);
  process.exit(1);
});
