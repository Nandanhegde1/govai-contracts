import type { APIRoute } from 'astro';
import { getAgencies, getMeta } from '../../../lib/data';

export const GET: APIRoute = () => {
  const m = getMeta();
  return new Response(
    JSON.stringify({
      meta: { generated_at: m.generated_at, count: getAgencies().length },
      agencies: getAgencies(),
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
