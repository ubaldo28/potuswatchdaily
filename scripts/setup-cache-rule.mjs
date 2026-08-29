// Creates (or updates) the Cloudflare Cache Rule that makes the edge actually
// cache HTML from the Pages Function.
//
// WHY THIS EXISTS: Cloudflare does not cache HTML from a Worker/Pages Function
// on Cache-Control alone — every route reports cf-cache-status: DYNAMIC. The
// alternative, writing to caches.default from middleware, works but is
// per-datacenter and therefore NOT globally purgeable. The real edge cache is,
// which is what lets purge-on-publish in worker/generator.js do its job.
//
// Auth: uses the CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY (Global API Key) already
// in GitHub Secrets. Resolves the zone id from the domain, so nothing extra is
// needed. Idempotent — safe to re-run.

const EMAIL = process.env.CLOUDFLARE_EMAIL;
const KEY   = process.env.CLOUDFLARE_API_KEY;
const DOMAIN = process.env.CF_DOMAIN || 'potuswatchdaily.com';

if (!EMAIL || !KEY) {
  console.error('Missing CLOUDFLARE_EMAIL / CLOUDFLARE_API_KEY');
  process.exit(1);
}

const H = { 'X-Auth-Email': EMAIL, 'X-Auth-Key': KEY, 'Content-Type': 'application/json' };
const API = 'https://api.cloudflare.com/client/v4';

async function cf(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(`${init.method || 'GET'} ${path} -> ${res.status}: ${JSON.stringify(body.errors || body).slice(0, 600)}`);
  }
  return body.result;
}

const zones = await cf(`/zones?name=${encodeURIComponent(DOMAIN)}`);
if (!zones?.length) throw new Error(`No zone found for ${DOMAIN}`);
const zoneId = zones[0].id;
console.log(`zone ${DOMAIN} -> ${zoneId}`);

const RULE = {
  description: 'Cache SSR HTML (home, articles, archive, region hubs) per origin Cache-Control',
  expression:
    '(starts_with(http.request.uri.path, "/article/") or ' +
    'http.request.uri.path eq "/" or ' +
    'starts_with(http.request.uri.path, "/archive") or ' +
    'starts_with(http.request.uri.path, "/region/"))',
  action: 'set_cache_settings',
  action_parameters: {
    cache: true,
    // Honour the Cache-Control that src/middleware.ts sets per route, rather
    // than pinning a fixed TTL here in two places.
    edge_ttl: { mode: 'respect_origin' },
    browser_ttl: { mode: 'respect_origin' }
  }
};

// Read the existing entrypoint so re-running replaces our rule instead of
// stacking duplicates, and never clobbers a rule someone else added.
let existing = [];
try {
  const ep = await cf(`/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`);
  existing = ep?.rules || [];
  console.log(`existing cache rules: ${existing.length}`);
} catch (e) {
  console.log(`no existing cache ruleset (${e.message.slice(0, 80)}) — creating one`);
}

const kept = existing.filter(r => r.description !== RULE.description);
const rules = [RULE, ...kept].map(({ id, version, ref, last_updated, ...r }) => r);

await cf(`/zones/${zoneId}/rulesets/phases/http_request_cache_settings/entrypoint`, {
  method: 'PUT',
  body: JSON.stringify({ rules })
});

console.log(`Cache Rule applied. ${rules.length} rule(s) in the cache phase.`);
console.log(`\nCF_ZONE_ID=${zoneId}`);
console.log('Set that as a Worker secret so purge-on-publish works:');
console.log(`  echo -n "${zoneId}" | npx wrangler secret put CF_ZONE_ID --config worker/wrangler.jsonc`);
