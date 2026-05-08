// =====================================================================
// Drop-in Express handlers for potuswatch (localserver.js)
//
// Adds:
//   GET /                  — server-rendered homepage with inline articles
//   GET /article/:slug     — server-rendered article page
//   GET /sitemap.xml       — dynamic sitemap from Supabase
//   GET /feed.xml          — RSS 2.0 feed
//   GET /robots.txt        — static
//   POST /api/subscribe    — beehiiv proxy (keeps API key server-side)
//   Middleware: www→bare 301 redirect
//
// Assumes you have:
//   - express                       (already in package.json)
//   - @supabase/supabase-js         (already)
//   - dotenv                        (already)
//   - SUPABASE_URL + SUPABASE_KEY env vars
//   - BEEHIIV_PUB_ID + BEEHIIV_API_KEY env vars (for subscribe)
//   - index.html and article-template.html in /public (or wherever)
//
// Article schema (Supabase table `articles`):
//   id, slug, title, excerpt, body, region, hero_image, image,
//   author, sources (jsonb), date (timestamptz), modified (timestamptz),
//   published (boolean)
// Adjust column names below if yours differ.
// =====================================================================

require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const SITE_URL = 'https://potuswatchdaily.com';
const SITE_NAME = 'POTUS Watch Daily';

app.use(express.json());

// ─── Process-level error handlers (PREVENTS RAILWAY CRASHES) ───────────
// Without these, ANY unhandled rejection or uncaught exception kills the
// Node process — Railway then restarts, often in a crash loop. Logging
// instead of crashing keeps the service alive while you investigate.
process.on('unhandledRejection', (reason, promise) => {
    console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
});

// ─── www → bare redirect (301) ─────────────────────────────────────────
app.use((req, res, next) => {
    if (req.hostname === 'www.potuswatchdaily.com') {
        return res.redirect(301, SITE_URL + req.originalUrl);
    }
    next();
});

// ─── Healthcheck endpoint (so Railway can detect a dead service) ───────
app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

// ─── Helper: fetch articles from Supabase (cached for 60s) ─────────────
let _articleCache = { data: null, ts: 0 };
async function getArticles({ limit = 100, offset = 0 } = {}) {
    const now = Date.now();
    if (_articleCache.data && (now - _articleCache.ts) < 60_000 && offset === 0) {
        return _articleCache.data.slice(0, limit);
    }
    const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('published', true)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error) {
        console.error('[supabase] articles query failed', error);
        return [];
    }
    if (offset === 0) _articleCache = { data, ts: now };
    return data;
}
async function getArticleBySlug(slug) {
    const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single();
    if (error) return null;
    return data;
}
async function getRelated(article, n = 4) {
    const { data } = await supabase
        .from('articles')
        .select('slug, title, region, hero_image, date')
        .eq('region', article.region)
        .neq('slug', article.slug)
        .eq('published', true)
        .order('date', { ascending: false })
        .limit(n);
    return data || [];
}

// ─── Helper: small XML / HTML escape (every value rendered as text) ────
function escapeHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) { return escapeHtml(s); }

// ─── Homepage: read index.html, inject articles inline ────────────────
const INDEX_PATH = path.join(__dirname, 'public', 'index.html');
let _indexCache = null;
function loadIndex() {
    if (!_indexCache || process.env.NODE_ENV !== 'production') {
        _indexCache = fs.readFileSync(INDEX_PATH, 'utf8');
    }
    return _indexCache;
}

app.get('/', async (req, res) => {
    try {
        const articles = await getArticles({ limit: 30 });
        let html = loadIndex();

        // Inject initial-articles JSON BEFORE the closing </body>.
        // Frontend already knows to read from #initial-articles per
        // index-body-changes.md. Until that change ships, the inline
        // JSON is harmless but ineffective.
        const inline = `<script id="initial-articles" type="application/json">${JSON.stringify(articles).replace(/</g, '\\u003c')}</script>`;
        html = html.replace('</body>', `${inline}\n</body>`);

        // ALSO server-render the hero + grid into the visible HTML so
        // Googlebot sees content immediately, even before its JS pass.
        const hero = renderHero(articles.slice(0, 3));
        const grid = renderGrid(articles.slice(3, 21));
        html = html
            .replace('<div id="hero" class="hero"></div>', `<div id="hero" class="hero">${hero}</div>`)
            .replace('<div id="grid" class="grid"></div>', `<div id="grid" class="grid">${grid}</div>`);

        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        res.send(html);
    } catch (e) {
        console.error('[GET /]', e);
        // Fall back to the static file rather than 500'ing
        res.sendFile(INDEX_PATH);
    }
});

function renderHero(articles) {
    if (!articles.length) return '';
    const [main, side1, side2] = articles;
    const card = (a, kind) => {
        const img = (a.hero_image || a.image)
            ? `<img class="${kind}-img" src="${escapeAttr(a.hero_image || a.image)}" alt="${escapeAttr(a.title)}" ${kind === 'hero-main-img' ? 'fetchpriority="high"' : 'loading="lazy"'}>`
            : `<div class="hero-placeholder"><span class="hero-placeholder-text">${escapeHtml(a.region || 'World')}</span></div>`;
        return `<div class="hero-${kind === 'hero-main-img' ? 'main' : 'small'}" onclick="openArticle(${articles.indexOf(a)})">
            <a href="/article/${escapeAttr(a.slug)}" style="display:block;text-decoration:none;color:inherit">
                ${img}
                <div class="overlay">
                    <span class="tag">${escapeHtml(a.region || 'World')}</span>
                    <div class="card-title">${escapeHtml(a.title)}</div>
                    ${kind === 'hero-main-img' ? `<div class="card-excerpt">${escapeHtml(a.excerpt || '')}</div>` : ''}
                </div>
            </a>
        </div>`;
    };
    let html = card(main, 'hero-main-img');
    if (side1 || side2) {
        html += '<div class="hero-side">';
        if (side1) html += card(side1, 'hero-small-img');
        if (side2) html += card(side2, 'hero-small-img');
        html += '</div>';
    }
    return html;
}
function renderGrid(articles) {
    return articles.map(a => `
        <div class="card" onclick="window.location='/article/${escapeAttr(a.slug)}'">
            <a href="/article/${escapeAttr(a.slug)}" style="display:block;text-decoration:none;color:inherit">
                ${a.image
                    ? `<img class="card-img" src="${escapeAttr(a.image)}" alt="${escapeAttr(a.title)}" loading="lazy">`
                    : `<div class="card-placeholder"><div class="card-placeholder-inner">${escapeHtml(a.region || 'World')}</div></div>`}
                <div class="card-body">
                    <span class="tag">${escapeHtml(a.region || 'World')}</span>
                    <div class="card-title">${escapeHtml(a.title)}</div>
                    ${a.excerpt ? `<div class="card-excerpt">${escapeHtml(a.excerpt)}</div>` : ''}
                    <div class="card-meta">${escapeHtml(formatDate(a.date))}</div>
                </div>
            </a>
        </div>`).join('');
}
function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Article page (server-rendered with full SEO) ─────────────────────
const ARTICLE_TEMPLATE_PATH = path.join(__dirname, 'public', 'article-template.html');
let _articleTplCache = null;
function loadArticleTpl() {
    if (!_articleTplCache || process.env.NODE_ENV !== 'production') {
        _articleTplCache = fs.readFileSync(ARTICLE_TEMPLATE_PATH, 'utf8');
    }
    return _articleTplCache;
}

app.get('/article/:slug', async (req, res) => {
    try {
        const article = await getArticleBySlug(req.params.slug);
        if (!article) return res.status(404).send('Article not found');
        const related = await getRelated(article);

        const dateIso = new Date(article.date).toISOString();
        const modifiedIso = article.modified ? new Date(article.modified).toISOString() : dateIso;
        const heroImg = article.hero_image || article.image || `${SITE_URL}/og-default.jpg`;
        const author = article.author || 'POTUS Watch Editorial';
        const paragraphs = (article.body || '').split('\n').filter(p => p.trim()).map(p => `<p>${escapeHtml(p)}</p>`).join('');
        const sources = (() => {
            try { return Array.isArray(article.sources) ? article.sources : JSON.parse(article.sources || '[]'); }
            catch { return []; }
        })();
        const sourcesHtml = sources.length
            ? `<div class="sources-section"><p class="sources-label">Sources</p>${
                sources.map(s => `<a href="${escapeAttr(s.url)}" target="_blank" rel="noopener nofollow">${escapeHtml(s.title)}</a>`).join('')
              }</div>`
            : '';
        const relatedHtml = related.length
            ? `<aside class="related-section" style="margin-top:48px;padding-top:28px;border-top:1px solid #1a1a1a">
                 <p class="sources-label">Related dispatches</p>
                 <ul style="list-style:none;padding:0;margin:0">${
                   related.map(r => `<li style="margin-bottom:12px"><a href="/article/${escapeAttr(r.slug)}" style="color:#cc0000;text-decoration:none">${escapeHtml(r.title)}</a></li>`).join('')
                 }</ul>
               </aside>`
            : '';

        const html = loadArticleTpl()
            .replace(/{{title}}/g, escapeHtml(article.title))
            .replace(/{{excerpt}}/g, escapeHtml(article.excerpt || ''))
            .replace(/{{slug}}/g, escapeAttr(article.slug))
            .replace(/{{region}}/g, escapeHtml(article.region || 'World'))
            .replace(/{{hero_image}}/g, escapeAttr(heroImg))
            .replace(/{{author}}/g, escapeHtml(author))
            .replace(/{{date}}/g, dateIso)
            .replace(/{{modified}}/g, modifiedIso)
            .replace(/{{body_html}}/g, paragraphs)
            .replace(/{{sources_html}}/g, sourcesHtml)
            .replace(/{{related_html}}/g, relatedHtml);

        res.set('Content-Type', 'text/html; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
        res.send(html);
    } catch (e) {
        console.error('[GET /article/:slug]', e);
        res.status(500).send('Server error');
    }
});

// ─── Sitemap (dynamic, includes articles) ─────────────────────────────
app.get('/sitemap.xml', async (req, res) => {
    try {
        const articles = await getArticles({ limit: 1000 });
        const latest = articles[0]?.modified || articles[0]?.date || new Date().toISOString();

        const urls = [
            `<url><loc>${SITE_URL}/</loc><lastmod>${new Date(latest).toISOString()}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
            `<url><loc>${SITE_URL}/archive</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`,
            `<url><loc>${SITE_URL}/about.html</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>`,
            `<url><loc>${SITE_URL}/contact.html</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
        ];
        for (const a of articles) {
            const lastmod = new Date(a.modified || a.date).toISOString();
            urls.push(
                `<url>
                  <loc>${SITE_URL}/article/${escapeAttr(a.slug)}</loc>
                  <lastmod>${lastmod}</lastmod>
                  <changefreq>weekly</changefreq>
                  <priority>0.8</priority>
                  ${a.hero_image ? `<image:image><image:loc>${escapeAttr(a.hero_image)}</image:loc><image:title>${escapeHtml(a.title)}</image:title></image:image>` : ''}
                </url>`
            );
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
    xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
    xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`;
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=600');
        res.send(xml);
    } catch (e) {
        console.error('[GET /sitemap.xml]', e);
        res.status(500).send('Sitemap error');
    }
});

// ─── RSS feed ─────────────────────────────────────────────────────────
app.get('/feed.xml', async (req, res) => {
    try {
        const articles = await getArticles({ limit: 50 });
        const items = articles.map(a => {
            const url = `${SITE_URL}/article/${a.slug}`;
            const pub = new Date(a.date).toUTCString();
            const author = a.author || 'POTUS Watch Editorial';
            const paragraphs = (a.body || '').split('\n').filter(p => p.trim()).map(p => `<p>${escapeHtml(p)}</p>`).join('');
            const heroImg = a.hero_image ? `<img src="${escapeAttr(a.hero_image)}" alt="${escapeAttr(a.title)}"/>` : '';
            return `<item>
                <title><![CDATA[${a.title}]]></title>
                <link>${url}</link>
                <guid isPermaLink="true">${url}</guid>
                <pubDate>${pub}</pubDate>
                <dc:creator><![CDATA[${author}]]></dc:creator>
                <category>${escapeHtml(a.region || 'World')}</category>
                <description><![CDATA[${a.excerpt || ''}]]></description>
                <content:encoded><![CDATA[${heroImg}${paragraphs}]]></content:encoded>
            </item>`;
        }).join('\n');
        const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}/</link>
    <description>Independent foreign policy intelligence. Live analysis updated every hour.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/logo.png</url>
      <title>${SITE_NAME}</title>
      <link>${SITE_URL}/</link>
    </image>
    ${items}
  </channel>
</rss>`;
        res.set('Content-Type', 'application/rss+xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=600');
        res.send(rss);
    } catch (e) {
        console.error('[GET /feed.xml]', e);
        res.status(500).send('Feed error');
    }
});

// ─── robots.txt ────────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(`User-agent: *
Allow: /
Disallow: /get-articles
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`);
});

// ─── Subscribe proxy (keeps beehiiv API key off the client) ───────────
app.post('/api/subscribe', async (req, res) => {
    const email = (req.body?.email || '').trim();
    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Invalid email' });
    }
    try {
        const r = await fetch(`https://api.beehiiv.com/v2/publications/${process.env.BEEHIIV_PUB_ID}/subscriptions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.BEEHIIV_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, reactivate_existing: true, send_welcome_email: true })
        });
        if (!r.ok) {
            console.error('[subscribe] beehiiv non-2xx', r.status, await r.text());
            return res.status(502).json({ error: 'Subscription service unavailable' });
        }
        res.json({ ok: true });
    } catch (e) {
        console.error('[subscribe]', e);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── KEEP your existing /get-articles handler somewhere above ─────────
// (Don't remove it — the homepage JS still calls it for refresh and load-more.
//  The new homepage handler ALSO renders articles inline, but the XHR path
//  remains the way the page stays "live" without a full reload.)

// ─── Static files (CSS, images, etc.) — adjust to your layout ─────────
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    extensions: ['html']
}));

// ─── Bind to Railway's PORT ───────────────────────────────────────────
// Railway sets process.env.PORT. If you hardcoded 3000 or similar, that's
// likely a crash cause — Railway will fail the healthcheck.
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] listening on ${PORT}`);
});
