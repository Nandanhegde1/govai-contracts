import type { APIRoute } from 'astro';
import { getAgencies, getContractsByAgency } from '../../../lib/data';
import { contractsToCsv } from '../../../lib/csv';

export function getStaticPaths() {
  return getAgencies().map((a) => ({ params: { slug: a.slug } }));
}

export const GET: APIRoute = ({ params }) => {
  const contracts = getContractsByAgency(params.slug!);
  const csv = contractsToCsv(contracts);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${params.slug}-ai-contracts.csv"`,
    },
  });
};
