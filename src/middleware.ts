import { defineMiddleware } from 'astro:middleware';

// public/_headers only applies to STATIC assets on Cloudflare Pages — it never
// reaches responses produced by the Pages Function (dist/_worker.js). Every SSR
// route was therefore shipping with no Cache-Control and no security headers.
const CACHE_RULES: [RegExp, string][] = [
  // Articles are effectively immutable once published. max-age=0 keeps browsers
  // revalidating (so a correction is never stuck client-side) while the edge
  // serves the hits. stale-if-error removes the hard-failure mode when Supabase
  // hiccups — previously that surfaced as a user-facing timeout.
  [/^\/article\/[^/]+\/?$/, 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400, stale-if-error=86400'],
  [/^\/$/,                  'public, max-age=0, s-maxage=120, stale-while-revalidate=600, stale-if-error=86400'],
  [/^\/archive(\/\d+)?\/?$/,'public, max-age=0, s-maxage=600, stale-while-revalidate=3600, stale-if-error=86400'],
  [/^\/region\/[^/]+\/?$/,  'public, max-age=0, s-maxage=600, stale-while-revalidate=3600, stale-if-error=86400'],
];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const res = await next();

  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  if (res.status === 404) {
    res.headers.set('Cache-Control', 'public, max-age=0, s-maxage=300');
    res.headers.set('X-Robots-Tag', 'noindex');
    return res;
  }

  if (res.status === 200 && !res.headers.has('Cache-Control')) {
    const rule = CACHE_RULES.find(([re]) => re.test(ctx.url.pathname));
    if (rule) res.headers.set('Cache-Control', rule[1]);
  }

  return res;
});
