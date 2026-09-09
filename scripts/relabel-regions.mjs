#!/usr/bin/env node
/**
 * Relabel the region on articles that are already published.
 *
 * The generator used to name an article after the round-robin counter rather
 * than after the document, so the archive is full of rows whose label is simply
 * wrong: a Canadian alcohol proclamation filed under NATO, an EU Council agenda
 * under Russia, a fisheries advisory committee under Iran. The generator no
 * longer does that, but nothing retroactively fixes what is already in the
 * table, and the labels are on every card and drive every /region/ page.
 *
 * This scores each published article's own title and excerpt against the same
 * REGION_TERMS the generator uses and writes back the winner. It reads the
 * decision logic out of worker/generator.js rather than copying it, so the two
 * cannot drift apart.
 *
 * Dry run by default. Nothing is written without --apply.
 *
 *   node scripts/relabel-regions.mjs              # report what would change
 *   node scripts/relabel-regions.mjs --apply      # actually change it
 *
 * Needs SUPABASE_URL and SUPABASE_KEY (a key with write access) in the
 * environment. In CI those are the same GitHub Secrets deploy.yml already uses.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Same trick test/generator.test.mjs uses: the Worker cannot be imported
// directly, so the handler block is stripped and the pure functions re-exported.
let src = readFileSync(join(root, 'worker/generator.js'), 'utf8');
src = src.replace(/^export default \{[\s\S]*$/m, '');
src += '\nexport { bestRegionFor, regionAffinity, REGION_TERMS };\n';
const scratch = mkdtempSync(join(tmpdir(), 'pw-relabel-'));
const modPath = join(scratch, 'generator.mjs');
writeFileSync(modPath, src);
const { bestRegionFor } = await import(modPath);

const APPLY = process.argv.includes('--apply');
const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;
if (!URL_BASE || !KEY) {
  console.error('SUPABASE_URL and SUPABASE_KEY must be set.');
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json'
};

async function sb(path, init = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${(await r.text()).slice(0, 300)}`);
  return r.status === 204 ? null : r.json();
}

const PAGE = 500;
let offset = 0;
let scanned = 0;
const changes = [];

for (;;) {
  const rows = await sb(`articles?select=id,title,excerpt,region&order=id.asc&limit=${PAGE}&offset=${offset}`);
  if (!rows.length) break;
  for (const row of rows) {
    scanned++;
    // The document text is long gone; the article's own headline and standfirst
    // are what a reader judges the label against anyway.
    const doc = { title: row.title || '', text: row.excerpt || '' };
    const want = bestRegionFor(doc, row.region);
    if (want !== row.region) changes.push({ id: row.id, from: row.region, to: want, title: row.title });
  }
  offset += PAGE;
  process.stderr.write(`\rscanned ${scanned}`);
}
process.stderr.write('\n');

const tally = {};
for (const c of changes) tally[`${c.from} -> ${c.to}`] = (tally[`${c.from} -> ${c.to}`] || 0) + 1;

console.log(`\n${scanned} articles scanned, ${changes.length} mislabelled (${((changes.length / scanned) * 100).toFixed(1)}%).\n`);
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${String(v).padStart(5)}  ${k}`);
}
console.log('\nExamples:');
for (const c of changes.slice(0, 10)) console.log(`  ${c.from} -> ${c.to}   ${c.title}`);

if (!APPLY) {
  console.log('\nDry run. Nothing was written. Re-run with --apply to change these.\n');
  process.exit(0);
}

let done = 0;
for (const c of changes) {
  await sb(`articles?id=eq.${c.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ region: c.to })
  });
  done++;
  if (done % 50 === 0) process.stderr.write(`\rupdated ${done}/${changes.length}`);
}
process.stderr.write('\n');
console.log(`\nUpdated ${done} articles.\n`);
