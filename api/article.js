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
    const author = 'POTUS Watch Daily Editorial Staff';
    const desc = esc(a.meta_description || a.excerpt || '');
    const title = esc(a.title || '');
    const dateIso = a.published_at || a.created_at || new Date().toISOString();
    const words = (a.body||'').split(/\s+/).length;
    const readTime = Math.max(1, Math.round(words/200)) + ' min read';
    const paras = (a.body||'').split(/\n+/).filter(Boolean).map(p=>{
      if(p.startsWith('## ')) return `<h2 style="font-family:'Playfair Display',Georgia,serif;font-size:20px;color:#fff;margin:32px 0 12px;font-weight:700">${esc(p.slice(3))}</h2>`;
      if(p.startsWith('# ')) return `<h2 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;color:#fff;margin:32px 0 12px;font-weight:700">${esc(p.slice(2))}</h2>`;
      return `<p>${esc(p)}</p>`;
    }).join('');
    const sources = (() => { try { return JSON.parse(a.sources||'[]'); } catch(e) { return []; } })();

    const encodedUrl = encodeURIComponent(canonicalUrl);
    const encodedTitle = encodeURIComponent(a.title||'');
    const iconBtn = 'display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#111;border:1px solid #222;text-decoration:none;transition:background 0.15s';
    const socialHTML = `<div style="margin-top:32px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#555;font-family:Inter,Arial,sans-serif;margin-right:4px">Share</span>
      <a href="https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener" title="Share on X" style="${iconBtn}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener" title="Share on Facebook" style="${iconBtn}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
      <a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}" target="_blank" rel="noopener" title="Share on LinkedIn" style="${iconBtn}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
      <a href="https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}" target="_blank" rel="noopener" title="Share on Reddit" style="${iconBtn}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg></a>
      <a href="https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}" target="_blank" rel="noopener" title="Share on WhatsApp" style="${iconBtn}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg></a>
      <a href="https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}" target="_blank" rel="noopener" title="Share on Telegram" style="${iconBtn}"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>
    </div>`;

    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": a.title,
      "description": a.meta_description || a.excerpt,
      "image": img,
      "datePublished": dateIso,
      "dateModified": dateIso,
      "author": { "@type": "Organization", "name": SITE_NAME, "url": `${SITE_URL}/author.html` },
      "publisher": { "@type": "Organization", "name": SITE_NAME, "url": SITE_URL, "logo": { "@type": "ImageObject", "url": `${SITE_URL}/logo.png` } },
      "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl }
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="google-adsense-account" content="ca-pub-7380718671497895">
<title>${title}</title>
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
  <div class="eyebrow"><span class="tag">${esc(region)}</span><span style="color:#333">·</span><span class="byline">By <a href="/author.html" rel="author">${esc(author)}</a> · <time datetime="${dateIso}">${esc(a.date||'')}</time>${a.time ? ' · '+esc(a.time) : ''} · ${readTime}</span></div>
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
  <span class="footer-copy">&copy; 2026 POTUS Watch Daily. <a href="/about.html">About</a> · <a href="/editorial.html">Editorial Standards</a> · <a href="/contact.html">Contact</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a> · <a href="/disclaimer.html">Disclaimer</a></span>
</div></footer>
</body></html>`);
  } catch(e) { res.status(500).send('Error: '+e.message); }
};
