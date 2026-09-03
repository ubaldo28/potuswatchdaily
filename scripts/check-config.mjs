#!/usr/bin/env node
/**
 * Asserts that every file naming a Cloudflare account, Worker or hostname
 * agrees with project.config.json.
 *
 * Why this exists: three separate outages in this project came from the same
 * shape of mistake -- an identifier written by hand in one file, correct when
 * it was written, silently wrong later. A pinned account id in one wrangler
 * config but not the other put the generator in an unrelated account. A
 * hostname copied off a dashboard sent the health check at a Worker belonging
 * to a different project entirely, so the monitor stayed green while the site
 * went stale. None of those failed loudly; they failed by looking fine.
 *
 * A grep-level check catches all of them in under a second, before a deploy
 * spends fifteen minutes proving the same thing the hard way.
 *
 * Run:  npm run check:config
 * CI:   first step of .github/workflows/deploy.yml -- a mismatch blocks deploy.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/** wrangler.jsonc is JSONC. Strip // and /* *\/ comments before parsing.
 *  Naive on purpose: these files contain no string literal holding "//",
 *  and the check below re-verifies every value it cares about. */
const parseJsonc = (text) =>
  JSON.parse(
    text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:"])\/\/.*$/gm, '$1')
  );

const cfg = JSON.parse(read('project.config.json'));
const { accountId, workersDevSubdomain } = cfg.cloudflare;

const failures = [];
const fail = (file, msg) => failures.push({ file, msg });

/* ---- 1. Both wrangler configs pin the one account, with the right names ---- */

for (const [role, w] of Object.entries(cfg.workers)) {
  if (!existsSync(join(root, w.config))) {
    fail(w.config, `missing: project.config.json says the ${role} Worker is configured here`);
    continue;
  }
  let parsed;
  try {
    parsed = parseJsonc(read(w.config));
  } catch (e) {
    fail(w.config, `is not parseable as JSONC: ${e.message}`);
    continue;
  }

  if (parsed.account_id !== accountId) {
    fail(
      w.config,
      parsed.account_id
        ? `account_id is "${parsed.account_id}" but project.config.json says "${accountId}". ` +
          `An unpinned or wrong account is how this Worker ended up deployed into unrelated accounts.`
        : `has no account_id. Without it, wrangler deploys to whichever account the machine happens ` +
          `to be logged into -- a coin flip on a laptop that works on more than one project.`
    );
  }
  if (parsed.name !== w.name) {
    fail(w.config, `name is "${parsed.name}" but project.config.json says "${w.name}"`);
  }
}

/* ---- 2. The generator's health URL matches its Worker name and subdomain ---- */

const expectedHealth =
  `https://${cfg.workers.generator.name}.${workersDevSubdomain}.workers.dev/health`;

if (cfg.workers.generator.healthUrl !== expectedHealth) {
  fail(
    'project.config.json',
    `workers.generator.healthUrl is "${cfg.workers.generator.healthUrl}" but the Worker name ` +
      `and workers.dev subdomain give "${expectedHealth}"`
  );
}

/* ---- 3. No workflow points at a hostname or account we do not own ---- */

const workflows = ['deploy.yml', 'health.yml', 'backup.yml', 'cache-rule.yml']
  .map((f) => ['.github/workflows/' + f])
  .filter(([p]) => existsSync(join(root, p)));

const HOSTNAME = /https:\/\/([a-z0-9-]+)\.([a-z0-9-]+)\.workers\.dev/gi;
const ACCOUNT_ID = /\b[0-9a-f]{32}\b/g;

for (const [path] of workflows) {
  const text = read(path);

  for (const m of text.matchAll(HOSTNAME)) {
    const [full, worker, subdomain] = m;
    if (subdomain !== workersDevSubdomain) {
      fail(
        path,
        `points at ${full} -- subdomain "${subdomain}" is not this project's ` +
          `("${workersDevSubdomain}"). That hostname belongs to a different Cloudflare account.`
      );
    } else if (!Object.values(cfg.workers).some((w) => w.name === worker)) {
      fail(path, `points at ${full} -- no Worker named "${worker}" is defined in project.config.json`);
    }
  }

  for (const m of text.matchAll(ACCOUNT_ID)) {
    if (m[0] !== accountId) {
      fail(path, `contains a 32-hex account id that is not this project's account`);
    }
  }
}

/* ---- 4. Every secret the workflows read is documented in project.config.json ---- */

const documented = new Set([
  ...Object.keys(cfg.requiredSecrets),
  ...Object.keys(cfg.optionalSecrets),
]);
const used = new Set();
for (const [path] of workflows) {
  for (const m of read(path).matchAll(/secrets\.([A-Z0-9_]+)/g)) {
    if (m[1] !== 'GITHUB_TOKEN') used.add(m[1]);
  }
}
for (const name of used) {
  if (!documented.has(name)) {
    fail(
      'project.config.json',
      `workflows read secrets.${name}, but it is listed in neither requiredSecrets nor ` +
        `optionalSecrets. An undocumented secret is one nobody knows to set after a repo move.`
    );
  }
}

/* ---- Report ---- */

if (failures.length === 0) {
  console.log('config check: OK');
  console.log(`  account      ${accountId}`);
  for (const [role, w] of Object.entries(cfg.workers)) {
    console.log(`  ${role.padEnd(12)} ${w.name}  (${w.config})`);
  }
  console.log(`  health       ${cfg.workers.generator.healthUrl}`);
  process.exit(0);
}

console.error(`config check: ${failures.length} problem(s)\n`);
for (const f of failures) console.error(`  ${f.file}\n    ${f.msg}\n`);
console.error('Fix the file, or change project.config.json if the new value is the intended one.');
process.exit(1);
