import { createClient } from '@supabase/supabase-js';

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function fmtDate(article) {
  const iso = article && (article.published_at || article.created_at);
  if (iso) {
    const d = new Date(iso);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2024) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return article && article.date ? String(article.date) : '';
}

function renderHero(articles) {
  if (!articles.length) return '';
  const [main, side1, side2] = articles;
  const heroMain = (a) => {
    const img = (a.hero_image || a.image)
      ? `<img class="hero-main-img" src="${esc(a.hero_image || a.image)}" alt="${esc(a.title)}" fetchpriority="high">`
      : `<div class="hero-placeholder" style="height:480px"><span class="hero-placeholder-text">${esc(a.region || 'POTUS Watch')}</span></div>`;
    return `<div class="hero-main"><a href="/article/${esc(a.slug)}" style="display:block;text-decoration:none;color:inherit">${img}<div class="overlay"><span class="tag">${esc(a.region || 'World')}</span><div class="card-title">${esc(a.title)}</div><div class="card-excerpt">${esc(a.excerpt || '')}</div></div></a></div>`;
  };
  const heroSmall = (a) => {
    const img = a.image
      ? `<img class="hero-small-img" src="${esc(a.image)}" alt="${esc(a.title)}" loading="lazy">`
      : `<div class="hero-placeholder" style="height:100%;min-height:200px"><span class="hero-placeholder-text" style="font-size:11px">${esc(a.region || 'POTUS Watch')}</span></div>`;
    return `<div class="hero-small"><a href="/article/${esc(a.slug)}" style="display:block;text-decoration:none;color:inherit;height:100%">${img}<div class="overlay"><span class="tag">${esc(a.region || 'World')}</span><div class="card-title">${esc(a.title)}</div></div></a></div>`;
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
    return `<div class="card"><a href="/article/${esc(a.slug)}" style="display:block;text-decoration:none;color:inherit">${img}<div class="card-body"><span class="tag">${esc(a.region || 'World')}</span><div class="card-title">${esc(a.title)}</div>${a.excerpt ? `<div class="card-excerpt">${esc(a.excerpt)}</div>` : ''}<div class="card-meta">${esc(fmtDate(a))}${a.time ? ' · ' + esc(a.time) : ''}</div></div></a></div>`;
  }).join('');
}

function renderTicker(articles) {
  return articles.slice(0, 8).map(a => `<span>${esc(a.title)}</span>`).join('');
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .not('slug', 'is', null)
      .order('id', { ascending: false })
      .limit(30);
    if (error) throw error;

    const articles = (data || []).filter(a => a.slug && a.slug.length > 3);

    // Load template from static assets
    const templateResp = await env.ASSETS.fetch(new Request(new URL('/templates/index.html', request.url)));
    let html = await templateResp.text();

    const heroHtml = renderHero(articles.slice(0, 3));
    const gridHtml = renderGrid(articles.slice(3, 21));
    const tickerHtml = renderTicker(articles);

    html = html
      .replace('<div id="hero" class="hero"></div>', `<div id="hero" class="hero">${heroHtml}</div>`)
      .replace('<div id="grid" class="grid"></div>', `<div id="grid" class="grid">${gridHtml}</div>`)
      .replace(/<div class="ticker-inner" id="ticker-inner">[\s\S]*?<\/div>/, `<div class="ticker-inner" id="ticker-inner">${tickerHtml}</div>`);

    const inline = `<script id="initial-articles" type="application/json">${JSON.stringify(articles).replace(/</g, '\\u003c')}</script>`;
    html = html.replace('</body>', `${inline}\n</body>`);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    });
  } catch (e) {
    console.error('[home]', e);
    // Fallback: serve template as-is
    try {
      const fallback = await env.ASSETS.fetch(new Request(new URL('/templates/index.html', request.url)));
      const html = await fallback.text();
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    } catch {}
    return new Response('Homepage error', { status: 500 });
  }
}
