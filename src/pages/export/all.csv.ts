import type { APIRoute } from 'astro';
import { getAll } from '../../lib/data';
import { contractsToCsv } from '../../lib/csv';

export const GET: APIRoute = () => {
  return new Response(contractsToCsv(getAll()), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="govai-contracts-all.csv"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
