import type { APIRoute } from 'astro';
import { getAll, getMeta } from '../../lib/data';
import { contractsToJson } from '../../lib/csv';

export const GET: APIRoute = () => {
  const m = getMeta();
  return new Response(
    contractsToJson(getAll(), {
      generated_at: m.generated_at,
      window: m.window,
      source: 'https://govai-contracts.nandanhegde1096.workers.dev/',
      license: 'Public domain (USAspending.gov)',
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="govai-contracts-all.json"',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
};
