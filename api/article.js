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


  const shareUrl = encodeURIComponent('https://www.potuswatchdaily.com/article/' + a.slug);
  const shareText = encodeURIComponent(a.title + ' — POTUS Watch Daily');
  const socialHTML = `
  <div style="margin-top:40px;padding-top:24px;border-top:1px solid #1a1a1a">
    <p style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#444;margin-bottom:14px;font-family:Inter,sans-serif">Share this dispatch</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <a href="https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#000;border:1px solid #333;text-decoration:none">
        <svg width="16" height="16" fill="#fff" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#1877f2;text-decoration:none">
        <svg width="16" height="16" fill="#fff" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      </a>
      <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#25D366;text-decoration:none">
        <svg width="16" height="16" fill="#fff" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>
      <a href="https://reddit.com/submit?url=${shareUrl}&title=${shareText}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#FF4500;text-decoration:none">
        <svg width="16" height="16" fill="#fff" viewBox="0 0 24 24"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
      </a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#0A66C2;text-decoration:none">
        <svg width="16" height="16" fill="#fff" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      </a>
    </div>
  </div>`;
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
  ${socialHTML}${newsletterHTML}${relatedHTML}
</div>
<footer class="footer"><div class="footer-inner"><div class="footer-logo">POTUS <em>Watch</em></div><span class="footer-copy">&copy; 2026 POTUS Watch Daily.</span></div></footer>
</body></html>`);
  } catch(e) { res.status(500).send('Error: '+e.message); }
};