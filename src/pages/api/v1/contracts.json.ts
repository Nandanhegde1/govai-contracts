import type { APIRoute } from 'astro';
import { getAll, getMeta } from '../../../lib/data';

export const GET: APIRoute = () => {
  const m = getMeta();
  return new Response(
    JSON.stringify({
      meta: {
        generated_at: m.generated_at,
        count: m.count,
        window: m.window,
        license: 'CC0 1.0 (USAspending.gov public domain)',
      },
      contracts: getAll(),
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
};
