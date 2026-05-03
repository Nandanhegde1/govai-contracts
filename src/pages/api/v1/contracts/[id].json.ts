import type { APIRoute } from 'astro';
import { getAll, getById } from '../../../../lib/data';

export async function getStaticPaths() {
  return getAll().map((c) => ({ params: { id: c.id } }));
}

export const GET: APIRoute = ({ params }) => {
  const c = getById(params.id!);
  if (!c) {
    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify(c, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
