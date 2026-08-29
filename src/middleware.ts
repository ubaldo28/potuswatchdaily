import { defineMiddleware } from 'astro:middleware';

const CANONICAL_HOST = 'www.potuswatchdaily.com';

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
  const url = ctx.url;

  // ── Canonical host ────────────────────────────────────────────────────────
  // public/_redirects cannot do host-level rules on Cloudflare Pages: it matches
  // PATHS only, so `https://potuswatchdaily.com/*` was parsed as a literal path
  // beginning "/https:/". The apex therefore served 200s, doubling crawl cost on
  // every URL. A 301 is a directive where a canonical tag is only a hint.
  // Read the Host header rather than url.hostname: Astro builds Astro.url from
  // the configured `site` on some adapters, which would make the hostname always
  // read as the canonical one and this check never fire.
  //
  // Guarded because prerendered pages are rendered at BUILD time, where there is
  // no request and touching headers logs a warning for every static route.
  let requestHost = '';
  if (!(ctx as any).isPrerendered) {
    try {
      requestHost = (ctx.request.headers.get('host') || url.hostname || '').split(':')[0].toLowerCase();
    } catch {
      requestHost = (url.hostname || '').toLowerCase();
    }
  }

  if (requestHost && requestHost !== CANONICAL_HOST && requestHost.endsWith('potuswatchdaily.com')) {
    return new Response(null, {
      status: 301,
      headers: {
        Location: `https://${CANONICAL_HOST}${url.pathname}${url.search}`,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400'
      }
    });
  }

  // Caching is handled by Cloudflare's real edge cache, enabled by the Cache
  // Rule in scripts/setup-cache-rule.mjs. An earlier version wrote to
  // caches.default from here, which worked but is per-datacenter and therefore
  // cannot be purged globally — a correction to a published article would have
  // stayed stale in every PoP that had already cached it. The edge cache is
  // purgeable by API, which is what worker/generator.js calls on publish.
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
    const rule = CACHE_RULES.find(([re]) => re.test(url.pathname));
    if (rule) res.headers.set('Cache-Control', rule[1]);
  }

  return res;
});
