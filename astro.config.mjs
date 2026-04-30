// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://govai-contracts.nandanhegde1096.workers.dev',
  integrations: [sitemap()],
  build: { format: 'directory' },
});
