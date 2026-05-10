const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('title, slug, excerpt, region, date, time')
      .order('id', { ascending: false })
      .limit(300);
    if (error) throw error;

    const byRegion = {};
    data.forEach(a => {
      const r = a.region || 'World';
      if (!byRegion[r]) byRegion[r] = [];
      byRegion[r].push(a);
    });

    const regionBlocks = Object.keys(byRegion).map(region => {
      const items = byRegion[region].map(a => `
        <div class="archive-item">
          <a href="/article/${a.slug}" class="archive-link">
            <span class="archive-title">${esc(a.title)}</span>
            <span class="archive-meta">${a.date || ''}${a.time ? ' · ' + a.time : ''}</span>
          </a>
          ${a.excerpt ? `<p class="archive-excerpt">${esc(a.excerpt)}</p>` : ''}
        </div>`).join('');
      return `
        <section class="region-section">
          <h2 class="region-heading">${esc(region)}</h2>
          ${items}
        </section>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Archive — POTUS Watch Daily</title>
<meta name="description" content="Full archive of foreign policy intelligence dispatches from POTUS Watch Daily. Browse all regions: Americas, China, NATO, Iran, Middle East, Russia, Trade, and Analysis.">
<link rel="canonical" href="https://www.potuswatchdaily.com/archive">
<meta name="google-adsense-account" content="ca-pub-7380718671497895">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='%230a0a0a'/><circle cx='200' cy='200' r='160' fill='none' stroke='%23cc0000' stroke-width='12'/><circle cx='200' cy='200' r='20' fill='%23cc0000'/></svg>">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-FRVP4L2Z2T"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-FRVP4L2Z2T');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7380718671497895" crossorigin="anonymous"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#0a0a0a;color:#fff;min-height:100vh;-webkit-font-smoothing:antialiased}
.top-bar{height:3px;background:#cc0000}
.masthead{background:#0a0a0a;border-bottom:1px solid #1e1e1e;padding:0 24px}
.masthead-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;height:64px}
.logo-wrap{text-decoration:none;display:flex;align-items:center;gap:10px}
.logo-text{font-family:'Playfair Display',serif;font-size:24px;font-weight:900;color:#fff;letter-spacing:-0.5px}
.logo-text em{color:#cc0000;font-style:normal}
.logo-sub{font-size:8px;color:#666;letter-spacing:2px;text-transform:uppercase;margin-top:2px}
.page{max-width:900px;margin:0 auto;padding:56px 24px 100px}
.page-eyebrow{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#cc0000;margin-bottom:12px}
h1{font-family:'Playfair Display',serif;font-size:36px;font-weight:900;color:#fff;margin-bottom:8px}
.page-sub{font-size:14px;color:#555;margin-bottom:48px}
.region-section{margin-bottom:48px}
.region-heading{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#444;padding-bottom:12px;border-bottom:1px solid #1a1a1a;margin-bottom:0}
.archive-item{border-bottom:1px solid #141414;padding:16px 0}
.archive-link{display:flex;justify-content:space-between;align-items:baseline;gap:16px;text-decoration:none;margin-bottom:4px}
.archive-link:hover .archive-title{color:#cc0000}
.archive-title{font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:#e0e0e0;line-height:1.35;transition:color 0.15s;flex:1}
.archive-meta{font-size:11px;color:#333;white-space:nowrap;flex-shrink:0}
.archive-excerpt{font-size:13px;color:#555;line-height:1.5;margin-top:2px}
.footer{background:#0d0d0d;border-top:1px solid #1a1a1a;padding:32px 24px;margin-top:40px}
.footer-inner{max-width:900px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
.footer-logo{font-family:'Playfair Display',serif;font-size:18px;font-weight:900;color:#fff}
.footer-logo em{color:#cc0000;font-style:normal}
.footer-links{display:flex;gap:20px;flex-wrap:wrap}
.footer-links a{color:#555;font-size:12px;text-decoration:none}
.footer-links a:hover{color:#fff}
.footer-copy{font-size:11px;color:#444;width:100%;margin-top:8px}
@media(max-width:640px){h1{font-size:26px}.archive-link{flex-direction:column;gap:4px}.archive-meta{font-size:10px}}
</style>
</head>
<body>
<div class="top-bar"></div>
<header class="masthead">
  <div class="masthead-inner">
    <a href="/" style="display:flex;align-items:center;text-decoration:none;height:52px"><svg width="300" height="52" viewBox="0 0 300 52" xmlns="http://www.w3.org/2000/svg"><circle cx="26" cy="26" r="18" fill="none" stroke="#cc0000" stroke-width="1.5"/><ellipse cx="26" cy="26" rx="18" ry="6.5" fill="none" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><ellipse cx="26" cy="26" rx="18" ry="12" fill="none" stroke="#cc0000" stroke-width="0.6" opacity="0.3"/><line x1="8" y1="26" x2="44" y2="26" stroke="#cc0000" stroke-width="0.8" opacity="0.4"/><ellipse cx="26" cy="26" rx="7" ry="18" fill="none" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><line x1="26" y1="8" x2="26" y2="44" stroke="#cc0000" stroke-width="0.8" opacity="0.4"/><line x1="26" y1="2" x2="26" y2="8" stroke="#cc0000" stroke-width="1.5"/><line x1="26" y1="44" x2="26" y2="50" stroke="#cc0000" stroke-width="1.5"/><line x1="2" y1="26" x2="8" y2="26" stroke="#cc0000" stroke-width="1.5"/><line x1="44" y1="26" x2="50" y2="26" stroke="#cc0000" stroke-width="1.5"/><circle cx="26" cy="26" r="3" fill="#cc0000"/><line x1="23" y1="5" x2="29" y2="5" stroke="#cc0000" stroke-width="1"/><line x1="23" y1="47" x2="29" y2="47" stroke="#cc0000" stroke-width="1"/><line x1="5" y1="23" x2="5" y2="29" stroke="#cc0000" stroke-width="1"/><line x1="47" y1="23" x2="47" y2="29" stroke="#cc0000" stroke-width="1"/><text x="60" y="24" font-size="18" font-weight="900" fill="#ffffff" font-family="Georgia, serif" letter-spacing="0.5">POTUS <tspan fill="#cc0000">Watch</tspan> <tspan fill="#888888" font-size="13" font-weight="400">Daily</tspan></text><line x1="60" y1="32" x2="298" y2="32" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><text x="60" y="46" font-size="9.5" fill="#666666" font-family="Inter, Arial, sans-serif" letter-spacing="1">FOREIGN POLICY INTELLIGENCE  ·  © 2026</text></svg></a>
    <a href="/" style="font-size:12px;color:#555;text-decoration:none">← Back to feed</a>
  </div>
</header>
<div class="page">
  <div class="page-eyebrow">Archive</div>
  <h1>All Dispatches</h1>
  <p class="page-sub">${data.length} dispatches across 8 regions</p>
  ${regionBlocks}
</div>
<footer class="footer">
  <div class="footer-inner">
    <div style="margin-bottom:8px"><svg width="300" height="52" viewBox="0 0 300 52" xmlns="http://www.w3.org/2000/svg"><circle cx="26" cy="26" r="18" fill="none" stroke="#cc0000" stroke-width="1.5"/><ellipse cx="26" cy="26" rx="18" ry="6.5" fill="none" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><ellipse cx="26" cy="26" rx="18" ry="12" fill="none" stroke="#cc0000" stroke-width="0.6" opacity="0.3"/><line x1="8" y1="26" x2="44" y2="26" stroke="#cc0000" stroke-width="0.8" opacity="0.4"/><ellipse cx="26" cy="26" rx="7" ry="18" fill="none" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><line x1="26" y1="8" x2="26" y2="44" stroke="#cc0000" stroke-width="0.8" opacity="0.4"/><line x1="26" y1="2" x2="26" y2="8" stroke="#cc0000" stroke-width="1.5"/><line x1="26" y1="44" x2="26" y2="50" stroke="#cc0000" stroke-width="1.5"/><line x1="2" y1="26" x2="8" y2="26" stroke="#cc0000" stroke-width="1.5"/><line x1="44" y1="26" x2="50" y2="26" stroke="#cc0000" stroke-width="1.5"/><circle cx="26" cy="26" r="3" fill="#cc0000"/><line x1="23" y1="5" x2="29" y2="5" stroke="#cc0000" stroke-width="1"/><line x1="23" y1="47" x2="29" y2="47" stroke="#cc0000" stroke-width="1"/><line x1="5" y1="23" x2="5" y2="29" stroke="#cc0000" stroke-width="1"/><line x1="47" y1="23" x2="47" y2="29" stroke="#cc0000" stroke-width="1"/><text x="60" y="24" font-size="18" font-weight="900" fill="#ffffff" font-family="Georgia, serif" letter-spacing="0.5">POTUS <tspan fill="#cc0000">Watch</tspan> <tspan fill="#888888" font-size="13" font-weight="400">Daily</tspan></text><line x1="60" y1="32" x2="298" y2="32" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><text x="60" y="46" font-size="9.5" fill="#666666" font-family="Inter, Arial, sans-serif" letter-spacing="1">FOREIGN POLICY INTELLIGENCE  ·  © 2026</text></svg></div>
    <div class="footer-links">
      <a href="/">Home</a>
      <a href="/about.html">About</a>
      <a href="/contact.html">Contact</a>
      <a href="/privacy.html">Privacy Policy</a>
      <a href="/terms.html">Terms of Service</a>
      <a href="/disclaimer.html">Disclaimer</a>
    </div>
    <div class="footer-copy">&copy; 2026 POTUS Watch Daily. All rights reserved.</div>
  </div>
</footer>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
    res.send(html);
  } catch (e) {
    console.error('Archive error:', e.message);
    res.status(500).send('Error loading archive. Please try again.');
  }
};

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
