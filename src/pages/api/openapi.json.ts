import type { APIRoute } from 'astro';

const BASE = 'https://govai-contracts.nandanhegde1096.workers.dev';

export const GET: APIRoute = () => {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'GovAI Contracts API',
      version: '1.0.0',
      description: 'Free, public, no-auth JSON API for U.S. federal AI/ML contract data. CC0 license.',
      contact: { url: 'https://github.com/Nandanhegde1/govai-contracts/issues' },
      license: { name: 'CC0 1.0 Universal', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
    },
    servers: [{ url: BASE, description: 'Production (Cloudflare edge)' }],
    paths: {
      '/api/v1/index.json': {
        get: { summary: 'API discovery', responses: { '200': { description: 'API metadata + endpoint catalog' } } },
      },
      '/api/v1/contracts.json': {
        get: { summary: 'All contracts', responses: { '200': { description: 'All federal AI/ML contracts with metadata' } } },
      },
      '/api/v1/contracts/{id}.json': {
        get: {
          summary: 'Single contract',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Single contract by award ID' }, '404': { description: 'Not found' } },
        },
      },
      '/api/v1/vendors.json': {
        get: { summary: 'All vendors', responses: { '200': { description: 'All vendors aggregated with totals' } } },
      },
      '/api/v1/vendors/{slug}.json': {
        get: {
          summary: 'Single vendor + their contracts',
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Vendor metadata and all their awards' } },
        },
      },
      '/api/v1/agencies.json': {
        get: { summary: 'All agencies', responses: { '200': { description: 'All agencies aggregated with totals' } } },
      },
      '/api/v1/agencies/{slug}.json': {
        get: {
          summary: 'Single agency + their awards',
          parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Agency metadata and all their contracts' } },
        },
      },
      '/api/v1/opportunities.json': {
        get: { summary: 'Open SAM.gov opportunities', responses: { '200': { description: 'Active pre-award solicitations' } } },
      },
    },
  };
  return new Response(JSON.stringify(spec, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
