/**
 * POTUS Watch — hourly article generator (Cloudflare Worker, Cron Trigger).
 *
 * Port of the Railway service in ../localserver.js.
 * Differences from the Railway version are documented in ../MIGRATION.md.
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

// ── Config (verbatim from localserver.js) ─────────────────────────────────────
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
const GOV_PHOTO_FEED = 'https://www.war.gov/desktopmodules/imagegallery/dgovfeeds/leadphotos.ashx?SMPI=1096&ModuleId=579&TabId=131';

/**
 * Look for a government photo whose title or caption overlaps the article's
 * subject. Returns a URL only on a real keyword match — a random military photo
 * on an unrelated story would be no better than random stock.
 */
async function getGovImage(titleWords, size) {
  if (!titleWords.length) return '';
  try {
    const r = await fetch(GOV_PHOTO_FEED, {
      headers: { 'User-Agent': 'potuswatch-generator/1.0 (+https://www.potuswatchdaily.com)' },
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
    if (!best) return '';

    // The feed serves 600x400; ask for a larger render for the hero.
    const url = size === 'hero'
      ? best.url.replace(/\/600\/400\//, '/1200/800/')
      : best.url;

    console.log(`[image] gov photo matched (${best.score}): "${best.title}"`);
    return `${url}?pw_src=gov&pw_by=${encodeURIComponent('U.S. Department of War')}&pw_at=${encodeURIComponent('https://www.war.gov')}`;
  } catch (e) {
    console.warn('[image] gov photo lookup failed:', e.message);
    return '';
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
 * Returns { url, credit } where credit is "Name|profileUrl", or '' on failure.
 * Attribution and the download trigger are both REQUIRED by the Unsplash API
 * Guidelines and were previously not done at all.
 */
async function getImage(env, region, size, title) {
  // Prefer public-domain U.S. government photography when it actually matches
  // the story. Falls through to Unsplash when it does not.
  const gov = await getGovImage(titleKeywords(title), size);
  if (gov) return gov;

  try {
    const query = imageQueryFor(title, region);
    const u = new URL('https://api.unsplash.com/photos/random');
    u.searchParams.set('query', query);
    u.searchParams.set('orientation', 'landscape');
    u.searchParams.set('content_filter', 'high');

    const r = await fetch(u, {
      headers: { Authorization: 'Client-ID ' + env.UNSPLASH_ACCESS_KEY },
      signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) throw new Error(`Unsplash ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = await r.json();
    console.log(`[image] query "${query}" -> ${data.user?.name || 'unknown'}`);

    // Required by the API Guidelines whenever a photo is used. Fire and forget.
    if (data.links?.download_location) {
      fetch(data.links.download_location, {
        headers: { Authorization: 'Client-ID ' + env.UNSPLASH_ACCESS_KEY }
      }).catch(() => {});
    }

    const raw = data.urls.raw;
    let url;
    if (size === 'thumb') url = raw + '&w=600&q=75&fit=crop';
    else if (size === 'hero') url = raw + '&w=1200&q=85&fit=crop';
    else url = data.urls.regular;

    // Attribution is carried in the URL because the articles table has no column
    // for it. Unsplash ignores unrecognised query params, and the article page
    // parses these back out to render the required credit line.
    const name = data.user?.name;
    const link = data.user?.links?.html;
    if (name && link) {
      url += `&pw_src=unsplash&pw_by=${encodeURIComponent(name)}&pw_at=${encodeURIComponent(link)}`;
    }
    return url;
  } catch (e) {
    console.warn('Image fetch failed:', e.message);
    return '';
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
    const rows = await sb(env, `articles?select=sources&published_at=gte.${encodeURIComponent(since)}&limit=${SIMILARITY_ROW_CAP}`);
    const used = new Set();
    for (const r of rows || []) {
      try {
        for (const src of JSON.parse(r.sources || '[]')) if (src?.url) used.add(src.url);
      } catch { /* a malformed sources cell must not stop generation */ }
    }
    console.log(`[sources] ${used.size} documents already covered in the last 5 days.`);
    return used;
  } catch (e) {
    console.warn('[sources] Could not load recent source URLs:', e.message);
    return new Set();
  }
}

async function isTooSimilar(env, newTitle) {
  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const data = await sb(env, `articles?select=title&published_at=gte.${encodeURIComponent(since)}&limit=${SIMILARITY_ROW_CAP}`);
    if (!data || !data.length) return false;

    const newWords = new Set(newTitle.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length > 3));
    for (const row of data) {
      const existWords = row.title.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(w => w.length > 3);
      const overlap = existWords.filter(w => newWords.has(w)).length;
      if (overlap >= 4) {
        console.log(`[similarity] Too similar to: "${row.title}" (${overlap} words overlap)`);
        return true;
      }
    }
    return false;
  } catch (e) {
    console.warn('[similarity] Check failed:', e.message);
    return false;
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
const REGION_TERMS = {
  Americas: ['mexico','canada','brazil','venezuela','colombia','cuba','haiti','hemisphere','border','migration','cartel','western hemisphere','latin america','panama','argentina'],
  China:    ['china','chinese','beijing','xi jinping','taiwan','hong kong','indo-pacific','south china sea','prc','semiconductor','huawei','tariff on china'],
  NATO:     ['nato','alliance','article 5','baltic','poland','germany','france','united kingdom','norway','allied','transatlantic','european defence','european defense','burden-sharing'],
  Iran:     ['iran','iranian','tehran','irgc','nuclear','enrichment','hormuz','houthi','proxy','jcpoa','snapback'],
  Mideast:  ['israel','gaza','palestin','saudi','yemen','syria','lebanon','iraq','jordan','egypt','qatar','uae','emirates','hezbollah','hamas','abraham accords','middle east','afghan'],
  Russia:   ['russia','russian','moscow','putin','ukraine','kyiv','kremlin','wagner','belarus','black sea','donbas','oil price cap'],
  Trade:    ['tariff','trade','export control','import','customs','wto','supply chain','sanction','duty','duties','trade agreement','commerce','economic security'],
  Analysis: ['foreign policy','national security','diplomacy','treaty','alliance','sanction','state department','secretary of state','geopolitic','defense','defence','security council']
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

function scoreDocument(doc, region) {
  const title = (doc.title || '').toLowerCase();
  const body = (doc.text || '').slice(0, 3000).toLowerCase();

  if (CEREMONIAL.test(title)) return -1;                       // hard reject
  if (!FOREIGN_POLICY_TERMS.some(t => title.includes(t) || body.includes(t))) return -1;

  const terms = REGION_TERMS[region] || REGION_TERMS.Analysis;
  let score = 0;
  for (const t of terms) {
    if (title.includes(t)) score += 5;   // the subject of the document
    else if (body.includes(t)) score += 1;
  }
  return score;
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
      headers: { 'User-Agent': 'potuswatch-generator/1.0 (+https://www.potuswatchdaily.com)' },
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
    u.searchParams.set('per_page', '20');
    u.searchParams.set('order', 'newest');
    for (const a of agencies) u.searchParams.append('conditions[agencies][]', a);

    const r = await fetch(u, {
      headers: { 'User-Agent': 'potuswatch-generator/1.0 (+https://www.potuswatchdaily.com)' },
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
async function fetchPrimarySources(region) {
  const feeds = RSS_SOURCES.filter(s => s.regions.includes(region));
  const results = await Promise.all([
    ...feeds.map(fetchFeed),
    fetchFederalRegister(region)
  ]);

  const all = results.flat().filter(i => i.title && i.text && i.text.length > 120);

  // Rank: full text first, then source weight, then recency.
  all.sort((a, b) => {
    if (a.hasFullText !== b.hasFullText) return a.hasFullText ? -1 : 1;
    if (a.weight !== b.weight) return b.weight - a.weight;
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  return all;
}

// ── Cloudflare Workers AI (default, free) ────────────────────────────────────
// 10,000 Neurons/day are free and reset at 00:00 UTC. @cf/openai/gpt-oss-120b
// bills 31,818 Neurons/M input and 68,182/M output, so at ~1,200 in / ~1,600 out
// an article costs ~147 Neurons — roughly 67 articles/day, ~2.8x headroom at the
// hourly cadence. Do NOT switch to kimi-k2.6/2.7, glm-5.2/5.3 or deepseek-v4-*:
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
  // where it is safe to cut.
  let inStr = false, esc = false, depth = 0, lastSafe = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return null; }  // not truncated
    else if (c === ',' && depth === 1) lastSafe = i;
  }

  if (inStr) {
    // Cut the severed string back to its last paragraph break so the article
    // does not end mid-sentence, then close the quote.
    const brk = s.lastIndexOf('\\n\\n');
    if (brk > 0) s = s.slice(0, brk);
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
    return (parsed && parsed.title && parsed.body) ? parsed : null;
  } catch {
    return null;
  }
}

async function callWorkersAI(env, prompt) {
  if (!env.AI) throw new Error('Workers AI binding "AI" is not configured. Add {"ai":{"binding":"AI"}} to wrangler.jsonc and redeploy.');

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
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

  let region = await getNextRegion(env);
  console.log(`[generator] Region selected: ${region}`);

  const allDocs = await fetchPrimarySources(region);
  if (!allDocs.length) {
    console.warn('[generator] No primary source documents available. Skipping.');
    return { status: 'skipped', reason: 'no-sources' };
  }

  // One article, one subject. Blending four unrelated documents produced pieces
  // headlined on one thing and opening on another, which reads badly and matches
  // no actual search query. The lead document is the subject; the rest are
  // context the model may reference but must not lead on.
  const alreadyCovered = await recentlyUsedSourceUrls(env);
  const fresh = allDocs.filter(d => !alreadyCovered.has(d.url));

  if (!fresh.length) {
    console.warn(`[generator] All ${allDocs.length} ${region} documents already covered in the last 5 days. Skipping rather than repeating one.`);
    return { status: 'skipped', reason: 'no-fresh-sources' };
  }

  // Score every fresh document against the chosen region. Anything ceremonial
  // or with no foreign-policy content at all scores -1 and is dropped outright.
  const scored = fresh
    .map(d => ({ doc: d, score: scoreDocument(d, region) }))
    .filter(x => x.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.doc.hasFullText !== b.doc.hasFullText) return a.doc.hasFullText ? -1 : 1;
      return new Date(b.doc.date || 0) - new Date(a.doc.date || 0);
    });

  if (!scored.length) {
    // The round-robin region has nothing relevant today. Rather than forcing an
    // off-topic article into it, find the region that DOES match the material.
    let best = null;
    for (const r of Object.keys(REGION_TERMS)) {
      for (const d of fresh) {
        const sc = scoreDocument(d, r);
        if (sc > 0 && (!best || sc > best.score)) best = { doc: d, score: sc, region: r };
      }
    }
    if (!best) {
      console.warn(`[generator] No document scored as foreign-policy relevant for any region. Skipping.`);
      return { status: 'skipped', reason: 'no-relevant-sources' };
    }
    console.log(`[generator] No relevant ${region} material; reassigning to ${best.region}.`);
    region = best.region;
    scored.push({ doc: best.doc, score: best.score });
  }

  const lead = scored[0].doc;
  console.log(`[generator] Lead: "${lead.title}" (${lead.source}, ${region} score ${scored[0].score})`);

  // Context must also clear the relevance bar, or it drags the article off topic.
  const context = allDocs
    .filter(d => d.url !== lead.url && scoreDocument(d, region) > 0)
    .slice(0, 3);
  const used = [lead, ...context];
  console.log(`[generator] ${context.length} supporting documents.`);

  const leadBlock = `[1] LEAD DOCUMENT — this article is about this document\n    ${lead.title}\n    Source: ${lead.source}${lead.date ? ` (${lead.date})` : ''}\n    URL: ${lead.url}\n    ${lead.text.slice(0, lead.hasFullText ? 6000 : 1500)}`;

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

  // Prompt text is byte-for-byte identical to localserver.js.
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

  let raw = await generateText(env, prompt);
  raw = raw.replace(/[\x00-\x1F\x7F]/g,' ').replace(/```json|```/g,'').trim();
  const js = raw.indexOf('{'), je = raw.lastIndexOf('}') + 1;

  let parsed;
  try {
    parsed = JSON.parse(raw.slice(js, je));
  } catch (e) {
    // A cut-off response still contains a usable article most of the time.
    parsed = salvageTruncatedJson(raw);
    if (parsed) {
      console.warn(`[generator] Model output was truncated; salvaged ${parsed.body.length} chars of body.`);
    } else {
      console.error('[generator] Failed to parse model JSON. First 600 chars of payload:', raw.slice(0, 600));
      throw new Error(`Model returned unparseable JSON: ${e.message}`);
    }
  }
  if (!parsed.title || !parsed.body) {
    throw new Error(`Model JSON missing title or body. Keys: ${Object.keys(parsed).join(',')}`);
  }

  if (await isTooSimilar(env, parsed.title)) {
    console.log('[generator] Article too similar to recent content — skipping.');
    return { status: 'skipped', reason: 'too-similar', title: parsed.title };
  }

  const slug = (parsed.slug && parsed.slug.length > 3) ? slugify(parsed.slug) : slugify(parsed.title);

  // NOTE: this mirrors localserver.js exactly, including the quirk that the
  // uniqueness probe uses `slug` while the row is inserted with `cleanSlug`.
  // See MIGRATION.md ("Known quirk carried over").
  let existing = null;
  try {
    existing = await sb(env, `articles?select=slug&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  } catch (e) {
    console.warn('[generator] Slug uniqueness probe failed, continuing:', e.message);
  }

  const cleanSlug = slug.replace(/\b(2024|2025|2026|2027)\b-?/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'');
  const finalSlug = (existing && existing.length) ? cleanSlug + '-' + Date.now() : cleanSlug;

  const heroImage = await getImage(env, region, 'hero', parsed.title);
  const cardImage = await getImage(env, region, 'thumb', parsed.title);
  if (!heroImage && !cardImage) console.warn('[generator] Both image fetches failed; publishing without images.');

  const now = new Date();

  await sb(env, 'articles', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      title: parsed.title, region: parsed.region || region,
      excerpt: parsed.excerpt, meta_description: parsed.meta_description || parsed.excerpt,
      slug: finalSlug, body: parsed.body,
      image: cardImage || heroImage, hero_image: heroImage || cardImage,
      published_at: now.toISOString(),
      date: now.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }),
      time: now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' }),
      // The documents actually placed in the prompt — these are real citations now.
      sources: JSON.stringify(used.map(d => ({ title: d.title, url: d.url })))
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
    console.log(`[indexnow] Submitted: ${finalSlug} (HTTP ${r.status})`);
  } catch (ie) {
    console.warn('[indexnow] Failed:', ie.message);
  }

  // Purge the edge cache for the surfaces that list articles, so a new dispatch
  // appears immediately despite the s-maxage set in src/middleware.ts. The new
  // article's own URL was never cached, so it needs no purge. No-ops silently
  // when the two optional vars are unset.
  if (env.CF_ZONE_ID && (env.CF_PURGE_TOKEN || (env.CF_EMAIL && env.CF_API_KEY))) {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`, {
        method: 'POST',
        // Either a scoped token (preferred) or the Global API Key, whichever
        // is configured. The Global Key is what already lives in GitHub Secrets.
        headers: env.CF_PURGE_TOKEN
          ? { Authorization: `Bearer ${env.CF_PURGE_TOKEN}`, 'Content-Type': 'application/json' }
          : { 'X-Auth-Email': env.CF_EMAIL, 'X-Auth-Key': env.CF_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [
          'https://www.potuswatchdaily.com/',
          'https://www.potuswatchdaily.com/archive',
          'https://www.potuswatchdaily.com/sitemap.xml',
          'https://www.potuswatchdaily.com/news-sitemap.xml',
          'https://www.potuswatchdaily.com/feed.xml',
          `https://www.potuswatchdaily.com/region/${String(region).toLowerCase() === 'middle east' ? 'mideast' : String(region).toLowerCase().replace(/\s+/g, '-')}`,
        ] }),
      });
      console.log(`[cf-purge] HTTP ${r.status}`);
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
   *   POST /run?token=...   — fire a generation by hand (only if RUN_TOKEN is set)
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
          status: minsSinceLast === null || minsSinceLast > 180 ? 'degraded' : 'ok',
          last_article_minutes_ago: minsSinceLast,
          last_article_title: last?.title ?? null
        });
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
      const auth = request.headers.get('authorization') || '';
      const presented = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!timingSafeEqual(presented, env.RUN_TOKEN)) {
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

    return new Response('potuswatch-generator: cron worker. Try GET /health', { status: 404 });
  }
};
