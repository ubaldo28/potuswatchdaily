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

// Paths worth holding in the edge cache. Deliberately narrow: no /subscribe,
// no /get-articles, nothing that varies per visitor.
const CACHEABLE = /^\/$|^\/article\/[^/]+\/?$|^\/archive(\/\d+)?\/?$|^\/region\/[^/]+\/?$/;

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
  const requestHost = (ctx.request.headers.get('host') || url.hostname || '').split(':')[0].toLowerCase();

  if (requestHost && requestHost !== CANONICAL_HOST && requestHost.endsWith('potuswatchdaily.com')) {
    return new Response(null, {
      status: 301,
      headers: {
        Location: `https://${CANONICAL_HOST}${url.pathname}${url.search}`,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400'
      }
    });
  }

  // ── Edge cache ────────────────────────────────────────────────────────────
  // Cloudflare does not cache HTML from a Pages Function on Cache-Control alone
  // — every route reported cf-cache-status: DYNAMIC. Rather than require a
  // dashboard Cache Rule, put entries in the Cache API by hand.
  const runtime: any = (ctx.locals as any)?.runtime;
  const cache: Cache | undefined = (globalThis as any).caches?.default;
  const cacheable = ctx.request.method === 'GET' && CACHEABLE.test(url.pathname);

  if (cacheable && cache) {
    try {
      const hit = await cache.match(ctx.request);
      if (hit) {
        const r = new Response(hit.body, hit);
        r.headers.set('X-Edge-Cache', 'HIT');
        return r;
      }
    } catch { /* a cache read must never take the page down */ }
  }

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

  // Store a copy. waitUntil keeps the write off the response's critical path;
  // without it the put is cancelled when the response finishes.
  if (cacheable && cache && res.status === 200 && res.headers.has('Cache-Control')) {
    try {
      const copy = res.clone();
      copy.headers.set('X-Edge-Cache', 'MISS');
      const put = cache.put(ctx.request, copy);
      if (runtime?.ctx?.waitUntil) runtime.ctx.waitUntil(put); else await put;
    } catch { /* a cache write must never take the page down */ }
  }

  res.headers.set('X-Edge-Cache', 'MISS');
  return res;
});
