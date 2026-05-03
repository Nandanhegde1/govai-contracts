import type { APIRoute } from 'astro';
import { getAllOpportunities, getOpportunityMeta } from '../../../lib/data';

export const GET: APIRoute = () => {
  const m = getOpportunityMeta();
  return new Response(
    JSON.stringify({
      meta: m,
      opportunities: getAllOpportunities(),
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=1800',
      },
    }
  );
};
