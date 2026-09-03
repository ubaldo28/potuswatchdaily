#!/usr/bin/env node
/**
 * One command that answers "is the site actually working right now, and if not
 * which part is broken" -- without a dashboard, a login, or guessing.
 *
 * Run:  npm run doctor
 *
 * It checks the three things that have ever been wrong at the same time:
 *   1. the repository's identifiers agree with each other (check-config)
 *   2. the generator Worker answers, and can read the database
 *   3. the public site serves a page with a recent article on it
 *
 * Every line prints what it checked and what it got, so a failure names the
 * broken component instead of reporting that "the site is down".
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'project.config.json'), 'utf8'));

let bad = 0;
const ok   = (m) => console.log(`  ok    ${m}`);
const warn = (m) => console.log(`  warn  ${m}`);
const err  = (m) => { bad++; console.log(`  FAIL  ${m}`); };

const timeout = (ms) => AbortSignal.timeout(ms);

console.log('\n1. repository configuration');
try {
  execFileSync(process.execPath, [join(root, 'scripts/check-config.mjs')], { stdio: 'pipe' });
  ok('every file agrees on the account, Worker names and hostname');
} catch (e) {
  err('config check failed:\n' + (e.stdout?.toString() || '') + (e.stderr?.toString() || ''));
}

console.log('\n2. generator Worker');
const healthUrl = cfg.workers.generator.healthUrl;
try {
  const res = await fetch(healthUrl, { signal: timeout(30_000) });
  const body = await res.json().catch(() => ({}));

  if (body.last_article_minutes_ago === undefined) {
    err(
      `${healthUrl} -> HTTP ${res.status} ${JSON.stringify(body)}\n` +
      `        The Worker is deployed and answering, but it could not query Supabase. ` +
      `That is almost always missing or wrong SUPABASE_URL / SUPABASE_KEY secrets on the Worker.\n` +
      `        Fix: set SUPABASE_URL and SUPABASE_WRITE_KEY in GitHub Secrets and push -- ` +
      `deploy.yml uploads them to the Worker on every deploy.`
    );
  } else {
    const mins = body.last_article_minutes_ago;
    const line = `${healthUrl} -> ${body.status}, newest article ${mins} minutes old`;
    if (body.status === 'ok') ok(line);
    else err(line + '\n        Nothing has published in over 3 hours. Check: npx wrangler tail --config worker/wrangler.jsonc');
  }
} catch (e) {
  err(`${healthUrl} unreachable: ${e.message}\n        The Worker is not deployed, or the hostname is wrong.`);
}

console.log('\n3. public site');
const siteUrl = `https://${cfg.site.domain}/`;
try {
  const res = await fetch(siteUrl, { signal: timeout(30_000), redirect: 'follow' });
  const html = await res.text();
  if (!res.ok) err(`${siteUrl} -> HTTP ${res.status}`);
  else if (html.length < 2000) err(`${siteUrl} -> HTTP 200 but only ${html.length} bytes; the page rendered empty`);
  else if (!/<article|class="[^"]*article/i.test(html)) warn(`${siteUrl} -> HTTP 200, ${html.length} bytes, but no article markup found`);
  else ok(`${siteUrl} -> HTTP 200, ${html.length} bytes, articles present`);
} catch (e) {
  err(`${siteUrl} unreachable: ${e.message}`);
}

console.log(bad === 0 ? '\nAll clear.\n' : `\n${bad} component(s) need attention.\n`);
process.exit(bad === 0 ? 0 : 1);
