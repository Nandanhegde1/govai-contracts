import type { APIRoute } from 'astro';
import { getVendors, getContractsByVendor } from '../../../../lib/data';

export async function getStaticPaths() {
  return getVendors().map((v) => ({ params: { slug: v.slug }, props: { vendor: v } }));
}

export const GET: APIRoute = ({ params, props }) => {
  const vendor = props.vendor;
  const contracts = getContractsByVendor(params.slug!);
  return new Response(
    JSON.stringify({ vendor, contracts }, null, 2),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
};
