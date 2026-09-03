#!/usr/bin/env node
/**
 * Sets this repository's GitHub Actions secrets, then re-runs the deploy.
 *
 * Run:  npm run secrets
 *
 * Everything happens on your machine. The GitHub token comes from the
 * credential helper `git push` already uses; the secret values are typed at a
 * hidden prompt, encrypted locally with the repository's public key, and sent
 * straight to GitHub. No value is printed, logged, or written to disk.
 *
 * It only asks for what is actually missing -- run it again after adding a
 * secret and it will tell you there is nothing to do.
 */

import { readFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'project.config.json'), 'utf8'));

/* ---- which repository ---- */

const remote = execSync('git remote get-url origin', { cwd: root }).toString().trim();
const m = remote.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
if (!m) {
  console.error(`Could not read a GitHub repository out of the origin remote: ${remote}`);
  process.exit(1);
}
const [, owner, repo] = m;
console.log(`Repository: ${owner}/${repo}\n`);

/* ---- the GitHub token git already has ---- */

function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const out = execFileSync('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n',
      cwd: root,
      stdio: ['pipe', 'pipe', 'ignore'],
    }).toString();
    const pw = out.match(/^password=(.*)$/m);
    if (pw) return pw[1];
  } catch { /* fall through */ }
  return null;
}

const token = githubToken();
if (!token) {
  console.error(
    'No GitHub token found.\n\n' +
    'git push works here, so one usually exists in the keychain. If it does not,\n' +
    'create a fine-grained token with "Secrets: read and write" on this repository\n' +
    'at https://github.com/settings/personal-access-tokens and run:\n\n' +
    '  GITHUB_TOKEN=<token> npm run secrets\n'
  );
  process.exit(1);
}

const gh = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  return res;
};

/* ---- what is already set ---- */

const listed = await gh(`/repos/${owner}/${repo}/actions/secrets`);
if (listed.status === 403 || listed.status === 401) {
  console.error(
    `GitHub rejected the token for reading this repository's secrets (HTTP ${listed.status}).\n` +
    'The token git uses for pushing may not carry the "Secrets" permission. Create a\n' +
    'fine-grained token with "Secrets: read and write" on this repository at\n' +
    'https://github.com/settings/personal-access-tokens and run:\n\n' +
    '  GITHUB_TOKEN=<token> npm run secrets\n'
  );
  process.exit(1);
}
if (!listed.ok) {
  console.error(`GitHub returned HTTP ${listed.status} listing secrets.`);
  process.exit(1);
}
const existing = new Set((await listed.json()).secrets.map((s) => s.name));

const wanted = [
  ...Object.entries(cfg.requiredSecrets).map(([name, why]) => ({ name, why, required: true })),
  ...Object.entries(cfg.optionalSecrets).map(([name, why]) => ({ name, why, required: false })),
];

for (const s of wanted) {
  console.log(`  ${existing.has(s.name) ? 'set    ' : s.required ? 'MISSING' : 'unset  '}  ${s.name}`);
}
console.log('');

const todo = wanted.filter((s) => !existing.has(s.name) && s.required);
if (todo.length === 0) {
  console.log('Every required secret is already set. Nothing to do.\n');
  process.exit(0);
}

/* ---- ask for the missing ones, without echoing ---- */

// Raw mode so a pasted key never appears on screen or in shell history.
// Paste arrives as one chunk, so chunks are handled, not single characters.
function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let buf = '';
    const done = (value) => {
      stdin.removeListener('data', onData);
      stdin.setRawMode?.(Boolean(wasRaw));
      stdin.pause();
      process.stdout.write('\n');
      resolve(value);
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return done(buf.trim());
        if (ch === '\u0003') { process.stdout.write('\n'); process.exit(130); }   // Ctrl-C
        if (ch === '\u0004') return done(buf.trim());                           // Ctrl-D
        if (ch === '\u007f' || ch === '\b') { buf = buf.slice(0, -1); continue; }
        if (ch < ' ') continue;                                                  // other control chars
        buf += ch;
      }
    };
    stdin.on('data', onData);
  });
}

const values = {};
for (const s of todo) {
  console.log(`${s.name}\n  ${s.why}`);
  const v = await askHidden('  paste it here (hidden), or press Enter to skip: ');
  if (!v) { console.log('  skipped\n'); continue; }

  if (s.name === 'SUPABASE_WRITE_KEY') {
    const isJwt = v.split('.').length === 3;
    const isSecret = v.startsWith('sb_secret_');
    if (v.startsWith('sb_publishable_') || (!isJwt && !isSecret)) {
      console.log(
        '  That does not look like a key that can write. The generator inserts rows, so it\n' +
        '  needs the service_role key (a long three-part token) or an sb_secret_ key --\n' +
        '  not the publishable one. Not setting it.\n'
      );
      continue;
    }
  }
  if (s.name === 'SUPABASE_URL' && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(v)) {
    console.log('  That does not look like a Supabase project URL (https://<ref>.supabase.co). Not setting it.\n');
    continue;
  }

  values[s.name] = v.replace(/\/+$/, '');
  console.log(`  accepted (${v.length} characters)\n`);
}

if (Object.keys(values).length === 0) {
  console.log('Nothing was entered. No secrets changed.\n');
  process.exit(1);
}

/* ---- encrypt and upload ---- */

// GitHub wants the value sealed with libsodium against the repo's public key.
// Installed into a throwaway directory so it never lands in package.json.
console.log('Encrypting locally...');
const scratch = mkdtempSync(join(tmpdir(), 'pw-secrets-'));
execSync('npm install --silent --no-audit --no-fund libsodium-wrappers@0.7.15', { cwd: scratch, stdio: 'ignore' });
const { default: sodium } = await import(join(scratch, 'node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js'));
await sodium.ready;

const keyRes = await gh(`/repos/${owner}/${repo}/actions/secrets/public-key`);
if (!keyRes.ok) {
  console.error(`Could not fetch the repository public key (HTTP ${keyRes.status}).`);
  process.exit(1);
}
const { key, key_id } = await keyRes.json();

for (const [name, value] of Object.entries(values)) {
  const sealed = sodium.crypto_box_seal(
    sodium.from_string(value),
    sodium.from_base64(key, sodium.base64_variants.ORIGINAL)
  );
  const res = await gh(`/repos/${owner}/${repo}/actions/secrets/${name}`, {
    method: 'PUT',
    body: JSON.stringify({
      encrypted_value: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL),
      key_id,
    }),
  });
  console.log(res.ok ? `  ${name}: set` : `  ${name}: FAILED (HTTP ${res.status})`);
}

/* ---- kick the deploy so the Worker actually receives them ---- */

console.log('\nRe-running the deploy so the Worker picks them up...');
const run = await gh(`/repos/${owner}/${repo}/actions/workflows/deploy.yml/dispatches`, {
  method: 'POST',
  body: JSON.stringify({ ref: 'main' }),
});
console.log(
  run.ok
    ? `Started. Watch it at https://github.com/${owner}/${repo}/actions\n`
    : `Could not start the deploy automatically (HTTP ${run.status}). Push anything, or run the workflow by hand.\n`
);
