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
src = src.replace("from './email.js'", `from '${join(root, 'worker/email.js')}'`);
src = src.replace(/^export default \{[\s\S]*$/m, '');
src += '\nexport { scoreDocument, salvageTruncatedJson, slugify, REGION_TERMS, BASE_SCORE, TOPICAL_SCORE, bestRegionFor, isNoise, regionAffinity, titleStems, corroborating, fetchNews, fetchPrimarySources, reviewAndRevise, parseLooseJson, fixPlaceholderHeadings, cleanArtist, joinQuery };\n';
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

console.log('\nisNoise — administrative paperwork never leads\n');
test('a delegation-of-authority notice is noise', () => {
  assert(m.isNoise({ title: 'Delegation of Authority by the Secretary of State to the Official Performing the Duties of the Administrator of USAID', text: '' }));
});
test('a real tariff action is not noise', () => {
  assert(!m.isNoise({ title: 'Adjusting Imports of Steel Into the United States', text: '' }));
});

console.log('\nscoreDocument — thin and stale leads\n');
test('a title-only document can never lead', () => assert(m.scoreDocument({ title: 'Trade Sanctions on Iran', text: 'x', thinText: true }, 'Iran') === -1));
test('a three-month-old feed item can never lead', () => assert(m.scoreDocument({ title: 'Treasury sanctions on Iran oil', text: 'x'.repeat(400), date: new Date(Date.now() - 90*864e5).toUTCString() }, 'Iran') === -1));
test('a CSIS conference page is noise', () => assert(m.isNoise({ title: 'CSIS Hosts Defense360 Conference on FY2017 Budget', text: '' })));

console.log('\nweekly email — layout and scheduling\n');
const em = await import(join(root, 'worker/email.js'));
const sample = em.buildWeeklyEmail({
  stories: [{ title: 'President Bans Select Canadian Alcohol \u2014 Imports', slug: 'president-bans', excerpt: 'The White House announced a \u201Cban\u201D.' }],
  docs: [{ title: 'Inaugurating the Era of Super Intelligence', url: 'https://x/y', date: '2026-09-29', kind: 'EO 14434' }],
  review: { slug: 'week-in-us-foreign-policy-2026-10-04', title: 'Trade Week \u2014 Week of October 4, 2026', excerpt: 'A busy week.', body: '## What to Watch\n\n- Tariff deadline\n- UN vote' },
  date: new Date('2026-10-04T12:00:00Z'),
});
test('the email is pure ASCII so it survives any copy or encoding step', () => assert(!/[^\x00-\x7F]/.test(sample.html)));
test('the email carries the unsubscribe merge tag and no placeholder text', () => assert(sample.html.includes('{{{RESEND_UNSUBSCRIBE_URL}}}') && !/\[Mailing address/.test(sample.html)));
test('the email has no ads, affiliate links, sponsor or tip jar', () => assert(!/amzn|affiliate|sponsor|buymeacoffee|adsbygoogle/i.test(sample.html)));
test('the weekly review headline and what-to-watch items appear', () => assert(sample.html.includes('Trade Week') && sample.html.includes('Tariff deadline')));
const calls = [];
const realFetch = globalThis.fetch;
const fakeFetch = (replies) => async (url, init) => { calls.push([String(url), init?.method]); const r = replies.shift(); return { ok: r.ok, status: r.status ?? (r.ok ? 200 : 400), json: async () => r.body }; };
await (async () => {
  const noKey = await em.scheduleWeeklyBroadcast({}, sample, '2099-01-01T14:00:00Z');
  test('without a Resend key nothing is attempted', () => assert(noKey.status === 'skipped' && noKey.reason === 'no-resend-key'));
  globalThis.fetch = fakeFetch([{ ok: true, body: { id: 'b1' } }, { ok: true, body: { id: 'b1' } }]);
  const ok = await em.scheduleWeeklyBroadcast({ RESEND_API_KEY: 'k', RESEND_SEGMENT_ID: 's' }, sample, '2099-01-01T14:00:00Z');
  test('a good run creates then schedules the broadcast', () => assert(ok.status === 'scheduled' && calls.length === 2 && calls[1][0].endsWith('/b1/send')));
  globalThis.fetch = fakeFetch([{ ok: true, body: { id: 'b2' } }]);
  const late = await em.scheduleWeeklyBroadcast({ RESEND_API_KEY: 'k', RESEND_SEGMENT_ID: 's' }, sample, '2000-01-01T14:00:00Z');
  test('a send time that has already passed is left as a draft, never sent', () => assert(late.status === 'draft'));
  globalThis.fetch = fakeFetch([{ ok: false, status: 422, body: { message: 'bad' } }]);
  const bad = await em.scheduleWeeklyBroadcast({ RESEND_API_KEY: 'k', RESEND_SEGMENT_ID: 's' }, sample, '2099-01-01T14:00:00Z');
  test('a Resend error is reported, not thrown', () => assert(bad.status === 'error' && bad.step === 'create'));
  const off = await em.scheduleWeeklyBroadcast({ RESEND_API_KEY: 'k', RESEND_SEGMENT_ID: 's', WEEKLY_EMAIL: 'off' }, sample, '2099-01-01T14:00:00Z');
  test('the off switch stops the send', () => assert(off.reason === 'switched-off'));
  globalThis.fetch = realFetch;
})();

console.log('\nphoto credits — clean names, valid URLs\n');
test('the Commons boilerplate sentence is reduced to a name', () => {
  assert(m.cleanArtist('This image or media was taken or created by Matt H. Wade . To see his entire portfolio, click here.') === 'Matt H. Wade', m.cleanArtist('This image or media was taken or created by Matt H. Wade . To see his entire portfolio, click here.'));
});
test('a linked artist name is used as is', () => assert(m.cleanArtist('<a href="//x">Frank Schulenburg</a>') === 'Frank Schulenburg'));
test('a second query string is joined with & not ?', () => assert(m.joinQuery('https://a/b.jpg?x=1', 'pw_src=commons') === 'https://a/b.jpg?x=1&pw_src=commons' && m.joinQuery('https://a/b.jpg', 'pw_src=commons') === 'https://a/b.jpg?pw_src=commons'));

console.log('\nfixPlaceholderHeadings — never publish the template\n');
test('bracketed placeholder headings are replaced with real ones', () => {
  const out = m.fixPlaceholderHeadings('## Key Facts\n\n- a\n\n## [Opening heading]\n\ntext\n\n## [Analysis heading]\n\ntext\n\n## [Implications heading]\n\ntext\n\n## What to Watch');
  assert(!/\[/.test(out) && /## What the Record Shows/.test(out) && /## Why It Matters/.test(out) && /## What Changes in Practice/.test(out) && /## Key Facts/.test(out) && /## What to Watch/.test(out), out);
});
test('real headings are left alone', () => {
  const b = '## Key Facts\n\n## Greer Sets Agenda\n\ntext';
  assert(m.fixPlaceholderHeadings(b) === b);
});

console.log('\nreviewAndRevise — the second pass against the sources\n');
const body = ('word '.repeat(900)).trim();
const mkEnv = (replies) => { let i = 0; return { AI: { run: async () => ({ response: replies[Math.min(i++, replies.length - 1)] }) } }; };
const draft = { title: 'Treasury Does A Thing', slug: 'treasury-thing', body };
await (async () => {
  const clean = await m.reviewAndRevise(mkEnv(['{"unsupported":[]}']), draft, 'src');
  test('a fully supported draft is published as written', () => assert(clean === draft));
  const junk = await m.reviewAndRevise(mkEnv(['not json at all']), draft, 'src', 2000);
  test('an unreadable verdict still publishes when the lead has real text', () => assert(junk === draft));
  const thin = await m.reviewAndRevise(mkEnv(['not json at all']), draft, 'src', 80);
  test('an unreadable verdict does NOT publish a draft built on a bare headline', () => assert(thin === null));
  const fixed = await m.reviewAndRevise(mkEnv([
    '{"unsupported":["invented figure"]}',
    JSON.stringify({ title: 'X', excerpt: 'e', meta_description: 'm', slug: 's', body }),
    '{"unsupported":[]}']), draft, 'src');
  test('a draft with unsupported claims is rewritten and the title is kept', () => assert(fixed && fixed.title === 'Treasury Does A Thing' && fixed.body === body));
  const bad = await m.reviewAndRevise(mkEnv([
    '{"unsupported":["a","b"]}',
    JSON.stringify({ title: 'X', excerpt: 'e', meta_description: 'm', slug: 's', body }),
    '{"unsupported":["a","b","c"]}']), draft, 'src');
  test('a draft that still fails after revision is dropped', () => assert(bad === null));
})();

console.log('\ncorroborating — is the wider press covering the same event\n');
test('a document is corroborated by a news item about the same event', () => {
  const doc = { title: 'Treasury Sanctions Iranian Shipping Network Over Oil Exports', text: 'OFAC sanctions on Iranian shipping firms exporting oil to China.' };
  const news = [
    { title: 'US sanctions Iranian shipping firms over oil exports to China', text: 'Treasury announced sanctions.' },
    { title: 'Cricket: England win the toss', text: 'Sport.' },
  ];
  const hit = m.corroborating(doc, news);
  assert(hit.length === 1 && /Iranian shipping/.test(hit[0].title), `got ${hit.length}`);
});
test('an unrelated news item does not corroborate', () => {
  const doc = { title: 'Proclamation on Flag Display', text: 'Flags at half staff.' };
  assert(m.corroborating(doc, [{ title: 'Iran nuclear talks resume', text: 'Geneva.' }]).length === 0);
});

console.log('\nscoreDocument — the outage that made these tests exist\n');

test('an OFAC blocking notice is rejected as a routine listing', () => {
  // Verbatim shape of the commonest Treasury/OFAC Federal Register notice.
  // Its prose says "blocked" and "Office of Foreign Assets Control", never
  // "sanction", and it names no country — so it used to score 0 eight times.
  const doc = {
    title: 'Blocking or Unblocking of Persons and Properties',
    text: "The Department of the Treasury's Office of Foreign Assets Control (OFAC) is publishing the names of one or more persons whose property and interests in property are blocked pursuant to Executive Order 13224, Persons Who Commit, Threaten To Commit, or Support Terrorism."
  };
  // Reversed deliberately: these were once forced to publish, and a feed of
  // them is the scaled-content pattern AdSense rejects. They are never leads.
  const best = Math.max(...Object.keys(m.REGION_TERMS).map(r => m.scoreDocument({ ...doc }, r)));
  assert(best === -1, `best score was ${best}, expected a hard reject`);
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
