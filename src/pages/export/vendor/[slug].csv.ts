import type { APIRoute } from 'astro';
import { getVendors, getContractsByVendor } from '../../../lib/data';
import { contractsToCsv } from '../../../lib/csv';

export function getStaticPaths() {
  return getVendors().map((v) => ({ params: { slug: v.slug } }));
}

export const GET: APIRoute = ({ params }) => {
  return new Response(contractsToCsv(getContractsByVendor(params.slug!)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${params.slug}-ai-contracts.csv"`,
    },
  });
};
