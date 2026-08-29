import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    // Article images are remote URLs rendered with plain <img>; nothing goes
    // through astro:assets. 'passthrough' keeps the adapter from provisioning
    // a Cloudflare Images binding the account does not need.
    imageService: 'passthrough'
  }),
  // No route uses sessions. Without this the adapter provisions a KV namespace
  // for the SESSION binding on every deploy.
  session: false,
  site: 'https://www.potuswatchdaily.com',
  build: { inlineStylesheets: 'always' },
});
