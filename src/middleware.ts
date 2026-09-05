import { defineMiddleware } from 'astro:middleware';

const CANONICAL_HOST = 'www.potuswatchdaily.com';

// public/_headers only applies to files served from the static asset store —
// it never reaches a response the Worker rendered. Every SSR route was
// therefore shipping with no Cache-Control and no security headers.
const CACHE_RULES: [RegExp, string][] = [
  // Articles are effectively immutable once published. max-age=0 keeps browsers
  // revalidating (so a correction is never stuck client-side) while the edge
  // serves the hits. stale-if-error removes the hard-failure mode when Supabase
  // hiccups — previously that surfaced as a user-facing timeout.
  [/^\/article\/[^/]+\/?$/, 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400, stale-if-error=86400'],
  [/^\/$/,                  'public, max-age=0, s-maxage=120, stale-while-revalidate=600, stale-if-error=86400'],
  [/^\/archive(\/\d+)?\/?$/,'public, max-age=0, s-maxage=600, stale-while-revalidate=3600, stale-if-error=86400'],
  [/^\/region\/[^/]+\/?$/,  'public, max-age=0, s-maxage=600, stale-while-revalidate=3600, stale-if-error=86400'],
  // Everything else was leaving the Worker with no Cache-Control at all, so
  // the edge could not cache a single one of them.
  [/^\/(about|editorial|contact|newsletter|privacy|terms|disclaimer)\/?$/,
                            'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=86400'],
  [/^\/explainers(\/[^/]*)?\/?$/,
                            'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=86400'],
];


/**
 * The full header set, in one place, applied to every SSR response.
 *
 * Two of these were missing entirely and they are the two that matter most.
 * Without CSP there is no second line of defence behind the `set:html` sinks on
 * the article and region pages; without HSTS the apex-to-www redirect below is
 * strippable on a visitor's first contact.
 *
 * script-src carries 'unsafe-inline' rather than a nonce because the pages use
 * inline handlers and inline `is:inline` blocks today. That is an honest
 * starting point, not the finish line — the other directives (base-uri,
 * object-src, form-action, frame-ancestors) still close real holes, and they
 * cost nothing.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  'upgrade-insecure-requests',
  "script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.googletagmanager.com https://www.google-analytics.com https://cdnjs.buymeacoffee.com https://cdn.buymeacoffee.com https://pl29502765.effectivecpmnetwork.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://pagead2.googlesyndication.com https://api.buymeacoffee.com",
  "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.buymeacoffee.com",
].join('; ');

const PERMISSIONS_POLICY = [
  'accelerometer=()', 'autoplay=()', 'camera=()', 'display-capture=()',
  'encrypted-media=()', 'geolocation=()', 'gyroscope=()', 'magnetometer=()',
  'microphone=()', 'midi=()', 'payment=()', 'publickey-credentials-get=()',
  'screen-wake-lock=()', 'usb=()', 'xr-spatial-tracking=()',
].join(', ');

export function applySecurityHeaders(res: Response) {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.headers.set('Permissions-Policy', PERMISSIONS_POLICY);
  res.headers.set('Content-Security-Policy', CSP);
  return res;
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const url = ctx.url;

  // ── Canonical host ────────────────────────────────────────────────────────
  // public/_redirects cannot do host-level rules: it matches PATHS only, so
  // `https://potuswatchdaily.com/*` was parsed as a literal path beginning
  // "/https:/". The apex therefore served 200s, doubling crawl cost on every
  // URL. A 301 is a directive where a canonical tag is only a hint.
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

  applySecurityHeaders(res);

  // A workers.dev hostname serves the whole site with a 200, and a canonical
  // tag is a hint, not a directive — so the preview host was an indexable
  // duplicate of every page.
  if (requestHost && requestHost !== CANONICAL_HOST) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

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
