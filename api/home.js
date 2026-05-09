// Server-renders the homepage with articles inlined into the HTML.
// JS still works on top — calls /get-articles for live refresh and load-more.
// This makes the homepage crawler-readable without changing the existing UX.

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://www.potuswatchdaily.com';

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return iso; }
}

function renderHero(articles) {
    if (!articles.length) return '';
    const [main, side1, side2] = articles;

    const heroMain = (a) => {
        const img = a.hero_image || a.image
            ? `<img class="hero-main-img" src="${esc(a.hero_image || a.image)}" alt="${esc(a.title)}" fetchpriority="high">`
            : `<div class="hero-placeholder" style="height:480px"><span class="hero-placeholder-text">${esc(a.region || 'POTUS Watch')}</span></div>`;
        return `<div class="hero-main"><a href="/article/${esc(a.slug)}" style="display:block;text-decoration:none;color:inherit">
            ${img}
            <div class="overlay">
                <span class="tag">${esc(a.region || 'World')}</span>
                <div class="card-title">${esc(a.title)}</div>
                <div class="card-excerpt">${esc(a.excerpt || '')}</div>
            </div>
        </a></div>`;
    };

    const heroSmall = (a) => {
        const img = a.image
            ? `<img class="hero-small-img" src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy">`
            : `<div class="hero-placeholder" style="height:100%;min-height:200px"><span class="hero-placeholder-text" style="font-size:11px">${esc(a.region || 'POTUS Watch')}</span></div>`;
        return `<div class="hero-small"><a href="/article/${esc(a.slug)}" style="display:block;text-decoration:none;color:inherit;height:100%">
            ${img}
            <div class="overlay">
                <span class="tag">${esc(a.region || 'World')}</span>
                <div class="card-title">${esc(a.title)}</div>
            </div>
        </a></div>`;
    };

    let html = heroMain(main);
    if (side1 || side2) {
        html += '<div class="hero-side">';
        if (side1) html += heroSmall(side1);
        if (side2) html += heroSmall(side2);
        html += '</div>';
    }
    return html;
}

function renderGrid(articles) {
    return articles.map(a => {
        const img = a.image
            ? `<img class="card-img" src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy">`
            : `<div class="card-placeholder"><div class="card-placeholder-inner">${esc(a.region || 'World')}</div></div>`;
        return `<div class="card"><a href="/article/${esc(a.slug)}" style="display:block;text-decoration:none;color:inherit">
            ${img}
            <div class="card-body">
                <span class="tag">${esc(a.region || 'World')}</span>
                <div class="card-title">${esc(a.title)}</div>
                ${a.excerpt ? `<div class="card-excerpt">${esc(a.excerpt)}</div>` : ''}
                <div class="card-meta">${esc(fmtDate(a.date))}${a.time ? ' · ' + esc(a.time) : ''}</div>
            </div>
        </a></div>`;
    }).join('');
}

function renderTicker(articles) {
    return articles.slice(0, 8).map(a => `<span>${esc(a.title)}</span>`).join('');
}

let _indexCache = null;
function loadIndexTemplate() {
    if (!_indexCache) {
        const candidates = [
            path.join(process.cwd(), 'public', 'index.html'),
            path.join(process.cwd(), 'index.html'),
        ];
        for (const p of candidates) {
            try { _indexCache = fs.readFileSync(p, 'utf8'); break; } catch {}
        }
    }
    return _indexCache;
}

module.exports = async (req, res) => {
    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        const { data, error } = await supabase
            .from('articles')
            .select('*')
            .not('slug', 'is', null)
            .order('id', { ascending: false })
            .limit(30);

        if (error) throw error;

        const articles = (data || []).filter(a => a.slug && a.slug.length > 3);

        let html = loadIndexTemplate();
        if (!html) {
            res.status(500).send('Homepage template missing');
            return;
        }

        const heroHtml = renderHero(articles.slice(0, 3));
        const gridHtml = renderGrid(articles.slice(3, 21));
        const tickerHtml = renderTicker(articles);

        html = html
            .replace('<div id="hero" class="hero"></div>', `<div id="hero" class="hero">${heroHtml}</div>`)
            .replace('<div id="grid" class="grid"></div>', `<div id="grid" class="grid">${gridHtml}</div>`)
            .replace(
                /<div class="ticker-inner" id="ticker-inner">[\s\S]*?<\/div>/,
                `<div class="ticker-inner" id="ticker-inner">${tickerHtml}</div>`
            );

        // Inject articles JSON so the client-side JS can skip its first XHR.
        const inline = `<script id="initial-articles" type="application/json">${JSON.stringify(articles).replace(/</g, '\\u003c')}</script>`;
        html = html.replace('</body>', `${inline}\n</body>`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        res.send(html);
    } catch (e) {
        console.error('[home]', e);
        // On error, fall through to static file (Vercel serves public/index.html)
        try {
            const fallback = loadIndexTemplate();
            if (fallback) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.send(fallback);
                return;
            }
        } catch {}
        res.status(500).send('Homepage error');
    }
};
