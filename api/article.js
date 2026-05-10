const { createClient } = require('@supabase/supabase-js');

const SITE_URL = 'https://www.potuswatchdaily.com';
const SITE_NAME = 'POTUS Watch Daily';

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = async (req, res) => {
  const slug = req.query.slug || '';
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data: a, error } = await supabase.from('articles').select('*').eq('slug', slug).limit(1).single();
    if (error || !a) {
      res.status(404).send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Not Found — ${SITE_NAME}</title></head><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px;text-align:center"><h1 style="font-size:48px;color:#cc0000;margin:0">404</h1><p style="font-size:20px;color:#888">DISPATCH NOT FOUND</p><p style="color:#666">This briefing has gone dark</p><p style="color:#555;font-size:14px">The article or page you're looking for may have been removed, renamed, or never existed.</p><a href="/" style="color:#cc0000;font-family:Inter,sans-serif;font-size:14px">&#8592; Back to the feed</a></body></html>`);
      return;
    }

    const canonicalUrl = `${SITE_URL}/article/${a.slug}`;
    const img = a.hero_image || a.image || `${SITE_URL}/og-default.jpg`;
    const region = a.region || 'Analysis';
    const author = 'POTUS Watch Daily Editorial';
    const desc = esc(a.meta_description || a.excerpt || '');
    const title = esc(a.title || '');
    const dateIso = a.published_at || a.created_at || new Date().toISOString();
    const words = (a.body||'').split(/\s+/).length;
    const readTime = Math.max(1, Math.round(words/200)) + ' min read';
    const paras = (a.body||'').split(/\n+/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');
    const sources = (() => { try { return JSON.parse(a.sources||'[]'); } catch(e) { return []; } })();

    const socialHTML = `<div style="margin-top:32px;display:flex;gap:12px;flex-wrap:wrap">
      <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(canonicalUrl)}&text=${encodeURIComponent(a.title||'')}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:#111;color:#fff;text-decoration:none;padding:8px 16px;border-radius:3px;font-size:12px;border:1px solid #222">Share on X</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:#111;color:#fff;text-decoration:none;padding:8px 16px;border-radius:3px;font-size:12px;border:1px solid #222">Share on Facebook</a>
    </div>`;

    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": a.title,
      "description": a.meta_description || a.excerpt,
      "image": img,
      "datePublished": dateIso,
      "dateModified": dateIso,
      "author": { "@type": "Organization", "name": SITE_NAME, "url": SITE_URL },
      "publisher": { "@type": "Organization", "name": SITE_NAME, "url": SITE_URL, "logo": { "@type": "ImageObject", "url": `${SITE_URL}/logo.png` } },
      "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl }
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ${SITE_NAME}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonicalUrl}">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${esc(img)}">
<script type="application/ld+json">${jsonLd}</script>
<link rel="alternate" type="application/rss+xml" title="${SITE_NAME}" href="${SITE_URL}/feed.xml">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0a;color:#d0d0d0;font-family:'Georgia',serif;line-height:1.7}
.masthead{background:#0a0a0a;border-bottom:1px solid #1a1a1a;padding:12px 24px;display:flex;align-items:center}
.editorial-bar{background:#1a1a1a;border-bottom:1px solid #cc0000;padding:6px 24px;font-size:10px;color:#666;letter-spacing:1px;font-family:Inter,Arial,sans-serif;text-transform:uppercase}
.hero-img{width:100%;max-height:480px;object-fit:cover;display:block}
.article-content{max-width:740px;margin:0 auto;padding:40px 24px 80px}
.back{color:#cc0000;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif;letter-spacing:0.5px}
.eyebrow{margin:16px 0 8px;font-size:12px;font-family:Inter,Arial,sans-serif;color:#666;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.tag{background:#cc0000;color:#fff;padding:2px 8px;font-size:10px;letter-spacing:1px;text-transform:uppercase;font-family:Inter,Arial,sans-serif}
.byline a{color:#888;text-decoration:none}
h1{font-size:clamp(22px,4vw,36px);color:#fff;line-height:1.25;margin:12px 0 20px;font-family:'Playfair Display',Georgia,serif}
hr{border:none;border-top:1px solid #1e1e1e;margin:20px 0}
.article-body p{margin-bottom:18px;font-size:17px;color:#c8c8c8}
.sources{margin-top:40px;padding-top:20px;border-top:1px solid #1e1e1e}
.sources-label{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#555;font-family:Inter,Arial,sans-serif;margin-bottom:10px}
.sources a{display:block;color:#666;font-size:12px;text-decoration:none;margin-bottom:6px;font-family:Inter,Arial,sans-serif}
.sources a:hover{color:#cc0000}
.footer{border-top:1px solid #1a1a1a;padding:32px 24px;margin-top:60px}
.footer-inner{max-width:740px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
.footer-copy{font-size:11px;color:#444;font-family:Inter,Arial,sans-serif}
.footer-copy a{color:#444;text-decoration:none}
</style>
</head>
<body>
<header class="masthead">
  <a href="/" style="display:flex;align-items:center;text-decoration:none">
    <svg width="260" height="44" viewBox="0 0 300 52" xmlns="http://www.w3.org/2000/svg"><circle cx="26" cy="26" r="18" fill="none" stroke="#cc0000" stroke-width="1.5"/><ellipse cx="26" cy="26" rx="18" ry="6.5" fill="none" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><ellipse cx="26" cy="26" rx="18" ry="12" fill="none" stroke="#cc0000" stroke-width="0.6" opacity="0.3"/><line x1="8" y1="26" x2="44" y2="26" stroke="#cc0000" stroke-width="0.8" opacity="0.4"/><ellipse cx="26" cy="26" rx="7" ry="18" fill="none" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><line x1="26" y1="8" x2="26" y2="44" stroke="#cc0000" stroke-width="0.8" opacity="0.4"/><line x1="26" y1="2" x2="26" y2="8" stroke="#cc0000" stroke-width="1.5"/><line x1="26" y1="44" x2="26" y2="50" stroke="#cc0000" stroke-width="1.5"/><line x1="2" y1="26" x2="8" y2="26" stroke="#cc0000" stroke-width="1.5"/><line x1="44" y1="26" x2="50" y2="26" stroke="#cc0000" stroke-width="1.5"/><circle cx="26" cy="26" r="3" fill="#cc0000"/><line x1="23" y1="5" x2="29" y2="5" stroke="#cc0000" stroke-width="1"/><line x1="23" y1="47" x2="29" y2="47" stroke="#cc0000" stroke-width="1"/><line x1="5" y1="23" x2="5" y2="29" stroke="#cc0000" stroke-width="1"/><line x1="47" y1="23" x2="47" y2="29" stroke="#cc0000" stroke-width="1"/><text x="60" y="24" font-size="18" font-weight="900" fill="#ffffff" font-family="Georgia, serif" letter-spacing="0.5">POTUS <tspan fill="#cc0000">Watch</tspan> <tspan fill="#888888" font-size="13" font-weight="400">Daily</tspan></text><line x1="60" y1="32" x2="298" y2="32" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><text x="60" y="46" font-size="9.5" fill="#666666" font-family="Inter, Arial, sans-serif" letter-spacing="1">FOREIGN POLICY INTELLIGENCE  ·  © 2026</text></svg>
  </a>
</header>
<div class="editorial-bar">POTUS Watch Daily covers foreign policy through an analytical lens — policy, diplomacy, economics and strategy.</div>
${img && img !== `${SITE_URL}/og-default.jpg` ? `<img class="hero-img" src="${esc(img)}" alt="${title}" fetchpriority="high">` : ''}
<div class="article-content">
  <a class="back" href="/">&#8592; Back to feed</a>
  <div class="eyebrow"><span class="tag">${esc(region)}</span><span style="color:#333">·</span><span class="byline">By <a href="/about.html" rel="author">${esc(author)}</a> · <time datetime="${dateIso}">${esc(a.date||'')}</time>${a.time ? ' · '+esc(a.time) : ''} · ${readTime}</span></div>
  <h1>${title}</h1>
  <hr>
  <div class="article-body">${paras}</div>

  <aside style="margin-top:32px;padding:14px 18px;background:#0e0e0e;border-left:2px solid #444;font-size:11px;color:#666;line-height:1.5;font-family:Inter,sans-serif">
    <strong style="color:#888;letter-spacing:1px;text-transform:uppercase;font-size:9px">Affiliate disclosure</strong><br>
    With global instability rising, many readers are preparing. As an Amazon Associate POTUS Watch Daily earns from qualifying purchases &mdash; <a href="https://amzn.to/4cgkdM3" target="_blank" rel="noopener nofollow sponsored" style="color:#cc0000">view the #1 rated emergency survival kit</a>.
  </aside>

  <div style="margin-top:48px;padding:28px 32px;background:#111;border:1px solid #1e1e1e;border-top:3px solid #cc0000;border-radius:3px">
    <p style="font-family:'Playfair Display',Georgia,serif;font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">Keep the dispatches coming</p>
    <p style="font-size:13px;color:#666;line-height:1.6;margin-bottom:20px">POTUS Watch Daily is independent and ad-light by design. If this briefing was useful, a coffee keeps the lights on.</p>
    <a href="https://www.buymeacoffee.com/POTUSwatch" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;background:#cc0000;color:#fff;text-decoration:none;padding:10px 20px;border-radius:3px;font-size:12px;font-weight:600;letter-spacing:0.5px;font-family:Inter,sans-serif">&#9749; Buy me a coffee</a>
  </div>

  ${sources.length ? '<div class="sources"><p class="sources-label">Sources</p>'+sources.map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title)+'</a>').join('')+'</div>' : ''}
  ${socialHTML}
</div>
<footer class="footer"><div class="footer-inner">
  <svg width="200" height="36" viewBox="0 0 300 52" xmlns="http://www.w3.org/2000/svg"><circle cx="26" cy="26" r="18" fill="none" stroke="#cc0000" stroke-width="1.5"/><ellipse cx="26" cy="26" rx="18" ry="6.5" fill="none" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><circle cx="26" cy="26" r="3" fill="#cc0000"/><text x="60" y="24" font-size="18" font-weight="900" fill="#ffffff" font-family="Georgia, serif" letter-spacing="0.5">POTUS <tspan fill="#cc0000">Watch</tspan> <tspan fill="#888888" font-size="13" font-weight="400">Daily</tspan></text><line x1="60" y1="32" x2="298" y2="32" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><text x="60" y="46" font-size="9.5" fill="#666666" font-family="Inter, Arial, sans-serif" letter-spacing="1">FOREIGN POLICY INTELLIGENCE  ·  © 2026</text></svg>
  <span class="footer-copy">&copy; 2026 POTUS Watch Daily. <a href="/about.html">About</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> · <a href="/disclaimer.html">Disclaimer</a></span>
</div></footer>
</body></html>`);
  } catch(e) { res.status(500).send('Error: '+e.message); }
};
