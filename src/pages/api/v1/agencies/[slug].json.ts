import type { APIRoute } from 'astro';
import { getAgencies, getContractsByAgency } from '../../../../lib/data';

export async function getStaticPaths() {
  return getAgencies().map((a) => ({ params: { slug: a.slug }, props: { agency: a } }));
}

export const GET: APIRoute = ({ params, props }) => {
  const agency = props.agency;
  const contracts = getContractsByAgency(params.slug!);
  return new Response(
    JSON.stringify({ agency, contracts }, null, 2),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
};
