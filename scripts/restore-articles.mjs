// Restore articles from a backup snapshot.
//   node scripts/restore-articles.mjs backups/articles-2026-08-29.json [--dry-run]
// Inserts only rows whose slug is not already present. Never deletes anything.

import { readFileSync } from 'node:fs';

const file = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!file) { console.error('usage: node scripts/restore-articles.mjs <backup.json> [--dry-run]'); process.exit(1); }

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;
if (!URL_BASE || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_KEY'); process.exit(1); }
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const { rows } = JSON.parse(readFileSync(file, 'utf8'));
console.log(`backup holds ${rows.length} rows`);

const live = new Set();
for (let from = 0; ; from += 1000) {
  const res = await fetch(`${URL_BASE}/rest/v1/articles?select=slug&limit=1000&offset=${from}`, { headers: HEADERS });
  const batch = await res.json();
  batch.forEach(r => live.add(r.slug));
  if (batch.length < 1000) break;
}
console.log(`live table holds ${live.size} slugs`);

const missing = rows.filter(r => !live.has(r.slug));
console.log(`${missing.length} rows missing from live table`);
if (!missing.length || dryRun) { console.log(dryRun ? '(dry run — nothing written)' : 'nothing to do'); process.exit(0); }

for (let i = 0; i < missing.length; i += 200) {
  const chunk = missing.slice(i, i + 200).map(({ id, ...rest }) => rest);  // let Postgres assign new ids
  const res = await fetch(`${URL_BASE}/rest/v1/articles`, {
    method: 'POST', headers: { ...HEADERS, Prefer: 'return=minimal' }, body: JSON.stringify(chunk),
  });
  if (!res.ok) { console.error(`insert failed at ${i}: ${res.status} ${await res.text()}`); process.exit(1); }
  console.log(`restored ${Math.min(i + 200, missing.length)} / ${missing.length}`);
}
console.log('done');
