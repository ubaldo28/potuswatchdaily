/**
 * POTUS Watch — hourly article generator (Cloudflare Worker, Cron Trigger).
 *
 * Ported from the retired Railway/Express service. That process, its NewsAPI
 * source and its Anthropic generation path are all gone; this Worker is the
 * whole generator.
 *
 * No axios (its Node http adapter does not work on Workers), no express,
 * no dotenv, no @supabase/supabase-js. Everything is plain fetch().
 * Supabase is reached over its PostgREST HTTP API directly.
 *
 * Secrets come from Worker env bindings:
 *   UNSPLASH_ACCESS_KEY, SUPABASE_URL, SUPABASE_KEY
 * Optional:
 *   RUN_TOKEN  — if set, enables POST /run?token=... to fire a generation by hand.
 */

// ── Config ───────────────────────────────────────────────────────────────────
const regions = ['Iran', 'China', 'NATO', 'Americas', 'Mideast', 'Russia', 'Trade', 'Analysis'];

const imageQueries = {
  Iran:['iran diplomacy politics','tehran nuclear negotiations','persian gulf military','iran flag politics','middle east sanctions'],
  China:['china beijing diplomacy','xi jinping summit','south china sea military','china us relations','beijing government'],
  NATO:['nato military alliance europe','european defense summit','ukraine war military','nato headquarters brussels','transatlantic alliance'],
  Americas:['washington dc capitol','white house diplomacy','us congress foreign policy','state department washington','american foreign policy'],
  Mideast:['middle east diplomacy','israel gaza conflict','saudi arabia oil politics','gulf states diplomacy','arab league summit'],
  Russia:['moscow kremlin russia','putin diplomacy','russia ukraine war','eastern europe military','russian foreign policy'],
  Trade:['global trade economy shipping','container ships port','world trade organization','tariffs trade war','global supply chain'],
  Analysis:['united nations diplomacy world','global summit leaders','international relations diplomacy','foreign policy strategy','world leaders summit']
};

const INDEXNOW_KEY = 'e7d7dce91b634bc5bf610ae2367c52c7';
const SITE_HOST = 'www.potuswatchdaily.com';

// Defensive cap on the similarity query. Under hourly generation a 48h window
// holds at most ~48 rows, so this can never bind in normal operation; it exists
// only so a backfilled table cannot blow the 10ms free-plan CPU budget.
const SIMILARITY_ROW_CAP = 500;

// ── Small helpers ─────────────────────────────────────────────────────────────
function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-')
    .replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Constant-time string compare, so a token cannot be brute-forced byte by byte. */
function timingSafeEqual(a, b) {
  const A = new TextEncoder().encode(String(a));
  const B = new TextEncoder().encode(String(b));
  if (A.length !== B.length || A.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < A.length; i++) diff |= A[i] ^ B[i];
  return diff === 0;
}

/** Trim a trailing slash so we never build a URL with a double slash. */
function sbBase(env) {
  return String(env.SUPABASE_URL || '').replace(/\/+$/, '');
}

/**
 * Minimal PostgREST client. Replaces @supabase/supabase-js.
 * `path` is everything after /rest/v1/, e.g. "articles?select=title&limit=1".
 */
async function sb(env, path, init = {}) {
  const url = `${sbBase(env)}/rest/v1/${path}`;
  const key = String(env.SUPABASE_KEY || '');
  // Supabase has two key formats. A legacy key is a JWT and PostgREST reads the
  // role out of it, so it has to arrive as a Bearer token. A new-style key
  // (sb_secret_… / sb_publishable_…) is an opaque string: sending it as a Bearer
  // token makes PostgREST try to parse it as a JWT and reject the request, so it
  // goes in `apikey` alone. Detect by shape rather than prefix — a JWT is three
  // dot-separated base64 segments.
  const isJwt = key.split('.').length === 3;
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      ...(isJwt ? { Authorization: `Bearer ${key}` } : {}),
      'Content-Type': 'application/json',
      ...(init.headers || {})
    },
    signal: AbortSignal.timeout(init.timeoutMs || 15000)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable>');
    throw new Error(`Supabase ${init.method || 'GET'} ${path} -> ${res.status}: ${body.slice(0, 500)}`);
  }
  // Inserts use Prefer: return=minimal and come back 201 with an empty body.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Unsplash image ────────────────────────────────────────────────────────────
// Words that carry no visual meaning, so they are stripped before the image
// search. Without this the query is dominated by "President", "Department" etc.
const IMAGE_STOPWORDS = new Set([
  // grammar
  'the','a','an','and','or','of','for','to','in','on','with','as','at','by','over','under','after',
  'before','amid','ahead','into','from','against','across','toward','towards','via','its','his','her',
  // counts and ordinals
  'one','two','three','four','five','six','seven','eight','nine','ten','first','second','third','new',
  // institutional filler
  'president','administration','department','office','secretary','united','states','us','american',
  'federal','notice','rule','licenses','license','general','further','act','order','plan','policy',
  // verbs - none of these are photographable
  'announces','announced','publishes','published','issues','issued','declares','declared','orders',
  'ordered','directs','directed','designates','designated','expands','expanded','extends','extended',
  'imposes','imposed','targets','targeted','restricts','restricted','tightens','tightened','approves',
  'approved','agrees','agree','agreed','signs','signed','weaponizes','establishes','established',
  'proclaims','proclaimed','secures','secured','faces','seeks','moves','sets'
]);

// U.S. Department of War lead-photo feed. Public domain under 17 U.S.C. 105:
// no licence, no attribution requirement, no API key, no rate limit. When a
// photo genuinely matches the story this beats any stock image, because it is
// an actual photograph of the subject rather than a mood shot.
// war.gov answers 403 to "potuswatch-generator/1.0" and 200 to a browser, so
// every article has been publishing with no image at all. Nothing here is
// pretending to be a person: the contact URL is still in the string, which is
// what the polite-crawler convention actually asks for. It is sent on every
// outbound fetch because the same WAF sits in front of the feeds too.
const UA = 'Mozilla/5.0 (compatible; potuswatch-generator/1.0; +https://www.potuswatchdaily.com)';
const FETCH_HEADERS = {
  'User-Agent': UA,
  'Accept': 'application/rss+xml, application/xml, text/xml, application/json;q=0.9, */*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
};

const GOV_PHOTO_FEED = 'https://www.war.gov/desktopmodules/imagegallery/dgovfeeds/leadphotos.ashx?SMPI=1096&ModuleId=579&TabId=131';

/**
 * Look for a government photo whose title or caption overlaps the article's
 * subject. Returns a URL only on a real keyword match — a random military photo
 * on an unrelated story would be no better than random stock.
 */
async function getGovImagePair(titleWords) {
  if (!titleWords.length) return null;
  try {
    const r = await fetch(GOV_PHOTO_FEED, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();

    const items = (xml.match(/<item[\s\S]*?<\/item>/gi) || []).map(b => {
      const title = stripHtml(pickTag(b, 'title'));
      const desc = stripHtml(pickTag(b, 'description'));
      const m = b.match(/https:\/\/media\.defense\.gov\/[^\s"'<>]+\.(?:JPG|jpg|jpeg|png)/);
      return { title, desc, url: m ? m[0] : '' };
    }).filter(i => i.url);

    let best = null;
    for (const it of items) {
      const hay = `${it.title} ${it.desc}`.toLowerCase();
      const score = titleWords.filter(w => hay.includes(w)).length;
      if (score > 0 && (!best || score > best.score)) best = { ...it, score };
    }
    if (!best) return null;

    // The feed serves 600x400; ask for a larger render for the hero. Both
    // renditions are the SAME photograph, which is the whole point.
    const credit = `?pw_src=gov&pw_by=${encodeURIComponent('U.S. Department of War')}&pw_at=${encodeURIComponent('https://www.war.gov')}`;
    console.log(`[image] gov photo matched (${best.score}): "${best.title}"`);
    return {
      hero:  best.url.replace(/\/600\/400\//, '/1200/800/') + credit,
      thumb: best.url + credit
    };
  } catch (e) {
    console.warn('[image] gov photo lookup failed:', e.message);
    return null;
  }
}

/**
 * Build an image query from the article's own subject rather than a canned
 * per-region list. A stock photo can never truly depict a Federal Register
 * notice, but "iran sanctions" beats a random "persian gulf military" shot.
 */
function titleKeywords(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !IMAGE_STOPWORDS.has(w));
}

function imageQueryFor(title, region) {
  const words = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !IMAGE_STOPWORDS.has(w));

  // News headlines put the actor first and the object last, and the middle is
  // usually the verb. Take the first word plus the final two.
  const picked = [...new Set([words[0], ...words.slice(-2)].filter(Boolean))].slice(0, 3);
  const fromTitle = picked.join(' ').trim();
  if (fromTitle.length >= 6) return fromTitle;

  const fallback = imageQueries[region] || ['politics world diplomacy'];
  return fallback[Math.floor(Math.random() * fallback.length)];
}

/**
 * The building, body or capital the document actually came from. Ordered most
 * specific first: the issuing agency beats the region, because "Department of
 * the Treasury" is a fact about the document and "Iran" is an inference.
 */
const IMAGE_SUBJECTS = [
  [/treasury|ofac|foreign assets control|sdn list/i,        'United States Department of the Treasury building Washington'],
  [/white house|proclamation|executive order|president/i,   'White House north facade Washington'],
  [/state department|department of state|secretary of state|consular|visa/i, 'Harry S Truman Building Washington'],
  [/commerce|antidumping|countervailing|bureau of industry|export administration/i, 'Herbert C. Hoover Building Washington'],
  [/pentagon|defense|defence|department of war|military/i,  'The Pentagon aerial view'],
  [/united nations|secretary-general|security council/i,    'United Nations Headquarters New York'],
  [/trade representative|wto|world trade/i,                 'World Trade Organization headquarters Geneva'],
  [/homeland security|customs|border protection/i,          'United States Customs and Border Protection port of entry']
];

const REGION_IMAGE_SUBJECTS = {
  Iran:     'Ministry of Foreign Affairs Tehran building',
  China:    'Great Hall of the People Beijing',
  NATO:     'NATO Headquarters Brussels building',
  Americas: 'Organization of American States building Washington',
  Mideast:  'Arab League headquarters Cairo',
  Russia:   'Moscow Kremlin Senate building',
  Trade:    'container ship port of Los Angeles',
  Analysis: 'United States Capitol Washington'
};

/**
 * A freely licensed photograph from Wikimedia Commons of whatever institution
 * the document came from. No API key, no rate limit worth worrying about at one
 * article an hour, and the URLs come back from the API itself so they cannot be
 * a stale hardcoded guess.
 *
 * Both renditions are the same photograph at two widths -- Commons thumbnail
 * URLs carry the width in the path, so the 600px card is a string edit rather
 * than a second lookup.
 */
async function getCommonsImagePair(region, title, source) {
  const hay = `${title || ''} ${source || ''}`;
  let query = null;
  for (const [re, subject] of IMAGE_SUBJECTS) {
    if (re.test(hay)) { query = subject; break; }
  }
  if (!query) query = REGION_IMAGE_SUBJECTS[region] || REGION_IMAGE_SUBJECTS.Analysis;

  try {
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    u.searchParams.set('action', 'query');
    u.searchParams.set('format', 'json');
    u.searchParams.set('formatversion', '2');
    u.searchParams.set('generator', 'search');
    u.searchParams.set('gsrsearch', `${query} filetype:bitmap`);
    u.searchParams.set('gsrnamespace', '6');       // File:
    u.searchParams.set('gsrlimit', '8');
    u.searchParams.set('prop', 'imageinfo');
    u.searchParams.set('iiprop', 'url|extmetadata');
    u.searchParams.set('iiurlwidth', '1200');

    const r = await fetch(u, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    const pages = data?.query?.pages || [];
    for (const page of pages) {
      const info = page?.imageinfo?.[0];
      const thumb = info?.thumburl;
      // Landscape only. A portrait crop in a 16:9 hero slot looks like a
      // mistake, and on this layout it is one.
      if (!thumb || !info.thumbwidth || !info.thumbheight) continue;
      if (info.thumbwidth < info.thumbheight * 1.2) continue;

      const artist = stripHtml(info.extmetadata?.Artist?.value || '').trim().slice(0, 80);
      const credit = `?pw_src=commons&pw_by=${encodeURIComponent(artist || 'Wikimedia Commons')}` +
                     `&pw_at=${encodeURIComponent(info.descriptionurl || 'https://commons.wikimedia.org')}`;

      console.log(`[image] commons "${query}" -> ${page.title}`);
      return {
        hero:  thumb + credit,
        thumb: thumb.replace('/1200px-', '/600px-') + credit
      };
    }
    console.warn(`[image] commons "${query}" returned nothing landscape.`);
    return null;
  } catch (e) {
    console.warn('[image] commons lookup failed:', e.message);
    return null;
  }
}

/**
 * One photograph, resolved once, returned in both renditions the site needs:
 * a 1200px hero and a 600px card. This used to be two independent calls, which
 * on the Unsplash path returned two unrelated random photographs -- the card
 * and the hero showed different things -- and fetched and re-scanned the
 * government photo feed twice for an identical answer.
 *
 * Attribution and the download trigger are both REQUIRED by the Unsplash API
 * Guidelines.
 */
async function getImagePair(env, region, title, source = '') {
  // Prefer public-domain U.S. government photography when it actually matches
  // the story.
  const gov = await getGovImagePair(titleKeywords(title));
  if (gov) return gov;

  // Then Wikimedia Commons, keyed on the institution that issued the document.
  // Every article on 2026-09-09 -- all twenty-four of them -- published with no
  // image at all, because the defence photo feed only ever matches a defence
  // photo and there was no Unsplash key. A stock photograph of a container ship
  // was never going to depict an antidumping determination anyway; a photograph
  // of the Treasury building on a Treasury designation is what a wire service
  // would run, and it is true.
  const commons = await getCommonsImagePair(region, title, source);
  if (commons) return commons;

  // No key means no Unsplash. It used to call anyway with "Client-ID
  // undefined" and log an authentication failure on every single article --
  // noise that made a missing optional key look like a broken integration.
  if (!env.UNSPLASH_ACCESS_KEY) return { hero: '', thumb: '' };

  try {
    const query = imageQueryFor(title, region);
    const u = new URL('https://api.unsplash.com/photos/random');
    u.searchParams.set('query', query);
    u.searchParams.set('orientation', 'landscape');
    u.searchParams.set('content_filter', 'high');

    const r = await fetch(u, {
      headers: { ...FETCH_HEADERS, Authorization: 'Client-ID ' + env.UNSPLASH_ACCESS_KEY },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) throw new Error(`Unsplash ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = await r.json();
    console.log(`[image] query "${query}" -> ${data.user?.name || 'unknown'}`);

    // Awaited, not fire-and-forget: an unawaited fetch with no ctx.waitUntil()
    // is cancelled when the handler returns, so the download event the
    // Guidelines require was being dropped much of the time.
    if (data.links?.download_location) {
      await fetch(data.links.download_location, {
        headers: { Authorization: 'Client-ID ' + env.UNSPLASH_ACCESS_KEY },
        signal: AbortSignal.timeout(5000)
      }).catch(() => {});
    }

    // Attribution rides in the URL because the articles table has no column for
    // it. Unsplash ignores unrecognised query params, and the article page
    // parses these back out to render the required credit line.
    const raw = data.urls.raw;
    const name = data.user?.name;
    const link = data.user?.links?.html;
    const credit = (name && link)
      ? `&pw_src=unsplash&pw_by=${encodeURIComponent(name)}&pw_at=${encodeURIComponent(link)}`
      : '';

    return {
      hero:  `${raw}&w=1200&q=85&fit=crop${credit}`,
      thumb: `${raw}&w=600&q=75&fit=crop${credit}`
    };
  } catch (e) {
    console.warn('[image] Unsplash lookup failed:', e.message);
    return { hero: '', thumb: '' };
  }
}

// ── Title similarity check ────────────────────────────────────────────────────
/**
 * URLs of the primary documents used in the last 5 days, so the same executive
 * order is not written up twice. Title similarity alone does not catch this:
 * two articles about one EO can easily differ by four words.
 */
async function recentlyUsedSourceUrls(env) {
  try {
    const since = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await sb(env, `articles?select=sources&published_at=gte.${encodeURIComponent(since)}&order=published_at.desc&limit=${SIMILARITY_ROW_CAP}`);
    const used = new Set();
    for (const r of rows || []) {
      try {
        for (const src of JSON.parse(r.sources || '[]')) {
          // Only the document an article was actually ABOUT counts as covered.
          // Supporting documents are cited, not written up, and marking them
          // covered burned three extra documents an hour out of the same pool
          // this function reads back -- roughly 480 documents consumed to
          // produce 120 articles, which is what emptied the pool overnight.
          // Rows written before the flag existed have no flag; treat those as
          // covered, so history is not suddenly reopened.
          if (src?.url && src.lead !== false) used.add(src.url);
        }
      } catch (pe) {
        console.error(`[sources] Malformed sources cell (id ${r.id ?? '?'}): ${pe.message}`);
      }
    }
    console.log(`[sources] ${used.size} documents already covered in the last 5 days.`);
    return used;
  } catch (e) {
    // Do NOT return an empty Set. Empty means "nothing is covered", which is
    // indistinguishable from "I could not find out what is covered", and the
    // caller will cheerfully republish a document it wrote up an hour ago.
    console.error('[sources] Could not load recent source URLs:', e.message);
    throw new Error(`Deduplication unavailable (${e.message}); refusing to publish blind.`);
  }
}

// Headline words reduced to something that survives a rewrite. The generator
// writes its own headlines, so the same underlying proclamation came back as
// "President Bans Select Canadian Alcoholic Beverages", "President Broadens
// Canada Auto Duties Scope" and "President Expands Canadian Alcohol Duty
// Scope" on three consecutive hours -- three headlines that share almost no
// exact words and are obviously one story. Crude suffix stripping is enough to
// make canada/canadian and duty/duties the same token, which is all that was
// needed to see it.
const TITLE_STOPWORDS = new Set([
  'the','and','for','with','from','that','this','into','over','after','under',
  'new','more','than','its','has','have','will','announces','announce','issues',
  'issue','says','said','amid','about','government','united','states','american'
]);

function titleStems(title) {
  return [...new Set(
    String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !TITLE_STOPWORDS.has(w))
      .map(w => w
        .replace(/ies$/, 'y')       // duties  -> duty
        .replace(/ian$/, 'a')       // canadian -> canada
        .replace(/(ing|ed|es|s)$/, '')
        .replace(/ic$/, '')         // alcoholic -> alcohol
        .slice(0, 6))
      .filter(w => w.length > 2)
  )];
}

async function isTooSimilar(env, newTitle) {
  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const data = await sb(env, `articles?select=title&published_at=gte.${encodeURIComponent(since)}&order=published_at.desc&limit=${SIMILARITY_ROW_CAP}`);
    if (!data || !data.length) return false;

    const fresh = new Set(titleStems(newTitle));
    for (const row of data) {
      const existing = titleStems(row.title);
      const overlap = existing.filter(w => fresh.has(w)).length;
      const shorter = Math.min(existing.length, fresh.size) || 1;
      const ratio = overlap / shorter;
      // Four shared subject words, or three that make up most of the headline.
      // A false positive here costs nothing: the caller simply writes about the
      // next candidate document, which is already fetched and already paid for.
      if ((overlap >= 4 && ratio >= 0.5) || (overlap >= 3 && ratio >= 0.7)) {
        console.log(`[similarity] Too similar to: "${row.title}" (${overlap} shared subject words, ${Math.round(ratio * 100)}%)`);
        return true;
      }
    }
    return false;
  } catch (e) {
    // Fail CLOSED. This is the last guard against publishing the same story
    // twice, and treating an unreachable database as "not similar" is the one
    // outcome worse than skipping.
    console.error('[similarity] Check failed, treating as duplicate:', e.message);
    return true;
  }
}

// ── Round-robin region selector ───────────────────────────────────────────────
async function getNextRegion(env) {
  try {
    const data = await sb(env, 'articles?select=region&order=id.desc&limit=1');
    const lastRegion = data?.[0]?.region || null;
    const lastIndex = lastRegion ? regions.indexOf(lastRegion) : -1;
    return regions[(lastIndex + 1) % regions.length];
  } catch (e) {
    console.warn('[region] Round-robin failed, using random:', e.message);
    return regions[Math.floor(Math.random() * regions.length)];
  }
}

// ── Primary sources ───────────────────────────────────────────────────────────
// Replaces NewsAPI. Two reasons, both serious:
//
//  1. LICENSING. NewsAPI's Developer plan is free but its terms state it "may be
//     used for development and testing in a development environment only, and
//     cannot be used in a staging or production environment". This site is live
//     and ad-monetised, so that usage was a breach. The paid cure is $449/month.
//
//  2. ORIGINALITY. Rewriting other outlets' headlines is close to Google's
//     definition of scaled content abuse. US government works are public domain
//     (17 U.S.C. 105) — no licence, no key, no attribution obligation — and the
//     White House feed carries the FULL TEXT of each presidential action. An
//     analysis grounded in the actual text of an executive order is original
//     commentary; a rewrite of five Reuters headlines is not.
//
// Everything here is keyless and free.

const RSS_SOURCES = [
  {
    id: 'whitehouse-actions',
    name: 'White House Presidential Actions',
    url: 'https://www.whitehouse.gov/presidential-actions/feed/',
    regions: ['Americas', 'Analysis', 'Trade', 'China', 'Iran', 'Russia', 'NATO', 'Mideast'],
    weight: 3   // full document text — the most valuable input we have
  },
  {
    id: 'war-releases',
    name: 'U.S. Department of War Releases',
    url: 'https://www.war.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=9&Site=945&max=10',
    regions: ['NATO', 'Russia', 'Mideast', 'China', 'Analysis'],
    weight: 2
  },
  {
    id: 'un-press',
    name: 'UN Meetings Coverage and Press Releases',
    url: 'https://press.un.org/en/rss.xml',
    regions: ['Mideast', 'Russia', 'Iran', 'Analysis', 'NATO'],
    weight: 2
  },
  {
    id: 'eu-council',
    name: 'Council of the European Union Press Releases',
    url: 'https://www.consilium.europa.eu/en/rss/pressreleases.ashx',
    regions: ['NATO', 'Russia', 'Trade', 'Analysis'],
    weight: 2
  }
];

// Federal Register agency slugs per region. Keyless JSON API, no rate limit.
const FR_AGENCIES = {
  Americas: ['state-department', 'homeland-security-department'],
  China:    ['commerce-department', 'treasury-department'],
  NATO:     ['defense-department', 'state-department'],
  Iran:     ['treasury-department', 'state-department'],
  Mideast:  ['state-department', 'treasury-department'],
  Russia:   ['treasury-department', 'commerce-department'],
  Trade:    ['commerce-department', 'trade-representative-office-of-united-states'],
  Analysis: ['state-department', 'treasury-department']
};

// Topical scoring. Without this the White House feed — which is in every
// region's source list and carries the heaviest weight — always won the lead
// slot, so a flag-half-staff proclamation got filed under "Russia".
// A document that clears the foreign-policy gate is publishable SOMEWHERE.
// BASE_SCORE is what such a document is worth with no region-term hit at all;
// TOPICAL_SCORE is the bar for "this really is a <region> story".
const BASE_SCORE = 1;
const TOPICAL_SCORE = 2;

// These lists were written before FOREIGN_POLICY_TERMS and never reconciled
// with it. Eighteen of the forty-two gate terms -- 'korea', 'visa', 'missile',
// 'embassy', 'export', 'terrorism' among them -- appeared in no region list at
// all, so a document could pass the gate and then score zero for all eight
// regions. The standard OFAC blocking notice does exactly that: its prose says
// "blocked", "designated" and "Office of Foreign Assets Control", never
// "sanction", and it names no country. On 2026-09-05 that produced nine
// consecutive hours of "all regions exhausted" with forty uncovered documents
// sitting in the pool.
//
// Note the inverted agency names: government prose is always "Department of
// State", never "state department", so that term never fired either.
const REGION_TERMS = {
  Americas: ['mexico','canada','brazil','venezuela','colombia','cuba','haiti','hemisphere','border','migration','cartel','western hemisphere','latin america','panama','argentina',
             'immigration','visa','refugee','asylum','consular','organization of american states'],
  China:    ['china','chinese','beijing','xi jinping','taiwan','hong kong','indo-pacific','south china sea','prc','semiconductor','huawei','tariff on china',
             'entity list','export administration','advanced computing','xinjiang','uyghur','bureau of industry'],
  NATO:     ['nato','alliance','article 5','baltic','poland','germany','france','united kingdom','norway','allied','transatlantic','european defence','european defense','burden-sharing',
             'sweden','finland','netherlands','italy','spain','turkey','arms transfer','foreign military sale','munitions'],
  Iran:     ['iran','iranian','tehran','irgc','nuclear','enrichment','hormuz','houthi','proxy','jcpoa','snapback',
             'ballistic','missile','centrifuge','maximum pressure','tanker'],
  Mideast:  ['israel','gaza','palestin','saudi','yemen','syria','lebanon','iraq','jordan','egypt','qatar','uae','emirates','hezbollah','hamas','abraham accords','middle east','afghan',
             'red sea','bab el-mandeb','arms sale','foreign military sale'],
  Russia:   ['russia','russian','moscow','putin','ukraine','kyiv','kremlin','wagner','belarus','black sea','donbas','oil price cap',
             'sanctions evasion','price cap','shadow fleet','oligarch','export administration'],
  Trade:    ['tariff','trade','export control','import','customs','wto','supply chain','sanction','duty','duties','trade agreement','commerce','economic security',
             'export administration','entity list','itar','arms regulations','bureau of industry','anti-dumping','antidumping','countervailing','section 301','harmonized tariff',
             'office of foreign assets control','department of commerce'],
  Analysis: ['foreign policy','national security','diplomacy','treaty','alliance','sanction','state department','secretary of state','geopolitic','defense','defence','security council',
             'department of state','department of the treasury','department of commerce','korea','north korea','dprk','terrorism','terrorist','weapon','missile','embassy','ambassador',
             'arms control','nonproliferation','proliferation','human rights','multilateral','united nations','visa','executive order',
             'office of foreign assets control','blocked person','designation']
};

// Anything foreign-policy-adjacent at all. A document that matches nothing here
// is domestic or ceremonial and has no business on this site.
const FOREIGN_POLICY_TERMS = [
  'foreign','international','national security','diplomat','treaty','alliance','ally','allied',
  'sanction','tariff','trade','export','import','embassy','ambassador','state department',
  'defense','defence','military','nato','united nations','security council','war','weapon',
  'nuclear','missile','terrorism','terrorist','border','immigration','visa','refugee',
  'china','russia','iran','israel','ukraine','taiwan','korea','venezuela','mexico','canada'
];

// Ceremonial and administrative proclamations. These are not policy documents:
// national observance days, flag orders, renamings, appointments.
const CEREMONIAL = /half-staff|half staff|national .{0,30}(day|week|month)\b|proclaim.{0,40}(day|week|month)\b|anniversary|in memory of|honoring the|renaming|rename|birthday|awareness (day|week|month)|greetings|observance/i;

// Documents that clear the foreign-policy gate on vocabulary alone and have no
// business being the lead story on a foreign-policy site. Every one of these
// was on the front page on 2026-09-09, taking a slot from something real:
// Byzantine icons, Nepalese artifacts, women Impressionists, an IMO shipping
// meeting, an ICCAT fisheries advisory committee, a $4M STEM grant, a military
// spouse commission and three defence contract awards. They pass because they
// contain the words "import", "international" and "military".
//
// Matched against the TITLE only. A body match would take out real stories that
// merely mention a committee in passing.
const NOISE_PATTERNS = [
  // State Department cultural-property and art-exhibition determinations.
  // Foreign, and about imports, and not foreign policy.
  /cultural (property|significance|exchange|import)|archaeolog|ethnolog|objects? of cultural|works? of art|art (import|exhibition)|impressionist|byzantine|sculpture|icons|artifact|antiquit|museum/i,
  // Procedural Federal Register furniture: the notice that a process exists.
  /advisory (committee|board|panel|group)|request for nominations|solicit\w* nominations|(public|open) meeting|notice of meeting|information collection|paperwork reduction|privacy act of 1974|records schedule|agency information/i,
  // Domestic spending, grants and contract awards.
  /\binvests? \$|\bawarded? (a )?\$|contract award|scholarship|internship|apprenticeship|spouse|\bcommission on\b/i,
  /\bSTEM\b/   // the acronym, not "stem the flow of"
];

// ...unless the document is one of the few procurement or licensing actions
// that genuinely IS foreign policy. A foreign military sale is an arms transfer
// with a dollar figure attached, and dropping it would be worse than the noise.
const NOISE_EXEMPT = /foreign military sale|arms transfer|arms sale|security assistance|export licen|munitions list|\bitar\b/i;

function isNoise(doc) {
  const title = String(doc.title || '');
  if (NOISE_EXEMPT.test(title + ' ' + String(doc.text || '').slice(0, 400))) return false;
  return NOISE_PATTERNS.some(re => re.test(title));
}

function scoreDocument(doc, region) {
  const title = (doc.title || '').toLowerCase();
  // Memoised on the document. This is called up to three times per document per
  // region, and in a bad hour that was ~1,280 calls each allocating a fresh 3 KB
  // lowercased copy -- tens of megabytes of string scanning inside a 10 ms CPU
  // budget, in precisely the hour that already had trouble.
  if (doc._lcBody === undefined) doc._lcBody = (doc.text || '').slice(0, 3000).toLowerCase();
  const body = doc._lcBody;

  if (CEREMONIAL.test(title)) return -1;                       // hard reject
  if (isNoise(doc)) return -1;                                 // hard reject

  const fpTitle = FOREIGN_POLICY_TERMS.some(t => title.includes(t));
  if (!fpTitle && !FOREIGN_POLICY_TERMS.some(t => body.includes(t))) return -1;

  const terms = REGION_TERMS[region] || REGION_TERMS.Analysis;
  // Baseline, not zero: anything that clears the foreign-policy gate is worth
  // publishing somewhere. A zero used to be indistinguishable from a hard
  // reject, which is how a pool full of documents produced no article.
  let score = BASE_SCORE;
  if (fpTitle) score += 1;
  for (const t of terms) {
    if (title.includes(t)) score += 5;   // the subject of the document
    else if (body.includes(t)) score += 1;
  }
  return score;
}

/**
 * How strongly a document matches ONE region's vocabulary, with the
 * foreign-policy baseline removed. scoreDocument answers "is this publishable",
 * which is deliberately generous; this answers "is this a China story", which
 * must not be.
 */
function regionAffinity(doc, region) {
  const title = (doc.title || '').toLowerCase();
  if (doc._lcBody === undefined) doc._lcBody = (doc.text || '').slice(0, 3000).toLowerCase();
  const body = doc._lcBody;
  let score = 0;
  for (const t of (REGION_TERMS[region] || [])) {
    if (title.includes(t)) score += 5;
    else if (body.includes(t)) score += 1;
  }
  return score;
}

/**
 * The region an article should be LABELLED with.
 *
 * The rotation picks a region and then hunts for a document to fill it. That is
 * the right way to keep the front page varied and the wrong way to name a
 * story, and on 2026-09-09 the front page showed exactly what that costs: a
 * Canadian alcohol proclamation filed under NATO, an EU Council agenda under
 * Russia, an IMO shipping meeting and a fisheries advisory committee both under
 * Iran -- twenty-four articles whose labels cycled NATO, China, Iran, Analysis,
 * Trade, Russia, Mideast, Americas, three times over. The label was a counter.
 * Any reader could see it.
 *
 * So the rotation keeps choosing which feeds to read first, which is what it is
 * good for, and this decides the name afterwards, from the document's own
 * words. Analysis is the honest answer when no region's vocabulary really
 * appears -- it is a section, not a dumping ground, and a fisheries committee
 * belongs there far more than it belongs in Iran.
 */
function bestRegionFor(doc, preferred) {
  let bestRegion = null;
  let bestScore = -1;
  for (const r of regions) {
    if (r === 'Analysis') continue;              // the fallback, never the winner
    const s = regionAffinity(doc, r);
    // Ties go to the rotation's choice, so variety survives wherever the text
    // genuinely does not distinguish between two regions.
    if (s > bestScore || (s === bestScore && r === preferred)) {
      bestScore = s;
      bestRegion = r;
    }
  }
  // Two body mentions, or one in the headline. Below that the match is a
  // coincidence of vocabulary rather than a subject.
  return bestScore >= 2 ? bestRegion : 'Analysis';
}

/** Strip tags and decode the handful of entities that actually show up. */
function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!m) return '';
  return m[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim();
}

/**
 * Minimal RSS/Atom reader. Workers has no DOMParser and pulling in an XML
 * library would blow the startup budget, so this parses the four fields we use
 * and nothing more.
 */
function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = stripHtml(pickTag(b, 'title'));
    let link = pickTag(b, 'link');
    if (!link) {
      const alt = b.match(/<link[^>]*href="([^"]+)"/i);
      link = alt ? alt[1] : '';
    }
    const full = stripHtml(pickTag(b, 'content:encoded') || pickTag(b, 'content'));
    const summary = stripHtml(pickTag(b, 'description') || pickTag(b, 'summary'));
    const date = pickTag(b, 'pubDate') || pickTag(b, 'updated') || pickTag(b, 'published');
    if (!title) continue;
    items.push({ title, url: link, date, text: full || summary, hasFullText: Boolean(full) });
  }
  return items;
}

async function fetchFeed(src) {
  try {
    const r = await fetch(src.url, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(12000)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const items = parseFeed(await r.text());
    console.log(`[sources] ${src.id}: ${items.length} items`);
    return items.map(i => ({ ...i, source: src.name, weight: src.weight }));
  } catch (e) {
    console.warn(`[sources] ${src.id} failed: ${e.message}`);
    return [];
  }
}

async function fetchFederalRegister(region) {
  const agencies = FR_AGENCIES[region] || FR_AGENCIES.Analysis;
  try {
    const u = new URL('https://www.federalregister.gov/api/v1/documents.json');
    // 20 was starving the pool. The Federal Register publishes hundreds of
    // documents a day and this is the one source that never runs dry, but only
    // twenty were being considered per region -- and after the noise filter
    // dropped the procedural ones, often only a handful survived. With a
    // five-day no-repeat rule and 24 articles a day, that is how the feed ran
    // out of things to write about overnight. 100 is the API's maximum.
    u.searchParams.set('per_page', '100');
    u.searchParams.set('order', 'newest');
    for (const a of agencies) u.searchParams.append('conditions[agencies][]', a);

    const r = await fetch(u, {
      headers: FETCH_HEADERS,
      signal: AbortSignal.timeout(12000)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    // Most Federal Register traffic is procedural (Paperwork Reduction Act
    // notices, meeting announcements). Those make dull, uninformative articles,
    // so drop them and prefer substantive rules and determinations.
    const NOISE = /paperwork reduction|information collection|meeting notice|privacy act|sunshine act|agency information/i;
    const items = (data.results || [])
      .filter(d => d.title && !NOISE.test(d.title))
      .map(d => ({
        title: d.title,
        url: d.html_url,
        date: d.publication_date,
        text: d.abstract || '',
        hasFullText: false,
        source: `Federal Register (${d.type || 'Document'})`,
        weight: 2
      }));
    console.log(`[sources] federal-register: ${items.length} usable of ${(data.results || []).length}`);
    return items;
  } catch (e) {
    console.warn(`[sources] federal-register failed: ${e.message}`);
    return [];
  }
}

/**
 * Gather primary documents relevant to a region. Returns newest-first, with
 * full-text items promoted ahead of summary-only ones.
 */
/**
 * `cache` is a Map shared across one run. It matters: a Worker may make at most
 * 50 subrequests per invocation, and the generator now walks up to eight
 * regions looking for uncovered material. Without this, the same White House
 * feed would be fetched eight times and the run would hit the ceiling and
 * throw, which reads in the logs as the generator failing rather than as a
 * quota being spent on the same eight documents.
 */
async function fetchPrimarySources(region, cache = new Map()) {
  const once = (key, fn) => {
    if (!cache.has(key)) cache.set(key, fn());
    return cache.get(key);
  };

  const feeds = RSS_SOURCES.filter(s => s.regions.includes(region));
  const results = await Promise.all([
    ...feeds.map(s => once('feed:' + s.id, () => fetchFeed(s))),
    once('fr:' + region, () => fetchFederalRegister(region))
  ]);

  // Federal Register abstracts are frequently null -- most Notices, most
  // Presidential Documents, most OFAC and BIS actions. Dropping those threw
  // away the majority of the one source that is supposed to never run dry,
  // silently, right after per_page was raised to 100 to fix starvation.
  // A title plus its agency is thin, but it is still a real primary document,
  // and the scorer reads the title anyway.
  const all = results.flat()
    .filter(i => i.title)
    .map(i => (i.text && i.text.length > 120)
      ? i
      : { ...i, text: `${i.title}. ${i.source}.${i.text ? ' ' + i.text : ''}`, thinText: true });
  const thin = all.filter(i => i.thinText).length;
  if (thin) console.log(`[sources] ${thin}/${all.length} documents have no usable abstract; using the title.`);

  // Rank: full text first, then source weight, then recency.
  all.sort((a, b) => {
    if (!!a.thinText !== !!b.thinText) return a.thinText ? 1 : -1;
    if (a.hasFullText !== b.hasFullText) return a.hasFullText ? -1 : 1;
    if (a.weight !== b.weight) return b.weight - a.weight;
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  return all;
}

// ── Cloudflare Workers AI (default, free) ────────────────────────────────────
// 10,000 Neurons/day are free and reset at 00:00 UTC. @cf/openai/gpt-oss-120b
// bills 31,818 Neurons/M input and 68,182/M output. The real prompt is a
// ~2,000-char instruction block plus a 4,000-char lead plus 3x900 chars of
// context — about 1,900 input tokens, not the 1,200 this comment used to
// claim — and max_tokens is 4,000. Worst case is therefore ~333 Neurons and
// typical is ~180, so 24 articles/day sits around 4,300-8,000 of the
// allowance. The headroom is real but it is retries that would spend it, not
// steady state. Do NOT switch to kimi-k2.6/2.7, glm-5.2/5.3 or deepseek-v4-*:
// those require a paid billing method and hard-fail on the Workers Free plan.
const WORKERS_AI_MODEL = '@cf/openai/gpt-oss-120b';

/**
 * Workers AI has shipped more than one response shape for reasoning models,
 * so accept any of them rather than trusting a single field.
 */
function extractWorkersAIText(result) {
  if (typeof result === 'string') return result;
  if (typeof result?.response === 'string') return result.response;
  const choice = result?.choices?.[0];
  if (typeof choice?.message?.content === 'string') return choice.message.content;
  if (typeof choice?.text === 'string') return choice.text;
  if (Array.isArray(result?.response)) {
    const joined = result.response.map(x => (typeof x === 'string' ? x : x?.text ?? '')).join('');
    if (joined) return joined;
  }
  return null;
}

/**
 * Close a JSON object that was cut off mid-generation.
 *
 * A truncated response is almost always a complete `title`/`excerpt`/`slug`
 * with the `body` string severed part-way. Rather than throw the whole
 * generation away — a wasted model call and an hour with no article — trim back
 * to the last complete paragraph and close the structure. Returns null when
 * there is nothing worth salvaging, so the caller can still retry.
 */
function salvageTruncatedJson(text) {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  if (start === -1) return null;
  let s = text.slice(start);

  // Walk the string tracking whether we are inside a quoted value, so we know
  // where it is safe to cut. `strStart` remembers where the CURRENT string
  // opened, which matters below.
  let inStr = false, esc = false, depth = 0, lastSafe = -1, strStart = -1, closedAt = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { if (!inStr) strStart = i; inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { closedAt = i; break; } }
    else if (c === ',' && depth === 1) lastSafe = i;
  }

  // A balanced object that closed cleanly was not truncated at all -- it just
  // had junk after it, which is why the primary parse (which cuts at the LAST
  // brace in the payload) failed. Return that object rather than throwing away
  // a perfectly good generation because the model appended a sentence.
  if (closedAt !== -1) {
    try {
      const parsed = JSON.parse(s.slice(0, closedAt + 1));
      return (parsed && parsed.title && typeof parsed.body === 'string' && parsed.body.length > 400)
        ? parsed : null;
    } catch { return null; }
  }

  if (inStr) {
    // Search for the paragraph break ONLY inside the severed string. Searching
    // the whole payload could land the cut inside an EARLIER, complete field,
    // producing an object that parses cleanly with a silently amputated body
    // and a log line claiming a successful salvage.
    const brk = s.lastIndexOf('\\n\\n');
    if (brk > strStart) s = s.slice(0, brk);
    else s = s.slice(0, strStart + 1);
    // The cut can land inside a two-character escape ("\\n", "\\u00e9"). A
    // dangling backslash would escape the quote we are about to add, so drop
    // any trailing partial escape first.
    s = s.replace(/\\{1,2}$/, '').replace(/\\u[0-9a-fA-F]{0,3}$/, '');
    s += '"';
  } else if (lastSafe > 0) {
    s = s.slice(0, lastSafe);
  }
  s += '}'.repeat(Math.max(depth, 1));

  try {
    const parsed = JSON.parse(s);
    // A sixty-character "body" is not an article; let the caller retry.
    return (parsed && parsed.title && typeof parsed.body === 'string' && parsed.body.length > 400)
      ? parsed : null;
  } catch {
    return null;
  }
}

async function callWorkersAI(env, prompt) {
  if (!env.AI) throw new Error('Workers AI binding "AI" is not configured. Add {"ai":{"binding":"AI"}} to wrangler.jsonc and redeploy.');

  // One attempt. The retry loop lives in generateArticleJson, which can also
  // retry a well-formed response whose CONTENT is unusable -- this loop could
  // only ever retry a thrown error, so a model that returned prose burned the
  // hour with two unused retries still on the table.
  let lastErr;
  for (let attempt = 1; attempt <= 1; attempt++) {
    try {
      // max_tokens defaults to 256 on Workers AI. Without this the article is
      // truncated mid-JSON and the parse fails. 2500 was too small -- a
      // four-heading article plus the JSON envelope runs past it -- but 8000
      // was too generous: Workers AI meters Neurons by tokens generated, the
      // free allowance is 10,000/day, and at 24 articles a day a ceiling that
      // high can spend the day's budget before the day is over. The generator
      // then goes quiet until 00:00 UTC, which reads like a crash and is not.
      // 4000 clears any article this prompt produces, and a response that
      // still overruns is salvaged rather than lost (see salvageTruncatedJson),
      // so the downside of the lower ceiling is a slightly shorter piece, not
      // a missed hour.
      const result = await env.AI.run(WORKERS_AI_MODEL, {
        messages: [
          { role: 'system', content: 'You are a senior foreign policy correspondent. Respond with a single valid JSON object and nothing else - no prose before or after, no markdown code fences.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 4000,
        temperature: 0.7
      });

      const text = extractWorkersAIText(result);
      if (typeof text !== 'string' || !text.trim()) {
        throw new Error(`Unexpected Workers AI response shape: ${JSON.stringify(result).slice(0, 500)}`);
      }
      return text;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      // 3040/4006 mean the daily free Neuron allocation is spent. Retrying cannot help.
      if (/\b(3040|4006)\b/.test(msg) || /neuron/i.test(msg)) {
        console.error(`[workers-ai] Daily free Neuron allocation exhausted: ${msg}`);
        throw new Error(msg);
      }
      console.warn(`[workers-ai] Attempt ${attempt}/3 failed: ${msg}`);
      if (attempt < 3) await sleep(3000 * attempt);
    }
  }
  throw lastErr;
}

/**
 * All generation goes through Workers AI. There was an optional Anthropic path
 * here -- better prose, paid -- but it was dead weight: it needed a key nobody
 * was going to keep funded, and a silent fallback meant two possible code paths
 * behind every article with no way to tell which one wrote it.
 */
async function generateText(env, prompt) {
  return callWorkersAI(env, prompt);
}

// ── Main generation routine ───────────────────────────────────────────────────
/**
 * Generate AND parse in one retry loop.
 *
 * `callWorkersAI` retried only on a thrown error. A response that was a
 * perfectly well-formed string of the wrong content -- prose, an apology, a
 * markdown fence with nothing in it, half an object that cannot be salvaged --
 * returned successfully, and the parse and validation then threw outside the
 * retry. One bad sample cost the whole hour with two unused retries still on
 * the table.
 */
async function generateArticleJson(env, prompt) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let raw;
    try {
      raw = await generateText(env, prompt);
    } catch (e) {
      // The daily Neuron allowance is not a retryable condition.
      if (/\b(3040|4006)\b/.test(String(e?.message)) || /neuron/i.test(String(e?.message))) throw e;
      lastErr = e;
      continue;
    }

    raw = raw.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/```json|```/g, '').trim();
    const js = raw.indexOf('{'), je = raw.lastIndexOf('}') + 1;

    let parsed = null;
    if (js !== -1 && je > js) {
      try { parsed = JSON.parse(raw.slice(js, je)); } catch { /* try salvage */ }
    }
    if (!parsed) {
      parsed = salvageTruncatedJson(raw);
      if (parsed) console.warn(`[generator] Output truncated; salvaged ${parsed.body.length} chars of body.`);
    }

    // A salvage that recovers forty characters is not an article.
    if (parsed && typeof parsed.title === 'string' && parsed.title.trim()
        && typeof parsed.body === 'string' && parsed.body.length > 400) {
      return parsed;
    }

    lastErr = new Error(`Unusable model output on attempt ${attempt}: ${raw.slice(0, 300)}`);
    console.warn(`[generator] ${lastErr.message}`);
    if (attempt < 3) await sleep(2000 * attempt);
  }
  throw lastErr;
}

async function generateArticle(env) {
  console.log('[generator] Starting article generation...');

  // Only what the run genuinely cannot proceed without. UNSPLASH_ACCESS_KEY was
  // in this list and is not one of them: getImage() prefers public-domain U.S.
  // government photography and returns an empty string when Unsplash is
  // unavailable, so an article without it publishes fine, just without a stock
  // photo. Listing it here meant a missing image key threw before a single
  // source was fetched -- every cron run failed, the Worker answered /health
  // perfectly the whole time, and nothing in the failure named the image key.
  const missing = ['SUPABASE_URL','SUPABASE_KEY'].filter(k => !env[k]);
  if (missing.length) {
    throw new Error(`Missing required secrets: ${missing.join(', ')}. Set them with: wrangler secret put <NAME>`);
  }
  if (!env.UNSPLASH_ACCESS_KEY) {
    console.warn('[generator] No UNSPLASH_ACCESS_KEY — images will come from government photo feeds only.');
  }

  // The round-robin region is a PREFERENCE, not a constraint.
  //
  // It used to be a constraint, and that is what put the gaps in the feed. Each
  // run picked the next region, fetched only the feeds tagged for that region,
  // and gave up for the hour if everything there had already been written up --
  // while seven other regions sat on fresh, uncovered documents. On 2026-09-04
  // that produced a thirteen-hour hole in a site whose masthead says "Updated
  // Hourly": 07:02, then nothing until 20:01.
  //
  // Now the preferred region is tried first, and if it has nothing usable the
  // remaining regions are tried in order. The hour is only skipped when EVERY
  // region is exhausted, which is the only honest reason to skip one.
  const preferred = await getNextRegion(env);
  const order = [preferred, ...regions.filter(r => r !== preferred)];
  console.log(`[generator] Preferred region: ${preferred}`);

  const alreadyCovered = await recentlyUsedSourceUrls(env);

  let region = preferred;
  let allDocs = [];
  let fresh = [];
  const tried = [];

  const sourceCache = new Map();
  let minScore = TOPICAL_SCORE;

  // Two passes over the SAME cached documents, so this costs no extra
  // subrequests. Pass one demands real topical affinity, so a Russia story
  // still files under Russia. Pass two accepts anything that merely clears the
  // foreign-policy gate, so an hour is skipped only when there is genuinely
  // nothing uncovered left -- not merely nothing matching fifteen hand-written
  // words.
  outer:
  for (const threshold of [TOPICAL_SCORE, BASE_SCORE]) {
    for (const candidate of order) {
      const docs = await fetchPrimarySources(candidate, sourceCache);
      const unused = docs.filter(d => !alreadyCovered.has(d.url));
      const usable = unused.some(d => scoreDocument(d, candidate) >= threshold);

      tried.push(`${candidate}@${threshold}:${docs.length}/${unused.length}${usable ? '' : ' (none relevant)'}`);

      if (usable) {
        region = candidate;
        allDocs = docs;
        fresh = unused;
        minScore = threshold;
        break outer;
      }
    }
  }

  console.log(`[generator] Regions tried (total/uncovered): ${tried.join(', ')}`);

  if (!fresh.length) {
    console.warn('[generator] Every region is exhausted — all documents already covered in the last 5 days. Skipping rather than repeating one.');
    return { status: 'skipped', reason: 'all-regions-exhausted', tried };
  }

  if (region !== preferred) {
    console.log(`[generator] ${preferred} had nothing uncovered; writing ${region} instead.`);
  }

  // One article, one subject. Blending four unrelated documents produced pieces
  // headlined on one thing and opening on another, which reads badly and matches
  // no actual search query. The lead document is the subject; the rest are
  // context the model may reference but must not lead on.

  // Score every fresh document against the chosen region. Anything ceremonial
  // or with no foreign-policy content at all scores -1 and is dropped outright.
  const scored = fresh
    .map(d => ({ doc: d, score: scoreDocument(d, region) }))
    .filter(x => x.score >= minScore)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.doc.hasFullText !== b.doc.hasFullText) return a.doc.hasFullText ? -1 : 1;
      return new Date(b.doc.date || 0) - new Date(a.doc.date || 0);
    });

  // The region loop only breaks when at least one uncovered document cleared
  // `minScore` for this exact region, so `scored` is non-empty by construction.
  // The cross-region reassignment that used to live here was unreachable for
  // the same reason -- it was written before the loop above existed, and so the
  // safety net meant to catch a zero-scoring pool had never once run.
  if (!scored.length) {
    throw new Error('Internal invariant broken: region loop chose a region with no scoring documents.');
  }

  // Up to three candidate leads. A similarity hit means "write about a
  // different document", not "publish nothing this hour" -- the masthead says
  // Updated Hourly, and the remaining candidates are already in memory and
  // already paid for.
  let lead = null, context = [], used = [], parsed = null;

  // The region the rotation settled on. Kept separate because `region` is about
  // to be overwritten with what the document is actually about, and a retry
  // must break the tie against the rotation's answer, not against the previous
  // candidate's.
  const rotationRegion = region;

  for (const candidate of scored.slice(0, 3)) {
    lead = candidate.doc;

    // Selection is done; naming is not. The rotation decided which feeds to
    // read first, and that is all it is entitled to decide -- the label comes
    // from the document's own vocabulary. See bestRegionFor.
    region = bestRegionFor(lead, rotationRegion);

    console.log(`[generator] Lead: "${lead.title}" (${lead.source}, ${rotationRegion} score ${candidate.score})`);
    if (region !== rotationRegion) {
      console.log(`[generator] Filing under ${region}, not ${rotationRegion} — that is what it is about.`);
    }

    // Context comes from UNCOVERED documents and must clear the relevance bar,
    // or it drags the article off topic. Drawing it from allDocs also re-stamped
    // already-covered documents' five-day clock forward for no benefit.
    context = fresh
      .filter(d => d.url !== lead.url && scoreDocument(d, region) >= BASE_SCORE)
      .slice(0, 3);
    used = [lead, ...context];
    console.log(`[generator] ${context.length} supporting documents.`);

  const leadBlock = `[1] LEAD DOCUMENT — this article is about this document\n    ${lead.title}\n    Source: ${lead.source}${lead.date ? ` (${lead.date})` : ''}\n    URL: ${lead.url}\n    ${lead.text.slice(0, lead.hasFullText ? 4000 : 1500)}`;

  const contextBlock = context.length
    ? '\n\n' + context.map((d, i) =>
        `[${i + 2}] SUPPORTING CONTEXT — reference only where relevant\n    ${d.title}\n    Source: ${d.source}${d.date ? ` (${d.date})` : ''}\n    URL: ${d.url}\n    ${d.text.slice(0, 900)}`
      ).join('\n\n')
    : '';

  const newsContext = leadBlock + contextBlock;

  const types = [
    'breaking news analysis','strategic intelligence briefing',
    'diplomatic developments report','policy implications analysis',
    'geopolitical situation report'
  ];
  const articleType = types[Math.floor(Math.random() * types.length)];

  const prompt = `You are a senior foreign policy correspondent at POTUS Watch Daily writing a ${articleType} on the ${region} portfolio.

Below are PRIMARY SOURCE DOCUMENTS. Document [1] is the LEAD — this article is about that document and nothing else. The others are supporting context you may reference where genuinely relevant, but they must not drive the headline, the opening, or the structure.

${newsContext}

Hard rules on accuracy:
- Every factual claim must come from the documents above. Cite them inline by bracket number, e.g. [1].
- Name the specific actors, dates, dollar figures, entity names and legal authorities that appear in the documents. Specificity is the point of the piece.
- If the documents do not establish something, write that it is not addressed in the record. Never invent a fact, a quote, a date or a number.
- Analysis and implications are yours to draw, but must follow from what the documents say.

Focus rules:
- The headline, the opening sentence and the closing must all be about document [1].
- Do not summarise the supporting documents in turn. This is one argument about one action, not a roundup.
- If a supporting document is not relevant to the lead, ignore it entirely.

Structure (use ## for section headings, 3-5 words each, descriptive and unique to this piece):
## [Opening heading]
2 paragraphs: what document [1] actually does, and the background needed to read it. 3-4 sentences each.

## [Analysis heading]
2 paragraphs: the strategic logic and the dynamics in play. 3-4 sentences each.

## [Implications heading]
2 paragraphs: consequences for the region and for wider U.S. policy. 3-4 sentences each.

## [Closing heading]
1-2 paragraphs: what remains unresolved, and what would signal a change. Do not use a fixed template here.

Style: active voice, analytical, no rhetorical questions, no sensationalism, never glorify violence. 700-1000 words.

Headline rules: 5-9 words, drawn from document [1]. It must name a SPECIFIC actor and a SPECIFIC action — for example "Treasury Designates Three Iranian Shipping Firms", not "Iran Portfolio Faces Mounting Pressure". No colons. Abstract noun-stacks are rejected.

Slug rules: derived from the headline, url-safe, specific enough to be unique, no years, no dates.

Respond ONLY with valid JSON, no markdown:
{"title":"specific 5-9 word headline about document [1]","region":"${region}","excerpt":"one sentence max 25 words","meta_description":"max 155 chars","slug":"specific-url-slug","body":"## Heading One\\n\\nparagraph\\n\\nparagraph\\n\\n## Heading Two\\n\\nparagraph\\n\\nparagraph\\n\\n## Heading Three\\n\\nparagraph\\n\\nparagraph\\n\\n## Heading Four\\n\\nparagraph"}`;

    const attempt = await generateArticleJson(env, prompt);

    if (await isTooSimilar(env, attempt.title)) {
      console.log(`[generator] "${attempt.title}" is too similar to recent content — trying the next document.`);
      continue;
    }
    parsed = attempt;
    break;
  }

  if (!parsed) {
    return { status: 'skipped', reason: 'too-similar', tried };
  }

  const slug = (parsed.slug && parsed.slug.length > 3) ? slugify(parsed.slug) : slugify(parsed.title);

  const cleanSlug = slug.replace(/\b(20\d\d)\b-?/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  // A headline of nothing but stopwords slugifies to '' and would publish at
  // /article/ with no slug at all.
  const baseSlug = cleanSlug || `${String(region).toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

  // Probe the slug that is actually inserted. Probing `slug` while inserting
  // `cleanSlug` meant any headline containing a year skipped the collision
  // check entirely and hit the unique constraint on write -- losing the hour
  // after the model call had already been paid for.
  let existing = null;
  try {
    existing = await sb(env, `articles?select=slug&slug=eq.${encodeURIComponent(baseSlug)}&limit=1`);
  } catch (e) {
    // Assume collision. Continuing as though the slug were free is the less
    // safe of the two guesses.
    console.warn('[generator] Slug uniqueness probe failed, suffixing defensively:', e.message);
    existing = [{}];
  }
  const finalSlug = (existing && existing.length) ? `${baseSlug}-${Date.now()}` : baseSlug;

  // One lookup, two renditions. Two independent calls meant two independent
  // /photos/random results, so the card on the front page and the hero on the
  // article page showed different photographs of different things -- and the
  // government feed was fetched and scanned twice for an identical answer.
  // The lead document's source is passed too: which building to photograph is
  // a fact about where the document came from, not a guess from its headline.
  const picked = await getImagePair(env, region, parsed.title, `${lead.source || ''} ${lead.title || ''}`);
  const heroImage = picked.hero;
  const cardImage = picked.thumb;
  if (!heroImage && !cardImage) console.warn('[generator] No image found; publishing without one.');

  const now = new Date();

  await sb(env, 'articles', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      title: parsed.title,
      // The model's echo is ignored entirely. The comment above this line used
      // to say "never trust the model's echo" while the code preferred it over
      // the computed value whenever it was a valid name -- and since the prompt
      // tells the model which portfolio it is writing on, it echoed the
      // rotation back every time. That is the other half of why the front page
      // read NATO, China, Iran, Analysis, Trade, Russia, Mideast, Americas in
      // order: even a correct bestRegionFor answer was being overwritten by the
      // model repeating what it had been told.
      region,
      excerpt: parsed.excerpt || parsed.title,
      meta_description: parsed.meta_description || parsed.excerpt || parsed.title,
      slug: finalSlug, body: parsed.body,
      image: cardImage || heroImage, hero_image: heroImage || cardImage,
      published_at: now.toISOString(),
      date: now.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }),
      time: now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' }),
      // The documents actually placed in the prompt — these are real citations now.
      // `lead` marks the document this article is ABOUT. recentlyUsedSourceUrls
      // treats only those as covered, so citing a document no longer spends it.
      sources: JSON.stringify([
        { title: lead.title, url: lead.url, lead: true },
        ...context.map(d => ({ title: d.title, url: d.url, lead: false }))
      ])
    })
  });

  console.log(`[generator] Saved: "${parsed.title}" | Region: ${region} | Slug: ${finalSlug}`);

  // Ping IndexNow for SEO (submits to Bing, Yandex, and others simultaneously)
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: SITE_HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
        urlList: [`https://${SITE_HOST}/article/${finalSlug}`]
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (r.ok) console.log(`[indexnow] Submitted: ${finalSlug}`);
      else console.warn(`[indexnow] Rejected: ${finalSlug} (HTTP ${r.status})`);
  } catch (ie) {
    console.warn('[indexnow] Failed:', ie.message);
  }

  // Purge the edge cache for the surfaces that list articles, so a new dispatch
  // appears immediately despite the s-maxage set in src/middleware.ts. The new
  // article's own URL was never cached, so it needs no purge. No-ops silently
  // when the two optional vars are unset.
  // Token only. The CF_EMAIL + CF_API_KEY (Global API Key) fallback that used
  // to live here was provisioned by nothing in this repository and could not be
  // scoped even if it were -- a Global Key grants the whole account.
  if (env.CF_ZONE_ID && env.CF_PURGE_TOKEN) {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CF_PURGE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [
          'https://www.potuswatchdaily.com/',
          'https://www.potuswatchdaily.com/archive',
          'https://www.potuswatchdaily.com/sitemap.xml',
          'https://www.potuswatchdaily.com/news-sitemap.xml',
          'https://www.potuswatchdaily.com/feed.xml',
          `https://www.potuswatchdaily.com/region/${String(region).toLowerCase() === 'middle east' ? 'mideast' : String(region).toLowerCase().replace(/\s+/g, '-')}`,
        ] }),
      });
      // The purge API answers 200 with {"success":false} for a bad zone, so
      // the status alone is not the outcome.
      const body = await r.json().catch(() => ({}));
      if (r.ok && body.success !== false) console.log('[cf-purge] Purged.');
      else console.warn(`[cf-purge] Failed: HTTP ${r.status} ${JSON.stringify(body).slice(0, 200)}`);
    } catch (pe) {
      console.warn('[cf-purge] Failed:', pe.message);
    }
  }

  return { status: 'ok', title: parsed.title, region, slug: finalSlug };
}

/** Wrap generateArticle so every failure is logged loudly for `wrangler tail`. */
async function runGeneration(env, source) {
  const started = Date.now();
  try {
    const result = await generateArticle(env);
    console.log(`[generator] Done (${source}) in ${Date.now() - started}ms:`, JSON.stringify(result));
    return result;
  } catch (e) {
    console.error(`[generator] FAILED (${source}) after ${Date.now() - started}ms: ${e.message}`);
    if (e.stack) console.error('[generator] Stack:', e.stack);
    throw e;
  }
}

// ── Worker entrypoints ────────────────────────────────────────────────────────
export default {
  /** Fired by the Cron Trigger in wrangler.jsonc. */
  async scheduled(controller, env, _ctx) {
    console.log(`[cron] Fired: pattern="${controller.cron}" scheduledTime=${new Date(controller.scheduledTime).toISOString()}`);
    // Return the promise: the runtime waits for it (up to the 15-minute cron
    // duration ceiling) and marks the invocation failed if it rejects, so the
    // failure surfaces in `wrangler tail` and in the Worker's error rate.
    return runGeneration(env, 'cron');
  },

  /**
   * Not required by the cron, but handy during cutover.
   *   GET  /health          — is the feed still fresh?
   *   GET  /sources         — which feeds are alive and how much unused material is left;
 *                           same Bearer token as /run
   *   POST /run             — fire a generation by hand, Authorization: Bearer $RUN_TOKEN
 *                           (only when RUN_TOKEN is set). A ?token= query param is
 *                           NOT accepted: query strings land in Workers Logs.
   */
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      try {
        const rows = await sb(env, 'articles?select=title,published_at&order=published_at.desc&limit=1');
        const last = rows?.[0];
        const minsSinceLast = last
          ? Math.floor((Date.now() - new Date(last.published_at).getTime()) / 60000)
          : null;
        return Response.json({
          // 90, not 180. At 180 an hourly site can miss two consecutive hours
          // and still report healthy, which is exactly what it did.
          status: minsSinceLast === null || minsSinceLast > 90 ? 'degraded' : 'ok',
          last_article_minutes_ago: minsSinceLast,
          last_article_title: last?.title ?? null
        }, { headers: { 'Cache-Control': 'no-store' } });
      } catch (e) {
        console.error('[health] Supabase query failed:', e.message);
        return Response.json({ status: 'degraded' }, { status: 503 });
      }
    }

    if (url.pathname === '/run' && request.method === 'POST') {
      // Unset RUN_TOKEN in production to disable manual runs entirely.
      if (!env.RUN_TOKEN) return new Response('Not found', { status: 404 });

      // Bearer header, not a query param: query strings land in Workers Logs,
      // shell history and proxy logs. Compared in constant time so the token
      // cannot be recovered a byte at a time.
      // Both sides trimmed. A token that travels through a file, a shell and
      // an HTTP header picks up trailing whitespace at several points, and a
      // one-character difference here is indistinguishable from a wrong token.
      const auth = request.headers.get('authorization') || '';
      const presented = (auth.startsWith('Bearer ') ? auth.slice(7) : '').trim();
      if (!timingSafeEqual(presented, String(env.RUN_TOKEN).trim())) {
        return new Response('Forbidden', { status: 403 });
      }
      try {
        const result = await runGeneration(env, 'manual');
        return Response.json(result);
      } catch (e) {
        console.error('[run] Manual generation failed:', e.message);
        return Response.json({ status: 'error' }, { status: 500 });
      }
    }

    // Which sources are actually alive, and how much uncovered material each
    // one is holding right now. Reads nothing secret and writes nothing.
    //
    // This exists because "no article this hour" and "that feed has been
    // returning 404 for a week" look identical from the outside, and the only
    // way to tell them apart was to read Worker logs in a dashboard nobody has
    // open at 3am.
    if (url.pathname === '/sources') {
      // Same gate as /run. Unauthenticated, this fired twelve outbound requests
      // at five government sites per call from Cloudflare IPs, ran the heaviest
      // CPU path in the Worker, and published the coverage runway -- i.e. when
      // the site is about to go quiet -- to anyone who asked. war.gov's filter
      // already 403s this Worker once; this is the fastest way to earn a
      // permanent block that would read as "the feed changed shape".
      if (!env.RUN_TOKEN) return new Response('Not found', { status: 404 });
      const auth = request.headers.get('authorization') || '';
      const presented = (auth.startsWith('Bearer ') ? auth.slice(7) : '').trim();
      if (!timingSafeEqual(presented, String(env.RUN_TOKEN).trim())) {
        return new Response('Forbidden', { status: 403 });
      }

      const cache = new Map();
      const covered = await recentlyUsedSourceUrls(env).catch(() => new Set());
      const perRegion = {};
      const seen = new Set();
      let totalUncovered = 0;

      for (const r of regions) {
        const docs = await fetchPrimarySources(r, cache);
        const uncovered = docs.filter(d => !covered.has(d.url));
        const usable = uncovered.filter(d => scoreDocument(d, r) >= BASE_SCORE);
        for (const d of usable) {
          if (!seen.has(d.url)) { seen.add(d.url); totalUncovered++; }
        }
        perRegion[r] = { documents: docs.length, uncovered: uncovered.length, usable: usable.length };
      }

      const bySource = {};
      for (const [, promise] of cache) {
        for (const d of await promise) {
          bySource[d.source] = (bySource[d.source] || 0) + 1;
        }
      }

      return Response.json({
        covered_in_last_5_days: covered.size,
        distinct_usable_documents_available: totalUncovered,
        hours_of_runway: totalUncovered,
        by_source: bySource,
        by_region: perRegion
      }, { headers: { 'Cache-Control': 'private, max-age=300', 'X-Robots-Tag': 'noindex' } });
    }

    return new Response('potuswatch-generator: cron worker. Try GET /health or GET /sources', { status: 404 });
  }
};
