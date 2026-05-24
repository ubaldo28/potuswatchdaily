import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    mode: 'advanced',
    platformProxy: { enabled: true }
  }),
  site: 'https://www.potuswatchdaily.com',
});
