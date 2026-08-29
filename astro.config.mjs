import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true }
  }),
  site: 'https://www.potuswatchdaily.com',
  build: { inlineStylesheets: 'always' },
});
