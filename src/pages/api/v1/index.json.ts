import type { APIRoute } from 'astro';
import { getMeta, getOpportunityMeta } from '../../../lib/data';

const BASE = 'https://govai-contracts.nandanhegde1096.workers.dev';

export const GET: APIRoute = () => {
  const m = getMeta();
  const om = getOpportunityMeta();
  return new Response(
    JSON.stringify(
      {
        name: 'GovAI Contracts API',
        version: 'v1',
        license: 'CC0 1.0 Universal (data) — sourced from USAspending.gov + SAM.gov',
        docs: `${BASE}/api/`,
        rate_limit: 'none — static JSON files cached by Cloudflare',
        contracts: {
          count: m.count,
          generated_at: m.generated_at,
          window: m.window,
          all: `${BASE}/api/v1/contracts.json`,
          by_id: `${BASE}/api/v1/contracts/{id}.json`,
        },
        vendors: {
          all: `${BASE}/api/v1/vendors.json`,
          by_slug: `${BASE}/api/v1/vendors/{slug}.json`,
        },
        agencies: {
          all: `${BASE}/api/v1/agencies.json`,
          by_slug: `${BASE}/api/v1/agencies/{slug}.json`,
        },
        opportunities: {
          count: om.count,
          generated_at: om.generated_at,
          all: `${BASE}/api/v1/opportunities.json`,
        },
      },
      null,
      2
    ),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
};
