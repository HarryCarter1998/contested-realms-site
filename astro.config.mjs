import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://contestedrealms.com',
  output: 'static',
  build: { format: 'directory' },
  integrations: [sitemap()],
  devToolbar: { enabled: false },
});
