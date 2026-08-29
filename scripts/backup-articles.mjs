// Daily full-table backup of the articles table.
// Runs in GitHub Actions; commits a JSON snapshot into backups/ so every
// article is recoverable from git history even if the database is wiped.
// Also refuses to overwrite a good backup with a suspiciously small one.

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_KEY;
if (!URL_BASE || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_KEY'); process.exit(1); }

const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const PAGE = 1000;

async function fetchAll() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const url = `${URL_BASE}/rest/v1/articles?select=*&order=id.asc&limit=${PAGE}&offset=${from}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const batch = await res.json();
    rows.push(...batch);
    console.log(`fetched ${rows.length}`);
    if (batch.length < PAGE) break;
  }
  return rows;
}

const rows = await fetchAll();
console.log(`TOTAL ROWS: ${rows.length}`);

mkdirSync('backups', { recursive: true });

// Guard: if the table has shrunk by more than 5% since the last snapshot,
// write nothing and fail the job loudly. A silent overwrite would destroy
// the only copy of whatever just disappeared.
const prior = readdirSync('backups').filter(f => f.endsWith('.json')).sort();
if (prior.length) {
  const last = JSON.parse(readFileSync(`backups/${prior[prior.length - 1]}`, 'utf8'));
  const before = last.count ?? last.rows?.length ?? 0;
  if (before > 0 && rows.length < before * 0.95) {
    console.error(`ROW COUNT DROPPED: ${before} -> ${rows.length}. Refusing to overwrite. Investigate before re-running.`);
    process.exit(1);
  }
}

const stamp = new Date().toISOString().slice(0, 10);
const payload = { generated_at: new Date().toISOString(), count: rows.length, rows };
writeFileSync(`backups/articles-${stamp}.json`, JSON.stringify(payload));
writeFileSync('backups/LATEST-COUNT.txt', `${rows.length}\n`);
console.log(`wrote backups/articles-${stamp}.json (${rows.length} rows)`);
