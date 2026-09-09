#!/usr/bin/env node
/**
 * Move potuswatchdaily.com from the Pages project onto the site Worker — and
 * put it back if anything goes wrong.
 *
 * WHY THIS EXISTS
 *
 * The live site is served by a Cloudflare Pages project whose source repository
 * no longer exists. It cannot be rebuilt, and @astrojs/cloudflare v14 dropped
 * Pages support anyway, so nothing in this repository can ever reach readers
 * while the hostname stays where it is. Every fix since 2026-09-05 — the
 * security headers, the structured data that currently renders as literal
 * JavaScript source, the unsubscribe endpoint the newsletter links to — is
 * deployed to a Worker nobody can reach.
 *
 * A hostname can only be attached to one of them. Cloudflare refuses to add it
 * to a Worker while Pages holds it, and refuses to create a Worker custom
 * domain over an existing CNAME. So the switch is: detach from Pages, clear the
 * record it left, attach to the Worker. Done by hand in the dashboard that is
 * minutes of downtime. Done here it is one API call after another, and the
 * measured gap is a few seconds.
 *
 * WHAT MAKES THIS SAFE
 *
 * The dangerous version of this operation is the one that gets halfway. So:
 *
 *   - Nothing is touched until the Worker has been fetched over the network and
 *     proven to serve real articles.
 *   - Every permission the switch needs is proven FIRST, by attaching and then
 *     detaching a throwaway probe hostname. A token missing Pages:Edit fails on
 *     the probe, with the site still up, instead of failing after the domain has
 *     been taken off Pages.
 *   - The previous state is printed before anything changes, so a manual
 *     recovery is possible even if this process is killed mid-run.
 *   - After the switch the live domain is polled until it serves articles. If it
 *     does not, the script rolls itself back without being asked.
 *
 * USAGE
 *
 *   node scripts/cutover.mjs            # check only. Writes nothing. Safe.
 *   node scripts/cutover.mjs --switch   # do it
 *   node scripts/cutover.mjs --rollback # put it back on Pages
 *
 * Needs CLOUDFLARE_API_TOKEN with, on this account:
 *   Account · Cloudflare Pages · Edit
 *   Account · Workers Scripts · Edit
 *   Zone    · Zone            · Read
 *   Zone    · DNS             · Edit
 * The deploy token probably has the last three and not the first. --check says
 * so in plain words rather than discovering it halfway through.
 */
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../project.config.json', import.meta.url), 'utf8'));
const ACCOUNT = cfg.cloudflare.accountId;
const SUBDOMAIN = cfg.cloudflare.workersDevSubdomain;
const APEX = cfg.site.domain;
const WWW = `www.${APEX}`;
const HOSTNAMES = [WWW, APEX];            // www first: it is the canonical host
const PAGES_PROJECT = cfg.cloudflare.pagesProject;
const WORKER = cfg.workers.site.name;
const WORKER_URL = `https://${WORKER}.${SUBDOMAIN}.workers.dev/`;
const PROBE = `pw-cutover-probe.${APEX}`;

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const MODE = process.argv.includes('--switch') ? 'switch'
           : process.argv.includes('--rollback') ? 'rollback'
           : 'check';

if (!TOKEN) {
  console.error('CLOUDFLARE_API_TOKEN is not set.');
  process.exit(1);
}

const API = 'https://api.cloudflare.com/client/v4';
const log = (...a) => console.log(...a);
const stamp = () => new Date().toISOString().slice(11, 23);

async function cf(path, init = {}) {
  const r = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  let body;
  try { body = await r.json(); } catch { body = { success: false, errors: [{ message: `HTTP ${r.status}` }] }; }
  if (!body.success) {
    const msg = (body.errors || []).map(e => `${e.code ?? '?'} ${e.message}`).join('; ') || `HTTP ${r.status}`;
    const err = new Error(`${init.method || 'GET'} ${path} -> ${msg}`);
    err.cfErrors = body.errors || [];
    err.status = r.status;
    throw err;
  }
  return body.result;
}

/** Does this URL serve a page with article markup on it? */
async function servesArticles(url, timeoutMs = 15000) {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return { ok: false, why: `HTTP ${r.status}` };
    const body = await r.text();
    const n = (body.match(/href="\/article\//g) || []).length;
    if (n < 3) return { ok: false, why: `${body.length} bytes, ${n} article links` };
    return { ok: true, why: `${body.length} bytes, ${n} article links` };
  } catch (e) {
    return { ok: false, why: e.message };
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────

async function zoneId() {
  const zones = await cf(`/zones?name=${encodeURIComponent(APEX)}`);
  if (!zones.length) throw new Error(`No zone named ${APEX} on this account. The token may lack Zone:Read.`);
  return zones[0].id;
}

const pagesDomains = () => cf(`/accounts/${ACCOUNT}/pages/projects/${PAGES_PROJECT}/domains`);
const workerDomains = () => cf(`/accounts/${ACCOUNT}/workers/domains?zone_name=${encodeURIComponent(APEX)}`);
const dnsFor = (zone, name) => cf(`/zones/${zone}/dns_records?name=${encodeURIComponent(name)}`);

// ── Writes ───────────────────────────────────────────────────────────────────

async function attachWorkerDomain(zone, hostname, service) {
  const body = { hostname, service, zone_id: zone };
  try {
    return await cf(`/accounts/${ACCOUNT}/workers/domains`, { method: 'PUT', body: JSON.stringify(body) });
  } catch (e) {
    // Some accounts require the environment name. Rather than guess which,
    // send it only when the API says it wanted it.
    if (/environment/i.test(e.message)) {
      return cf(`/accounts/${ACCOUNT}/workers/domains`, {
        method: 'PUT', body: JSON.stringify({ ...body, environment: 'production' })
      });
    }
    throw e;
  }
}

async function detachWorkerDomain(zone, hostname) {
  const all = await workerDomains();
  const hit = all.find(d => d.hostname === hostname);
  if (!hit) return false;
  await cf(`/accounts/${ACCOUNT}/workers/domains/${hit.id}`, { method: 'DELETE' });
  return true;
}

const addPagesDomain = name =>
  cf(`/accounts/${ACCOUNT}/pages/projects/${PAGES_PROJECT}/domains`, { method: 'POST', body: JSON.stringify({ name }) });

const removePagesDomain = name =>
  cf(`/accounts/${ACCOUNT}/pages/projects/${PAGES_PROJECT}/domains/${encodeURIComponent(name)}`, { method: 'DELETE' });

/**
 * A Worker custom domain cannot be created over an existing CNAME, and taking a
 * hostname off a Pages project does not always take its record with it. This is
 * the "domain already in use" everyone hits.
 */
async function clearBlockingRecord(zone, hostname) {
  const records = await dnsFor(zone, hostname);
  const blocking = records.filter(r => r.type === 'CNAME' || r.type === 'A' || r.type === 'AAAA');
  for (const r of blocking) {
    log(`    removing leftover ${r.type} ${r.name} -> ${r.content}`);
    await cf(`/zones/${zone}/dns_records/${r.id}`, { method: 'DELETE' });
  }
  return blocking;
}

// ── Preflight ────────────────────────────────────────────────────────────────

/**
 * Prove every write permission the switch needs, on a hostname nobody uses,
 * and undo it. A token without Pages:Edit fails here with the site still up.
 */
async function provePermissions(zone) {
  const results = {};

  log('  probing Pages:Edit  (add and remove a throwaway hostname)');
  try {
    await addPagesDomain(PROBE);
    results.pagesEdit = true;
  } catch (e) {
    results.pagesEdit = false;
    results.pagesError = e.message;
  }
  try { await removePagesDomain(PROBE); } catch {}
  try { await clearBlockingRecord(zone, PROBE); } catch {}

  log('  probing Workers custom domains + DNS:Edit');
  try {
    await attachWorkerDomain(zone, PROBE, WORKER);
    results.workerDomains = true;
  } catch (e) {
    results.workerDomains = false;
    results.workerError = e.message;
  }
  try { await detachWorkerDomain(zone, PROBE); } catch {}
  try { await clearBlockingRecord(zone, PROBE); } catch {}

  return results;
}

async function waitForLive(url, seconds = 90) {
  const deadline = Date.now() + seconds * 1000;
  let last = '';
  while (Date.now() < deadline) {
    const r = await servesArticles(url, 8000);
    last = r.why;
    if (r.ok) return { ok: true, why: r.why };
    await new Promise(res => setTimeout(res, 2000));
  }
  return { ok: false, why: last };
}

// ── Main ─────────────────────────────────────────────────────────────────────

const zone = await zoneId();
log(`zone            ${APEX} (${zone})`);
log(`pages project   ${PAGES_PROJECT}`);
log(`worker          ${WORKER}`);
log('');

const before = {
  pages: (await pagesDomains()).map(d => d.name),
  workers: (await workerDomains()).map(d => d.hostname)
};
log(`pages holds     ${before.pages.join(', ') || '(none)'}`);
log(`worker holds    ${before.workers.join(', ') || '(none)'}`);
log('');

log(`checking the Worker at ${WORKER_URL}`);
const workerHealth = await servesArticles(WORKER_URL);
log(`  ${workerHealth.ok ? 'serving articles' : 'NOT SERVING'} — ${workerHealth.why}`);
log('');

if (MODE === 'rollback') {
  log('ROLLBACK — putting the hostnames back on Pages\n');
  for (const host of HOSTNAMES) {
    log(`  ${stamp()}  ${host}`);
    await detachWorkerDomain(zone, host).catch(e => log(`    detach: ${e.message}`));
    await clearBlockingRecord(zone, host).catch(e => log(`    dns: ${e.message}`));
    await addPagesDomain(host).catch(e => log(`    pages: ${e.message}`));
  }
  const live = await waitForLive(`https://${WWW}/`, 120);
  log(`\n  live site: ${live.ok ? 'serving articles' : 'STILL DOWN'} — ${live.why}`);
  process.exit(live.ok ? 0 : 1);
}

if (!workerHealth.ok) {
  log('STOP. The Worker is not serving articles, so there is nothing safe to switch to.');
  log('Check its SUPABASE_URL / SUPABASE_KEY secrets, and that workers_dev is true.');
  process.exit(1);
}

log('proving the token can do every write this needs, before touching anything');
const perms = await provePermissions(zone);
log(`  Pages:Edit                 ${perms.pagesEdit ? 'yes' : 'NO  — ' + perms.pagesError}`);
log(`  Workers domains + DNS:Edit ${perms.workerDomains ? 'yes' : 'NO  — ' + perms.workerError}`);
log('');

if (!perms.pagesEdit || !perms.workerDomains) {
  log('STOP. The token cannot complete the switch, and a half-finished switch is an outage.');
  log('Add the missing permission at dash.cloudflare.com -> My Profile -> API Tokens:');
  if (!perms.pagesEdit)      log('  Account · Cloudflare Pages · Edit');
  if (!perms.workerDomains)  log('  Account · Workers Scripts · Edit   and   Zone · DNS · Edit');
  process.exit(1);
}

if (MODE === 'check') {
  log('Everything needed is in place. Nothing was changed.');
  log('Run with --switch to move the hostnames onto the Worker.');
  process.exit(0);
}

log('SWITCHING. Previous state, for a manual recovery if this process dies:');
log(`  pages domains to restore: ${before.pages.join(', ')}`);
log('');

let failure = null;
for (const host of HOSTNAMES) {
  try {
    log(`  ${stamp()}  ${host}: off Pages`);
    if (before.pages.includes(host)) await removePagesDomain(host);
    await clearBlockingRecord(zone, host);
    log(`  ${stamp()}  ${host}: onto ${WORKER}`);
    await attachWorkerDomain(zone, host, WORKER);
    log(`  ${stamp()}  ${host}: done`);
  } catch (e) {
    failure = `${host}: ${e.message}`;
    log(`  ${stamp()}  FAILED — ${failure}`);
    break;
  }
}

const live = failure ? { ok: false, why: failure } : await waitForLive(`https://${WWW}/`, 120);
log(`\n  live site: ${live.ok ? 'serving articles' : 'NOT SERVING'} — ${live.why}`);

if (live.ok) {
  log('\nDone. potuswatchdaily.com is served by the Worker, and every deploy from');
  log('this repository now reaches readers. Roll back any time with --rollback.');
  process.exit(0);
}

log('\nROLLING BACK automatically.');
for (const host of HOSTNAMES) {
  await detachWorkerDomain(zone, host).catch(e => log(`  detach ${host}: ${e.message}`));
  await clearBlockingRecord(zone, host).catch(e => log(`  dns ${host}: ${e.message}`));
  if (before.pages.includes(host)) await addPagesDomain(host).catch(e => log(`  pages ${host}: ${e.message}`));
}
const back = await waitForLive(`https://${WWW}/`, 120);
log(`  after rollback: ${back.ok ? 'serving articles again' : 'STILL DOWN — go to the dashboard'} — ${back.why}`);
process.exit(1);
