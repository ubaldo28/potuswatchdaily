const { createClient } = require('@supabase/supabase-js');
module.exports = async (req, res) => {
  const slug = req.query.slug || '';
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data, error } = await supabase.from('articles').select('*').eq('slug', slug).limit(1).single();
    if (error || !data) { res.status(404).send('<html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px"><h1>Article not found</h1><a href="/" style="color:#cc0000">Back to feed</a></body></html>'); return; }
    const a = data;
    const url = 'https://www.potuswatchdaily.com/article/' + a.slug;
    const desc = a.meta_description || a.excerpt || '';
    const img = a.hero_image || a.image || '';
    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const paras = (a.body||'').split('\n').filter(p=>p.trim()).map(p=>{
      if(p.includes('SPONSORED')) return '<div style="background:#111;border-left:2px solid #cc0000;padding:14px 18px;margin:28px 0;font-size:13px;color:#888;line-height:1.6">'+p.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="nofollow" style="color:#cc0000">$1</a>')+'</div>';
      return '<p>'+p+'</p>';
    }).join('');
    const sources = (() => { try { return JSON.parse(a.sources||'[]'); } catch(e) { return []; } })();
  const wordCount = (a.body || '').split(/s+/).length;
  const readTime = Math.max(1, Math.round(wordCount / 200)) + ' min read';

  // Newsletter signup
  const newsletterHTML = `<div style="margin-top:48px;padding:32px;background:#111;border:1px solid #1e1e1e;border-top:3px solid #cc0000;border-radius:3px;text-align:center"><p style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#cc0000;margin-bottom:12px;font-family:Inter,sans-serif">Free Newsletter</p><p style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:900;color:#fff;margin-bottom:8px">Never miss a dispatch</p><p style="font-size:13px;color:#666;margin-bottom:20px;line-height:1.6">Weekly foreign policy intelligence delivered free to your inbox.</p><a href="https://potuswatchdaily.beehiiv.com/subscribe" target="_blank" style="display:inline-block;background:#cc0000;color:#fff;text-decoration:none;padding:10px 28px;border-radius:3px;font-size:12px;font-weight:600;font-family:Inter,sans-serif">Subscribe free</a></div>`;

  // Related articles
  const { data: related } = await supabase
    .from('articles')
    .select('title, slug, excerpt, region, date, image')
    .eq('region', a.region)
    .neq('slug', a.slug)
    .not('slug', 'is', null)
    .order('id', { ascending: false })
    .limit(3);

  const relatedHTML = (related && related.length) ? `
  <div style="margin-top:48px;padding-top:32px;border-top:1px solid #1e1e1e">
    <p style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#444;margin-bottom:20px">More from ${esc(a.region)}</p>
    <div style="display:grid;gap:20px">
      ${related.map(r => `
      <a href="/article/${r.slug}" style="display:grid;grid-template-columns:${r.image ? '80px 1fr' : '1fr'};gap:14px;text-decoration:none;padding:16px;background:#111;border:1px solid #1e1e1e;border-radius:3px;transition:border-color 0.15s" onmouseover="this.style.borderColor='#333'" onmouseout="this.style.borderColor='#1e1e1e'">
        ${r.image ? `<img src="${r.image}&w=160&q=70&fit=crop" style="width:80px;height:60px;object-fit:cover;border-radius:2px" loading="lazy" alt="">` : ''}
        <div>
          <p style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#cc0000;margin-bottom:5px">${esc(r.region)}</p>
          <p style="font-family:'Playfair Display',Georgia,serif;font-size:15px;font-weight:700;color:#e0e0e0;line-height:1.3;margin-bottom:4px">${esc(r.title)}</p>
          <p style="font-size:11px;color:#555">${esc(r.date || '')}</p>
        </div>
      </a>`).join('')}
    </div>
  </div>` : '';
    const jsonLd = JSON.stringify({'@context':'https://schema.org','@type':'NewsArticle',headline:a.title,description:desc,datePublished:a.date,author:{'@type':'Organization',name:'POTUS Watch Daily'},publisher:{'@type':'Organization',name:'POTUS Watch Daily',url:'https://potuswatchdaily.com'},image:img,url:url,articleSection:a.region});
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','public, s-maxage=1800, stale-while-revalidate=3600');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="google-adsense-account" content="ca-pub-7380718671497895"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(a.title)} — POTUS Watch Daily</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%23cc0000'/><text x='50%25' y='50%25' font-family='Georgia,serif' font-size='14' font-weight='bold' fill='white' text-anchor='middle' dominant-baseline='central'>PW</text></svg>">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(a.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${jsonLd}</script>
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://potuswatchdaily.com"},{"@type":"ListItem","position":2,"name":a.region,"item":"https://potuswatchdaily.com"},{"@type":"ListItem","position":3,"name":a.title,"item":url}]})}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-FRVP4L2Z2T"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-FRVP4L2Z2T');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7380718671497895" crossorigin="anonymous"></script>
<script>(adsbygoogle=window.adsbygoogle||[]).push({google_ad_client:"ca-pub-7380718671497895",enable_page_level_ads:true});</script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#0a0a0a;color:#fff;min-height:100vh;-webkit-font-smoothing:antialiased}
.top-bar{height:3px;background:#cc0000}
.masthead{background:#0a0a0a;border-bottom:1px solid #1e1e1e;padding:0 24px}
.masthead-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;height:64px}
.logo{font-family:'Playfair Display',serif;font-size:26px;font-weight:900;color:#fff;text-decoration:none}
.logo em{color:#cc0000;font-style:normal}
.hero-img{width:100%;max-height:480px;object-fit:cover;display:block}
.article-content{max-width:700px;margin:0 auto;padding:48px 24px 80px}
.back{display:inline-flex;align-items:center;gap:6px;color:#555;text-decoration:none;font-size:12px;margin-bottom:36px;transition:color 0.15s}
.back:hover{color:#fff}
.tag{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#cc0000}
.byline{font-size:11px;color:#444}
.eyebrow{display:flex;align-items:center;gap:10px;margin-bottom:14px}
h1{font-family:'Playfair Display',serif;font-size:38px;font-weight:900;line-height:1.15;color:#fff;margin-bottom:20px}
hr{border:none;border-top:1px solid #1e1e1e;margin-bottom:28px}
.article-body p{font-size:17px;line-height:1.9;color:#b0b0b0;margin-bottom:22px;font-weight:300}
.article-body p:first-child{font-size:19px;color:#d8d8d8}
.sources{margin-top:40px;padding-top:24px;border-top:1px solid #1a1a1a}
.sources-label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#444;margin-bottom:12px}
.sources a{display:block;font-size:12px;color:#555;margin-bottom:8px;text-decoration:none}
.sources a:hover{color:#cc0000}
.footer{background:#0d0d0d;border-top:1px solid #1a1a1a;padding:32px 24px;margin-top:40px}
.footer-inner{max-width:700px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
.footer-logo{font-family:'Playfair Display',serif;font-size:18px;font-weight:900;color:#fff}
.footer-logo em{color:#cc0000;font-style:normal}
.footer-copy{font-size:11px;color:#333}
@media(max-width:640px){h1{font-size:26px}.article-content{padding:32px 16px 60px}}
</style>
</head>
<body>
<div class="top-bar"></div>
<header class="masthead"><div class="masthead-inner"><a class="logo" href="/">POTUS <em>Watch</em></a></div></header>
${img ? '<img class="hero-img" src="'+img+'" alt="'+esc(a.title)+'" fetchpriority="high">' : ''}
<div class="article-content">
  <a class="back" href="/">&#8592; Back to feed</a>
  <div class="eyebrow"><span class="tag">POTUS Watch · ${esc(a.region)}</span><span style="color:#2a2a2a">·</span><span class="byline">${esc(a.date||'')} ${a.time ? '· '+esc(a.time) : ''} · ${readTime}</span></div>
  <h1>${esc(a.title)}</h1>
  <hr>
  <div class="article-body">${paras}</div>
  
  <div style="margin-top:48px;padding:28px 32px;background:#111;border:1px solid #1e1e1e;border-top:3px solid #cc0000;border-radius:3px">
    <p style="font-family:'Playfair Display',Georgia,serif;font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">Keep the dispatches coming</p>
    <p style="font-size:13px;color:#666;line-height:1.6;margin-bottom:20px">POTUS Watch Daily is independent and ad-light by design. If this briefing was useful, a coffee keeps the lights on.</p>
    <a href="https://www.buymeacoffee.com/POTUSwatch" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;background:#cc0000;color:#fff;text-decoration:none;padding:10px 20px;border-radius:3px;font-size:12px;font-weight:600;letter-spacing:0.5px;font-family:Inter,sans-serif;transition:background 0.15s">☕ Buy me a coffee</a>
  </div>
  ${sources.length ? '<div class="sources"><p class="sources-label">Sources</p>'+sources.map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title)+'</a>').join('')+'</div>' : ''}
  ${newsletterHTML}${relatedHTML}
</div>
<footer class="footer"><div class="footer-inner"><div class="footer-logo">POTUS <em>Watch</em></div><span class="footer-copy">&copy; 2026 POTUS Watch Daily.</span></div></footer>
</body></html>`);
  } catch(e) { res.status(500).send('Error: '+e.message); }
};