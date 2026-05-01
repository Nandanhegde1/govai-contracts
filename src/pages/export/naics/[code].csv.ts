import type { APIRoute } from 'astro';
import { getNaicsList, getContractsByNaics } from '../../../lib/data';
import { contractsToCsv } from '../../../lib/csv';

export function getStaticPaths() {
  return getNaicsList().map((n) => ({ params: { code: n.code } }));
}

export const GET: APIRoute = ({ params }) => {
  return new Response(contractsToCsv(getContractsByNaics(params.code!)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="naics-${params.code}-ai-contracts.csv"`,
    },
  });
};
