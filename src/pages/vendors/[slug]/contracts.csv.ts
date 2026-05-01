import type { APIRoute } from 'astro';
import { getVendors, getContractsByVendor } from '../../../lib/data';
import { contractsToCsv } from '../../../lib/csv';

export function getStaticPaths() {
  return getVendors().map((v) => ({ params: { slug: v.slug } }));
}

export const GET: APIRoute = ({ params }) => {
  const contracts = getContractsByVendor(params.slug!);
  const csv = contractsToCsv(contracts);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${params.slug}-ai-contracts.csv"`,
    },
  });
};
