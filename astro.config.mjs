// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://govai-contract.pages.dev',
  integrations: [sitemap()],
  build: { format: 'directory' },
});
