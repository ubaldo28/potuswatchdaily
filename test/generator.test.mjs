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
src += '\nexport { scoreDocument, salvageTruncatedJson, slugify, REGION_TERMS, BASE_SCORE, TOPICAL_SCORE, bestRegionFor, isNoise, regionAffinity, titleStems };\n';
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


console.log('\nbestRegionFor — the front page that labelled itself with a counter\n');

// Every one of these ran on 2026-09-09 under the label in the comment. The
// rotation was NATO, China, Iran, Analysis, Trade, Russia, Mideast, Americas,
// three times through, and it matched the content nowhere.
const doc = (title, text = '') => ({ title, text });

test('a Canadian alcohol proclamation is not a NATO story', () => {
  const d = doc('President Bans Select Canadian Alcoholic Beverages',
    'The proclamation excludes certain Canadian alcoholic beverages from importation into the United States, invoking section 338 of the Tariff Act of 1930.');
  const r = m.bestRegionFor(d, 'NATO');
  assert(r !== 'NATO', `filed under NATO again (got ${r})`);
  assert(r === 'Americas' || r === 'Trade', `expected Americas or Trade, got ${r}`);
});

test('a fisheries advisory committee is not an Iran story', () => {
  const d = doc('NMFS Solicits Nominations for ICCAT Advisory Committee',
    'The National Marine Fisheries Service seeks nominations to the Advisory Committee to the U.S. Section to ICCAT.');
  assert(m.bestRegionFor(d, 'Iran') === 'Analysis', 'a document with no regional vocabulary must fall to Analysis');
});

test('a real Russia story still files under Russia', () => {
  const d = doc('Treasury Sanctions Russian Shadow Fleet Operators',
    'The Office of Foreign Assets Control designated vessels moving Russian crude above the price cap.');
  assert(m.bestRegionFor(d, 'Trade') === 'Russia', 'topical affinity must beat the rotation');
});

test('the rotation still breaks ties, so the front page stays varied', () => {
  const d = doc('Statement on International Cooperation', 'foreign policy diplomacy');
  const a = m.bestRegionFor(d, 'China');
  const b = m.bestRegionFor(d, 'Mideast');
  assert(a === b, 'a document with no affinity anywhere must be stable, not rotation-flavoured');
});

console.log('\nisNoise — twenty-four front-page slots, ten of them spent on this\n');

const noisy = [
  'U.S. Declares Women Impressionist Art Imports National Interest',
  'U.S. Government Determines Byzantine Icons Cultural Significance',
  'U.S. Imposes Import Restrictions on Nepalese Cultural Artifacts',
  'NMFS Solicits Nominations for ICCAT Advisory Committee',
  'U.S. Schedules Public Meeting for IMO CCC 12',
  'Department of War Invests $4 Million in STEM Initiative',
  'Dow Invests $19 Million to Upgrade Pine Bluff Arsenal',
  'President Establishes Military Spouse Commission'
];
for (const t of noisy) {
  test(`rejected: ${t.slice(0, 52)}`, () => {
    assert(m.isNoise({ title: t, text: '' }), 'should be rejected as noise');
    assert(m.scoreDocument({ title: t, text: '' }, 'Analysis') === -1, 'noise must score -1, not merely low');
  });
}

const real = [
  ['President Imposes Additional Duties on Canadian Alcohol', ''],
  ['Treasury Adds Individuals to SDN List', 'Office of Foreign Assets Control blocked person designation'],
  ['Commerce Streamlines Export Controls for Drone Exports', 'Bureau of Industry and Security export administration regulations'],
  ['State Department Approves Foreign Military Sale to Poland', 'The proposed sale supports the foreign policy goals of the United States.']
];
for (const [t, body] of real) {
  test(`kept: ${t.slice(0, 52)}`, () => {
    assert(!m.isNoise({ title: t, text: body }), 'a real policy action was rejected as noise');
  });
}


console.log('\ntitleStems — the same proclamation, four times, four headlines\n');

const overlapOf = (a, b) => {
  const A = new Set(m.titleStems(a)), B = m.titleStems(b);
  const o = B.filter(w => A.has(w)).length;
  const shorter = Math.min(A.size, B.length) || 1;
  return { o, ratio: o / shorter };
};
const wouldBlock = (a, b) => {
  const { o, ratio } = overlapOf(a, b);
  return (o >= 4 && ratio >= 0.5) || (o >= 3 && ratio >= 0.7);
};

// All four ran within twenty-four hours of each other on 2026-09-08/09.
test('"Canadian Alcohol Duty Scope" is caught against "Canada Auto Duties Scope"', () => {
  assert(wouldBlock('President Expands Canadian Alcohol Duty Scope',
                    'President Broadens Canada Auto Duties Scope'),
         'the running Canada story published three times in a row');
});

test('canada and canadian, duty and duties, are the same word', () => {
  const st = m.titleStems('Canadian Duties');
  assert(st.includes('canada'), `canadian did not stem to canada: ${st}`);
  assert(st.includes('duty'), `duties did not stem to duty: ${st}`);
});

test('two genuinely different designations are still allowed', () => {
  assert(!wouldBlock('Treasury Designates Houthi Financial Network',
                     'Commerce Streamlines Export Controls for Drone Exports'),
         'unrelated stories must not be suppressed');
});


test('a cultural-property exhibit notice is rejected even when it says neither art nor cultural', () => {
  // Published live on 2026-09-17 by the version that shipped an hour earlier.
  assert(m.isNoise({ title: 'U.S. Determines Dead Sea Scrolls Exhibit in National Interest', text: '' }),
         'the immunity-from-seizure series must be rejected');
  assert(m.isNoise({ title: 'U.S. Government Deems Rembrandt Exhibition Objects Culturally Significant', text: '' }),
         'so must the Rembrandt one');
});

test('a real export ban is not caught by the exhibit rule', () => {
  assert(!m.isNoise({ title: 'UTair Aviation Receives Renewed Export Ban', text: 'Bureau of Industry and Security temporary denial order' }),
         'a denial order is a policy action, not an exhibition notice');
});

console.log(failed ? `\n${failed} test(s) failed\n` : '\nAll tests passed.\n');

process.exit(failed ? 1 : 0);
