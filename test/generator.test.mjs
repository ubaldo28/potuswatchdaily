#!/usr/bin/env node
/**
 * Tests for the pure decision logic inside worker/generator.js.
 *
 * These exist because of a specific outage: on 2026-09-05 the generator
 * published nothing for nine consecutive hours while forty uncovered documents
 * sat in the pool, because every one of them scored zero for all eight regions.
 * Nothing in the repository could have caught that, so nothing did.
 *
 * The Worker cannot be imported directly (it has an `export default` with
 * Cloudflare handlers and a `cloudflare:workers` runtime), so the module is
 * read, its handler block stripped, and the pure functions re-exported. That is
 * a little unusual, but it tests the real source rather than a copy of it.
 *
 * Run: npm test
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let src = readFileSync(join(root, 'worker/generator.js'), 'utf8');
src = src.replace(/^export default \{[\s\S]*$/m, '');
src += '\nexport { scoreDocument, salvageTruncatedJson, slugify, REGION_TERMS, BASE_SCORE, TOPICAL_SCORE };\n';
const scratch = mkdtempSync(join(tmpdir(), 'pw-test-'));
const modPath = join(scratch, 'generator.mjs');
writeFileSync(modPath, src);
const m = await import(modPath);

let failed = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };

console.log('\nscoreDocument — the outage that made these tests exist\n');

test('an OFAC blocking notice is publishable somewhere', () => {
  // Verbatim shape of the commonest Treasury/OFAC Federal Register notice.
  // Its prose says "blocked" and "Office of Foreign Assets Control", never
  // "sanction", and it names no country — so it used to score 0 eight times.
  const doc = {
    title: 'Blocking or Unblocking of Persons and Properties',
    text: "The Department of the Treasury's Office of Foreign Assets Control (OFAC) is publishing the names of one or more persons whose property and interests in property are blocked pursuant to Executive Order 13224, Persons Who Commit, Threaten To Commit, or Support Terrorism."
  };
  const best = Math.max(...Object.keys(m.REGION_TERMS).map(r => m.scoreDocument({ ...doc }, r)));
  assert(best >= m.TOPICAL_SCORE, `best score was ${best}, below the topical bar`);
});

test('a North Korea designation is topical somewhere', () => {
  const doc = {
    title: 'Notice of Determination Under Section 7031(c)',
    text: 'Designation of a North Korea (DPRK) official for gross violations of human rights. Nonproliferation and arms control implications.'
  };
  const best = Math.max(...Object.keys(m.REGION_TERMS).map(r => m.scoreDocument({ ...doc }, r)));
  assert(best >= m.TOPICAL_SCORE, `best score was ${best}`);
});

test('an export-controls rule is topical somewhere', () => {
  const doc = {
    title: 'Additions to the Entity List',
    text: 'The Bureau of Industry and Security amends the Export Administration Regulations by adding entities to the Entity List.'
  };
  const best = Math.max(...Object.keys(m.REGION_TERMS).map(r => m.scoreDocument({ ...doc }, r)));
  assert(best >= m.TOPICAL_SCORE, `best score was ${best}`);
});

test('a ceremonial proclamation is still hard-rejected', () => {
  assert(m.scoreDocument({ title: 'National Dairy Month, 2026', text: 'proclamation honoring dairy farmers' }, 'Trade') === -1);
});

test('a purely domestic notice is still rejected', () => {
  assert(m.scoreDocument({ title: 'Rural Broadband Grant Program', text: 'A funding opportunity for rural broadband deployment in county service areas.' }, 'Trade') === -1);
});

test('a Russia story still scores highest for Russia', () => {
  const doc = { title: 'Treasury Sanctions Russian Shadow Fleet Operators', text: 'Moscow, Ukraine, oil price cap evasion.' };
  const scores = Object.fromEntries(Object.keys(m.REGION_TERMS).map(r => [r, m.scoreDocument({ ...doc }, r)]));
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  assert(winner === 'Russia', `filed under ${winner}, scores ${JSON.stringify(scores)}`);
});

console.log('\nsalvageTruncatedJson\n');

test('a balanced object followed by prose is recovered, not discarded', () => {
  const payload = JSON.stringify({ title: 'A Real Headline Here', body: 'x'.repeat(500) }) + '\n\nHope that helps!';
  assert(m.salvageTruncatedJson(payload)?.title === 'A Real Headline Here');
});

test('a body too short to be an article is refused so the caller retries', () => {
  assert(m.salvageTruncatedJson(JSON.stringify({ title: 'T', body: 'too short' })) === null);
});

test('a genuinely truncated body is cut back to the paragraph break', () => {
  const payload = '{"title":"Treasury Designates Three Shipping Firms","body":"' + 'a'.repeat(600) + '\\n\\n' + 'b'.repeat(300);
  const out = m.salvageTruncatedJson(payload);
  assert(out, 'nothing salvaged');
  assert(out.body.length >= 600, 'body was cut too aggressively');
  assert(!out.body.includes('bbb'), 'the severed paragraph was kept');
});

test('a truncation landing in a LATER field does not amputate the body', () => {
  // The old implementation searched the whole payload for the last paragraph
  // break, so a cut inside meta_description chopped body back to its first
  // paragraph and still parsed cleanly — a silent, invisible truncation.
  const body = 'para one'.padEnd(300, '.') + '\\n\\n' + 'para two'.padEnd(300, '.');
  const payload = `{"title":"Some Headline","body":"${body}","meta_description":"a partial senten`;
  const out = m.salvageTruncatedJson(payload);
  assert(out, 'nothing salvaged');
  assert(out.body.length > 550, `body was amputated to ${out.body.length} chars`);
});

test('garbage returns null rather than throwing', () => {
  assert(m.salvageTruncatedJson('I am sorry, I cannot help with that.') === null);
  assert(m.salvageTruncatedJson(null) === null);
});

console.log(failed ? `\n${failed} test(s) failed\n` : '\nAll tests passed.\n');
process.exit(failed ? 1 : 0);
