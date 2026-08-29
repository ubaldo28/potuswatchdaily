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
 *   ANTHROPIC_API_KEY, NEWS_API_KEY, UNSPLASH_ACCESS_KEY, SUPABASE_URL, SUPABASE_KEY
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

const keywords = {
  Iran:['iran','tehran','nuclear'], China:['china','beijing','xi','taiwan'],
  NATO:['nato','europe','ukraine'], Americas:['trump','white house','congress'],
  Mideast:['israel','gaza','saudi','yemen'], Russia:['russia','putin','moscow','ukraine'],
  Trade:['tariff','trade','economy','sanctions'],
  Analysis:['policy','strategy','diplomacy','geopolitics','foreign','alliance','leverage','sanctions']
};

const JUNK_DOMAINS = [
  'smartbitchestrashybooks','podbean','rollingstone','billboard','hiphopwired',
  'insidethemagic','commondreams','thenation','rt.com','slowboring',
  'theintercept','salon.com','newrepublic'
];

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

function isRelevantSource(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  return !JUNK_DOMAINS.some(d => u.includes(d));
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`,
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
async function getImage(env, region, size) {
  try {
    const queries = imageQueries[region] || ['politics world diplomacy'];
    const query = queries[Math.floor(Math.random() * queries.length)];
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

    const raw = data.urls.raw;
    if (size === 'thumb') return raw + '&w=600&q=75&fit=crop';
    if (size === 'hero')  return raw + '&w=1200&q=85&fit=crop';
    return data.urls.regular;
  } catch (e) {
    console.warn('Image fetch failed:', e.message);
    return '';
  }
}

// ── Title similarity check ────────────────────────────────────────────────────
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

// ── NewsAPI ───────────────────────────────────────────────────────────────────
async function fetchNews(env) {
  for (let i = 0; i < 3; i++) {
    try {
      const u = new URL('https://newsapi.org/v2/everything');
      u.searchParams.set('q', 'Trump foreign policy OR Iran nuclear OR Strait of Hormuz OR NATO OR China Xi summit OR Russia Ukraine ceasefire OR tariffs OR sanctions OR diplomacy OR geopolitics');
      u.searchParams.set('language', 'en');
      u.searchParams.set('sortBy', 'publishedAt');
      u.searchParams.set('pageSize', '20');
      u.searchParams.set('apiKey', env.NEWS_API_KEY);

      const r = await fetch(u, {
        // NewsAPI rejects requests without a User-Agent from some edge networks.
        headers: { 'User-Agent': 'potuswatch-generator/1.0' },
        signal: AbortSignal.timeout(15000)
      });
      if (!r.ok) throw new Error(`NewsAPI ${r.status}: ${(await r.text()).slice(0, 300)}`);
      const data = await r.json();
      if (!data.articles) throw new Error(`NewsAPI returned no articles array: ${JSON.stringify(data).slice(0, 300)}`);

      const filtered = data.articles.filter(a =>
        a.title && a.description && a.title !== '[Removed]' && isRelevantSource(a.url)
      );
      return filtered.length >= 3 ? filtered :
        data.articles.filter(a => a.title && a.description && a.title !== '[Removed]');
    } catch (e) {
      console.warn(`News fetch attempt ${i+1}/3 failed:`, e.message);
      if (i < 2) await sleep(5000 * (i + 1));
    }
  }
  return null;
}

// ── Anthropic ─────────────────────────────────────────────────────────────────
async function callAnthropic(env, prompt) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2500,
          messages: [{ role: 'user', content: prompt }]
        }),
        // Wall-clock waiting on fetch() does not count toward Workers CPU time,
        // and the cron duration ceiling is 15 minutes, so 30s is safe.
        signal: AbortSignal.timeout(30000)
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '<unreadable>');
        const err = new Error(`Anthropic ${res.status}: ${body.slice(0, 500)}`);
        // 4xx other than 429 will not fix themselves — fail fast.
        if (res.status < 500 && res.status !== 429) throw Object.assign(err, { fatal: true });
        throw err;
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (e.fatal) {
        console.error(`[anthropic] Non-retryable error: ${e.message}`);
        throw e;
      }
      console.warn(`[anthropic] Attempt ${attempt}/3 failed: ${e.message}`);
      if (attempt < 3) await sleep(3000 * attempt);
    }
  }
  throw lastErr;
}

// ── Main generation routine ───────────────────────────────────────────────────
async function generateArticle(env) {
  console.log('[generator] Starting article generation...');

  const missing = ['ANTHROPIC_API_KEY','NEWS_API_KEY','UNSPLASH_ACCESS_KEY','SUPABASE_URL','SUPABASE_KEY']
    .filter(k => !env[k]);
  if (missing.length) {
    throw new Error(`Missing required secrets: ${missing.join(', ')}. Set them with: wrangler secret put <NAME>`);
  }

  const newsItems = await fetchNews(env);
  if (!newsItems || !newsItems.length) {
    console.warn('[generator] No news available. Skipping.');
    return { status: 'skipped', reason: 'no-news' };
  }
  console.log(`[generator] Fetched ${newsItems.length} usable headlines.`);

  const region = await getNextRegion(env);
  console.log(`[generator] Region selected: ${region}`);

  const kw = keywords[region] || [];
  const relevant = newsItems.filter(a =>
    kw.some(k => (a.title + ' ' + (a.description || '')).toLowerCase().includes(k))
  );
  const pool = relevant.length >= 3 ? relevant : newsItems;
  const top5 = pool.slice(0, 5);
  const newsContext = top5.map((a, i) =>
    `${i+1}. ${a.title}${a.description ? '\n   ' + a.description : ''}`
  ).join('\n\n');

  const types = [
    'breaking news analysis','strategic intelligence briefing',
    'diplomatic developments report','policy implications analysis',
    'geopolitical situation report'
  ];
  const articleType = types[Math.floor(Math.random() * types.length)];

  // Prompt text is byte-for-byte identical to localserver.js.
  const prompt = `You are a senior foreign policy correspondent at POTUS Watch Daily. Write a ${articleType} on the ${region} portfolio. Minimum 600 words.\n\nHeadlines:\n${newsContext}\n\nStructure (use ## for section headings):\n## [Context heading]\n2 paragraphs: Powerful lede + background context. Each paragraph 3-4 sentences.\n\n## [Strategic heading]\n2 paragraphs: Strategic analysis and key dynamics. Each paragraph 3-4 sentences.\n\n## [Implications heading]\n2 paragraphs: Wider regional or global implications. Each paragraph 3-4 sentences.\n\n## Washington Angle\n2 paragraphs: White House and Congressional dimension. Each paragraph 2-3 sentences.\n\n## Outlook\n1 paragraph: 72-hour outlook and 3 specific signals to watch. 3-4 sentences.\n\nRules: Title maximum 8 words. No colons in title. Active voice. No rhetorical questions. Section headings must be short (3-5 words), descriptive, and unique. Focus on POLICY, DIPLOMACY, ECONOMICS and STRATEGY. Maintain an analytical tone. Use precise factual language. Never sensationalize or glorify violence. Write at least 600 words total.\n\nRespond ONLY with valid JSON no markdown:\n{"title":"max 8 word title","region":"${region}","excerpt":"one sentence max 25 words","meta_description":"max 155 chars","slug":"url-slug-no-years-no-dates","body":"## Heading One\\n\\nparagraph text\\n\\nparagraph text\\n\\n## Heading Two\\n\\nparagraph text\\n\\nparagraph text\\n\\n## Heading Three\\n\\nparagraph text\\n\\nparagraph text\\n\\n## Washington Angle\\n\\nparagraph text\\n\\nparagraph text\\n\\n## Outlook\\n\\nparagraph text"}`;

  const apiResponse = await callAnthropic(env, prompt);

  let raw = apiResponse?.content?.[0]?.text;
  if (typeof raw !== 'string') {
    throw new Error(`Unexpected Anthropic response shape: ${JSON.stringify(apiResponse).slice(0, 500)}`);
  }
  raw = raw.replace(/[\x00-\x1F\x7F]/g,' ').replace(/```json|```/g,'').trim();
  const js = raw.indexOf('{'), je = raw.lastIndexOf('}') + 1;

  let parsed;
  try {
    parsed = JSON.parse(raw.slice(js, je));
  } catch (e) {
    console.error('[generator] Failed to parse model JSON. First 600 chars of payload:', raw.slice(0, 600));
    throw new Error(`Model returned unparseable JSON: ${e.message}`);
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

  const heroImage = await getImage(env, region, 'hero');
  const cardImage = await getImage(env, region, 'thumb');
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
      time: now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false }),
      sources: JSON.stringify(top5.slice(0,3).map(a => ({ title: a.title, url: a.url })))
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
        return Response.json({ status: 'degraded', error: e.message }, { status: 503 });
      }
    }

    if (url.pathname === '/run' && request.method === 'POST') {
      if (!env.RUN_TOKEN) return new Response('Manual run disabled (RUN_TOKEN not set)', { status: 404 });
      if (url.searchParams.get('token') !== env.RUN_TOKEN) return new Response('Forbidden', { status: 403 });
      try {
        const result = await runGeneration(env, 'manual');
        return Response.json(result);
      } catch (e) {
        return Response.json({ status: 'error', error: e.message }, { status: 500 });
      }
    }

    return new Response('potuswatch-generator: cron worker. Try GET /health', { status: 404 });
  }
};
