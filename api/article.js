// Patched article.js — keeps all existing UI (share buttons, newsletter, related, BMC,
// sources) and adds the missing SEO bits.
const { createClient } = require('@supabase/supabase-js');

const SITE_URL = 'https://www.potuswatchdaily.com';
const SITE_NAME = 'POTUS Watch Daily';

module.exports = async (req, res) => {
  const slug = req.query.slug || '';
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data, error } = await supabase.from('articles').select('*').eq('slug', slug).limit(1).single();
    if (error || !data) {
      res.status(404).send('<html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px"><h1>Article not found</h1><a href="/" style="display:flex;align-items:center;text-decoration:none;height:52px"><svg width="300" height="52" viewBox="0 0 300 52" xmlns="http://www.w3.org/2000/svg"><circle cx="26" cy="26" r="18" fill="none" stroke="#cc0000" stroke-width="1.5"/><ellipse cx="26" cy="26" rx="18" ry="6.5" fill="none" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><ellipse cx="26" cy="26" rx="18" ry="12" fill="none" stroke="#cc0000" stroke-width="0.6" opacity="0.3"/><line x1="8" y1="26" x2="44" y2="26" stroke="#cc0000" stroke-width="0.8" opacity="0.4"/><ellipse cx="26" cy="26" rx="7" ry="18" fill="none" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><line x1="26" y1="8" x2="26" y2="44" stroke="#cc0000" stroke-width="0.8" opacity="0.4"/><line x1="26" y1="2" x2="26" y2="8" stroke="#cc0000" stroke-width="1.5"/><line x1="26" y1="44" x2="26" y2="50" stroke="#cc0000" stroke-width="1.5"/><line x1="2" y1="26" x2="8" y2="26" stroke="#cc0000" stroke-width="1.5"/><line x1="44" y1="26" x2="50" y2="26" stroke="#cc0000" stroke-width="1.5"/><circle cx="26" cy="26" r="3" fill="#cc0000"/><line x1="23" y1="5" x2="29" y2="5" stroke="#cc0000" stroke-width="1"/><line x1="23" y1="47" x2="29" y2="47" stroke="#cc0000" stroke-width="1"/><line x1="5" y1="23" x2="5" y2="29" stroke="#cc0000" stroke-width="1"/><line x1="47" y1="23" x2="47" y2="29" stroke="#cc0000" stroke-width="1"/><text x="60" y="24" font-size="18" font-weight="900" fill="#ffffff" font-family="Georgia, serif" letter-spacing="0.5">POTUS <tspan fill="#cc0000">Watch</tspan> <tspan fill="#888888" font-size="13" font-weight="400">Daily</tspan></text><line x1="60" y1="32" x2="298" y2="32" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><text x="60" y="46" font-size="9.5" fill="#666666" font-family="Inter, Arial, sans-serif" letter-spacing="1">FOREIGN POLICY INTELLIGENCE  ·  © 2026</text></svg></a></div></header>
${img && img !== `${SITE_URL}/og-default.jpg` ? '<img class="hero-img" src="'+esc(img)+'" alt="'+esc(a.title)+'" fetchpriority="high">' : ''}
<div class="article-content">
  <a class="back" href="/">&#8592; Back to feed</a>
  <div class="eyebrow"><span class="tag">${esc(region)}</span><span style="color:#2a2a2a">·</span><span class="byline">By <a href="/about.html" rel="author">${esc(author)}</a> · <time datetime="${dateIso}">${esc(a.date||'')}</time>${a.time ? ' · '+esc(a.time) : ''} · ${readTime}</span></div>
  <h1>${esc(a.title)}</h1>
  <hr>
  <div class="article-body">${paras}</div>

  <aside style="margin-top:32px;padding:14px 18px;background:#0e0e0e;border-left:2px solid #444;font-size:11px;color:#666;line-height:1.5;font-family:Inter,sans-serif">
    <strong style="color:#888;letter-spacing:1px;text-transform:uppercase;font-size:9px">Affiliate disclosure</strong><br>
    With global instability rising, many readers are preparing. As an Amazon Associate POTUS Watch Daily earns from qualifying purchases &mdash; <a href="https://amzn.to/4cgkdM3" target="_blank" rel="noopener nofollow sponsored" style="color:#cc0000">view the #1 rated emergency survival kit</a>.
  </aside>

  <div style="margin-top:48px;padding:28px 32px;background:#111;border:1px solid #1e1e1e;border-top:3px solid #cc0000;border-radius:3px">
    <p style="font-family:'Playfair Display',Georgia,serif;font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">Keep the dispatches coming</p>
    <p style="font-size:13px;color:#666;line-height:1.6;margin-bottom:20px">POTUS Watch Daily is independent and ad-light by design. If this briefing was useful, a coffee keeps the lights on.</p>
    <a href="https://www.buymeacoffee.com/POTUSwatch" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;background:#cc0000;color:#fff;text-decoration:none;padding:10px 20px;border-radius:3px;font-size:12px;font-weight:600;letter-spacing:0.5px;font-family:Inter,sans-serif;transition:background 0.15s">☕ Buy me a coffee</a>
  </div>
  ${sources.length ? '<div class="sources"><p class="sources-label">Sources</p>'+sources.map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title)+'</a>').join('')+'</div>' : ''}
  ${socialHTML}${newsletterHTML}${relatedHTML}
</div>
<footer class="footer"><div class="footer-inner"><div style="margin-bottom:8px"><svg width="300" height="52" viewBox="0 0 300 52" xmlns="http://www.w3.org/2000/svg"><circle cx="26" cy="26" r="18" fill="none" stroke="#cc0000" stroke-width="1.5"/><ellipse cx="26" cy="26" rx="18" ry="6.5" fill="none" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><ellipse cx="26" cy="26" rx="18" ry="12" fill="none" stroke="#cc0000" stroke-width="0.6" opacity="0.3"/><line x1="8" y1="26" x2="44" y2="26" stroke="#cc0000" stroke-width="0.8" opacity="0.4"/><ellipse cx="26" cy="26" rx="7" ry="18" fill="none" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><line x1="26" y1="8" x2="26" y2="44" stroke="#cc0000" stroke-width="0.8" opacity="0.4"/><line x1="26" y1="2" x2="26" y2="8" stroke="#cc0000" stroke-width="1.5"/><line x1="26" y1="44" x2="26" y2="50" stroke="#cc0000" stroke-width="1.5"/><line x1="2" y1="26" x2="8" y2="26" stroke="#cc0000" stroke-width="1.5"/><line x1="44" y1="26" x2="50" y2="26" stroke="#cc0000" stroke-width="1.5"/><circle cx="26" cy="26" r="3" fill="#cc0000"/><line x1="23" y1="5" x2="29" y2="5" stroke="#cc0000" stroke-width="1"/><line x1="23" y1="47" x2="29" y2="47" stroke="#cc0000" stroke-width="1"/><line x1="5" y1="23" x2="5" y2="29" stroke="#cc0000" stroke-width="1"/><line x1="47" y1="23" x2="47" y2="29" stroke="#cc0000" stroke-width="1"/><text x="60" y="24" font-size="18" font-weight="900" fill="#ffffff" font-family="Georgia, serif" letter-spacing="0.5">POTUS <tspan fill="#cc0000">Watch</tspan> <tspan fill="#888888" font-size="13" font-weight="400">Daily</tspan></text><line x1="60" y1="32" x2="298" y2="32" stroke="#cc0000" stroke-width="0.8" opacity="0.5"/><text x="60" y="46" font-size="9.5" fill="#666666" font-family="Inter, Arial, sans-serif" letter-spacing="1">FOREIGN POLICY INTELLIGENCE  ·  © 2026</text></svg></div><span class="footer-copy">&copy; 2026 POTUS Watch Daily.</span></div></footer>
</body></html>`);
  } catch(e) { res.status(500).send('Error: '+e.message); }
};
