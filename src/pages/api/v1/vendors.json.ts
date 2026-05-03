import type { APIRoute } from 'astro';
import { getVendors, getMeta } from '../../../lib/data';

export const GET: APIRoute = () => {
  const m = getMeta();
  return new Response(
    JSON.stringify({
      meta: { generated_at: m.generated_at, count: getVendors().length },
      vendors: getVendors(),
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
