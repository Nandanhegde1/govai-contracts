import type { APIRoute } from 'astro';
import { getAll, getMeta } from '../lib/data';
import { formatMoney } from '../lib/types';

const SITE = 'https://govai-contracts.nandanhegde1096.workers.dev';

const esc = (s: string): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const GET: APIRoute = () => {
  const meta = getMeta();
  const items = [...getAll()]
    .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
    .slice(0, 50);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>GovAI Contracts — Latest federal AI/ML awards</title>
    <link>${SITE}/</link>
    <description>The 50 most recent U.S. federal AI/ML contract awards. Updated every 6 hours.</description>
    <language>en-us</language>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date(meta.generated_at).toUTCString()}</lastBuildDate>
${items
  .map(
    (c) => `    <item>
      <title>${esc(`${c.recipient} · ${formatMoney(c.amount)} from ${c.agency}`)}</title>
      <link>${SITE}/contracts/${encodeURIComponent(c.id)}/</link>
      <guid isPermaLink="true">${SITE}/contracts/${encodeURIComponent(c.id)}/</guid>
      <pubDate>${new Date(c.start_date).toUTCString()}</pubDate>
      <description>${esc(c.description.slice(0, 500))}</description>
      <category>${esc(c.agency)}</category>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
