import express from 'express';
import axios from 'axios';
import ws from 'ws';
import { createClient } from '@supabase/supabase-js';

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  realtime: { transport: ws }
});
app.use(express.static('.'));
app.use(express.json());

// ── State tracking ────────────────────────────────────────────────────────────
let lastArticleTime = null;
let lastArticleTitle = null;
let consecutiveFailures = 0;
let totalGenerated = 0;
const startTime = Date.now();

// ── Health endpoint (Railway uses this to monitor the service) ────────────────
app.get('/health', (req, res) => {
  const uptimeMins = Math.floor((Date.now() - startTime) / 60000);
  const minsSinceLast = lastArticleTime
    ? Math.floor((Date.now() - lastArticleTime) / 60000)
    : null;
  res.json({
    status: consecutiveFailures >= 5 ? 'degraded' : 'ok',
    uptime_minutes: uptimeMins,
    last_article_minutes_ago: minsSinceLast,
    last_article_title: lastArticleTitle,
    total_generated: totalGenerated,
    consecutive_failures: consecutiveFailures
  });
});

// ── Config ────────────────────────────────────────────────────────────────────
const regions = ['Iran','China','NATO','Americas','Mideast','Russia','Trade','Analysis'];
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

function slugify(t) {
  return t.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-')
    .replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80);
}

async function getImage(region, size) {
  try {
    const queries = imageQueries[region] || ['politics world diplomacy'];
    const query = queries[Math.floor(Math.random() * queries.length)];
    const r = await axios.get('https://api.unsplash.com/photos/random', {
      params: { query, orientation: 'landscape', content_filter: 'high' },
      headers: { Authorization: 'Client-ID ' + process.env.UNSPLASH_ACCESS_KEY },
      timeout: 10000
    });
    const raw = r.data.urls.raw;
    if (size === 'thumb') return raw + '&w=600&q=75&fit=crop';
    if (size === 'hero')  return raw + '&w=1200&q=85&fit=crop';
    return r.data.urls.regular;
  } catch(e) {
    console.warn('Image fetch failed:', e.message);
    return '';
  }
}

// ── Title similarity check ────────────────────────────────────────────────────
async function isTooSimilar(newTitle) {
  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase.from('articles').select('title').gte('published_at', since);
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
  } catch(e) {
    console.warn('[similarity] Check failed:', e.message);
    return false;
  }
}

// ── Round-robin region selector ───────────────────────────────────────────────
async function getNextRegion() {
  try {
    const { data } = await supabase.from('articles').select('region').order('id', { ascending: false }).limit(1);
    const lastRegion = data?.[0]?.region || null;
    const lastIndex = lastRegion ? regions.indexOf(lastRegion) : -1;
    return regions[(lastIndex + 1) % regions.length];
  } catch(e) {
    console.warn('[region] Round-robin failed, using random:', e.message);
    return regions[Math.floor(Math.random() * regions.length)];
  }
}

const JUNK_DOMAINS = [
  'smartbitchestrashybooks','podbean','rollingstone','billboard','hiphopwired',
  'insidethemagic','commondreams','thenation','rt.com','slowboring',
  'theintercept','salon.com','newrepublic'
];

function isRelevantSource(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  return !JUNK_DOMAINS.some(d => u.includes(d));
}

async function fetchNews() {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: 'Trump foreign policy OR Iran nuclear OR Strait of Hormuz OR NATO OR China Xi summit OR Russia Ukraine ceasefire OR tariffs OR sanctions OR diplomacy OR geopolitics',
          language: 'en', sortBy: 'publishedAt', pageSize: 20,
          apiKey: process.env.NEWS_API_KEY
        },
        timeout: 15000
      });
      const filtered = r.data.articles.filter(a =>
        a.title && a.description && a.title !== '[Removed]' && isRelevantSource(a.url)
      );
      return filtered.length >= 3 ? filtered :
        r.data.articles.filter(a => a.title && a.description && a.title !== '[Removed]');
    } catch(e) {
      console.warn(`News fetch attempt ${i+1}/3 failed:`, e.message);
      if (i < 2) await new Promise(r => setTimeout(r, 5000 * (i + 1)));
    }
  }
  return null;
}

async function generateArticles() {
  console.log('[generator] Starting article generation...');
  try {
    const newsItems = await fetchNews();
    if (!newsItems || !newsItems.length) {
      console.warn('[generator] No news available. Skipping.');
      return;
    }

    const region = await getNextRegion();
    const keywords = {
      Iran:['iran','tehran','nuclear'], China:['china','beijing','xi','taiwan'],
      NATO:['nato','europe','ukraine'], Americas:['trump','white house','congress'],
      Mideast:['israel','gaza','saudi','yemen'], Russia:['russia','putin','moscow','ukraine'],
      Trade:['tariff','trade','economy','sanctions'],
      Analysis:['policy','strategy','diplomacy','geopolitics','foreign','alliance','leverage','sanctions']
    };
    const kw = keywords[region] || [];
    const relevant = newsItems.filter(a =>
      kw.some(k => (a.title + ' ' + (a.description || '')).toLowerCase().includes(k))
    );
    const pool = relevant.length >= 3 ? relevant : newsItems;
    const top5 = pool.slice(0, 5);
    const newsContext = top5.map((a,i) =>
      `${i+1}. ${a.title}${a.description ? '\n   ' + a.description : ''}`
    ).join('\n\n');

    const types = [
      'breaking news analysis','strategic intelligence briefing',
      'diplomatic developments report','policy implications analysis',
      'geopolitical situation report'
    ];
    const articleType = types[Math.floor(Math.random() * types.length)];

    const prompt = `You are a senior foreign policy correspondent at POTUS Watch Daily. Write a ${articleType} on the ${region} portfolio. Minimum 600 words.\n\nHeadlines:\n${newsContext}\n\nStructure (use ## for section headings):\n## [Context heading]\n2 paragraphs: Powerful lede + background context. Each paragraph 3-4 sentences.\n\n## [Strategic heading]\n2 paragraphs: Strategic analysis and key dynamics. Each paragraph 3-4 sentences.\n\n## [Implications heading]\n2 paragraphs: Wider regional or global implications. Each paragraph 3-4 sentences.\n\n## Washington Angle\n2 paragraphs: White House and Congressional dimension. Each paragraph 2-3 sentences.\n\n## Outlook\n1 paragraph: 72-hour outlook and 3 specific signals to watch. 3-4 sentences.\n\nRules: Title maximum 8 words. No colons in title. Active voice. No rhetorical questions. Section headings must be short (3-5 words), descriptive, and unique. Focus on POLICY, DIPLOMACY, ECONOMICS and STRATEGY. Maintain an analytical tone. Use precise factual language. Never sensationalize or glorify violence. Write at least 600 words total.\n\nRespond ONLY with valid JSON no markdown:\n{"title":"max 8 word title","region":"${region}","excerpt":"one sentence max 25 words","meta_description":"max 155 chars","slug":"url-slug-no-years-no-dates","body":"## Heading One\\n\\nparagraph text\\n\\nparagraph text\\n\\n## Heading Two\\n\\nparagraph text\\n\\nparagraph text\\n\\n## Heading Three\\n\\nparagraph text\\n\\nparagraph text\\n\\n## Washington Angle\\n\\nparagraph text\\n\\nparagraph text\\n\\n## Outlook\\n\\nparagraph text"}`;

    const res = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    let raw = res.data.content[0].text;
    raw = raw.replace(/[\x00-\x1F\x7F]/g,' ').replace(/```json|```/g,'').trim();
    const js = raw.indexOf('{'), je = raw.lastIndexOf('}') + 1;
    const parsed = JSON.parse(raw.slice(js, je));

    if (await isTooSimilar(parsed.title)) {
      console.log('[generator] Article too similar to recent content — skipping.');
      return;
    }

    const slug = (parsed.slug && parsed.slug.length > 3) ? slugify(parsed.slug) : slugify(parsed.title);
    const { data: existing } = await supabase.from('articles').select('slug').eq('slug', slug).limit(1);
    const cleanSlug = slug.replace(/\b(2024|2025|2026|2027)\b-?/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'');
    const finalSlug = (existing && existing.length) ? cleanSlug + '-' + Date.now() : cleanSlug;

    const heroImage = await getImage(region, 'hero');
    const cardImage = await getImage(region, 'thumb');
    const now = new Date();

    await supabase.from('articles').insert({
      title: parsed.title, region: parsed.region || region,
      excerpt: parsed.excerpt, meta_description: parsed.meta_description || parsed.excerpt,
      slug: finalSlug, body: parsed.body,
      image: cardImage || heroImage, hero_image: heroImage || cardImage,
      published_at: now.toISOString(),
      date: now.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }),
      time: now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false }),
      sources: JSON.stringify(top5.slice(0,3).map(a => ({ title: a.title, url: a.url })))
    });

    // Update state
    lastArticleTime = Date.now();
    lastArticleTitle = parsed.title;
    consecutiveFailures = 0;
    totalGenerated++;
    console.log(`[generator] ✓ Saved: "${parsed.title}" | Region: ${region} | Slug: ${finalSlug}`);

    // Ping IndexNow for SEO (submits to Bing, Yandex, and others simultaneously)
    try {
      const INDEXNOW_KEY = 'e7d7dce91b634bc5bf610ae2367c52c7';
      await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: 'www.potuswatchdaily.com',
          key: INDEXNOW_KEY,
          keyLocation: `https://www.potuswatchdaily.com/${INDEXNOW_KEY}.txt`,
          urlList: [`https://www.potuswatchdaily.com/article/${finalSlug}`]
        })
      });
      console.log('[indexnow] Submitted:', finalSlug);
    } catch(ie) {
      console.warn('[indexnow] Failed:', ie.message);
    }

  } catch(e) {
    consecutiveFailures++;
    console.error(`[generator] Error (failure #${consecutiveFailures}):`, e.message);
    if (e.response) console.error('[generator] API response:', JSON.stringify(e.response.data));

    // Exponential backoff retry (5m, 10m, 20m, capped at 30m)
    if (consecutiveFailures <= 5) {
      const backoffMs = Math.min(5 * 60 * 1000 * consecutiveFailures, 30 * 60 * 1000);
      console.log(`[generator] Retrying in ${backoffMs / 60000} minutes...`);
      setTimeout(generateArticles, backoffMs);
    } else {
      console.error('[generator] Too many consecutive failures. Will resume on next scheduled run.');
    }
  }
}

// ── Process-level safety net ──────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[process] Uncaught exception:', err.message, err.stack);
  // Don't exit — Railway will restart if truly broken
});

process.on('unhandledRejection', (reason) => {
  console.error('[process] Unhandled rejection:', reason);
});

// ── Schedule: generate every hour ────────────────────────────────────────────
setInterval(generateArticles, 60 * 60 * 1000);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`[server] POTUS Watch article generator running on port ${PORT}`);
  console.log('[server] Health check available at /health');
  await generateArticles();
});
