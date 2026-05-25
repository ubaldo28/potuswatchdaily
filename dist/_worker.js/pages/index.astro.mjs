globalThis.process ??= {}; globalThis.process.env ??= {};
import { a1 as createAstro, a2 as createComponent, ae as renderComponent, am as renderTemplate, a6 as defineScriptVars, ac as maybeRenderHead, ak as renderSlot } from '../chunks/astro/server_OjTTKv9z.mjs';
import { c as createClient } from '../chunks/index_CqzAMo15.mjs';
import { $ as $$BaseLayout, a as $$Footer } from '../chunks/Footer_Tw2QDbHr.mjs';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a, _b;
const $$Astro = createAstro("https://www.potuswatchdaily.com");
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  const { env } = Astro2.locals.runtime;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  const { data: articles = [] } = await supabase.from("articles").select("id,title,slug,excerpt,region,date,time,image").order("id", { ascending: false }).limit(60);
  const articlesJson = JSON.stringify(articles ?? []);
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "POTUS Watch Daily \u2014 Foreign Policy Intelligence", "description": "Independent foreign policy intelligence. Live analysis of Trump administration diplomacy, geopolitics, and global affairs.", "canonical": "https://www.potuswatchdaily.com/", "ogImage": "https://www.potuswatchdaily.com/og-default.jpg", "data-astro-cid-j7pv25f6": true }, { "default": async ($$result2) => renderTemplate(_b || (_b = __template([" ", "  ", `<header class="masthead" data-astro-cid-j7pv25f6> <h1 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap" data-astro-cid-j7pv25f6>POTUS Watch Daily \u2014 Foreign Policy Intelligence</h1> <div class="masthead-inner" data-astro-cid-j7pv25f6> <a href="/" style="display:flex;align-items:center;text-decoration:none;height:52px" data-astro-cid-j7pv25f6> <img src="/logo-v2.png" width="300" height="52" alt="POTUS Watch Daily" style="display:block" data-astro-cid-j7pv25f6> </a> <nav class="nav" id="nav" data-astro-cid-j7pv25f6> <a href="#" onclick="filterFeed('all');return false;" class="nav-active" data-astro-cid-j7pv25f6>All</a> <a href="#" onclick="filterFeed('Americas');return false;" data-astro-cid-j7pv25f6>Americas</a> <a href="#" onclick="filterFeed('China');return false;" data-astro-cid-j7pv25f6>China</a> <a href="#" onclick="filterFeed('NATO');return false;" data-astro-cid-j7pv25f6>NATO</a> <a href="#" onclick="filterFeed('Iran');return false;" data-astro-cid-j7pv25f6>Iran</a> <a href="#" onclick="filterFeed('Mideast');return false;" data-astro-cid-j7pv25f6>Mideast</a> <a href="#" onclick="filterFeed('Russia');return false;" data-astro-cid-j7pv25f6>Russia</a> <a href="#" onclick="filterFeed('Trade');return false;" data-astro-cid-j7pv25f6>Trade</a> <a href="#" onclick="filterFeed('Analysis');return false;" data-astro-cid-j7pv25f6>Analysis</a> </nav> <div class="masthead-right" data-astro-cid-j7pv25f6> <div class="search-input-wrap" data-astro-cid-j7pv25f6> <svg viewBox="0 0 24 24" data-astro-cid-j7pv25f6><circle cx="11" cy="11" r="8" data-astro-cid-j7pv25f6></circle><line x1="21" y1="21" x2="16.65" y2="16.65" data-astro-cid-j7pv25f6></line></svg> <input type="text" id="search-input" placeholder="Search\u2026" oninput="searchArticles(this.value)" onkeydown="if(event.key==='Escape'){this.value='';searchArticles('')}" data-astro-cid-j7pv25f6> </div> <a href="/newsletter" style="background:#cc0000;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:7px 14px;border-radius:3px;text-decoration:none;white-space:nowrap;flex-shrink:0" data-astro-cid-j7pv25f6>Subscribe</a> <div class="live-badge" data-astro-cid-j7pv25f6><div class="dot" data-astro-cid-j7pv25f6></div>Live</div> </div> </div> </header> <div style="background:#1a1a1a;border-bottom:1px solid #cc0000;padding:10px 24px;text-align:center" data-astro-cid-j7pv25f6> <p style="font-size:12px;color:#999;font-family:Inter,sans-serif;margin:0" data-astro-cid-j7pv25f6>POTUS Watch Daily covers foreign policy through an analytical lens. We do not glorify or exploit conflict. <a href="/editorial" style="color:#888;text-decoration:none" data-astro-cid-j7pv25f6>Editorial Standards</a></p> </div>  <div class="ticker-wrap" data-astro-cid-j7pv25f6> <div class="ticker-label" data-astro-cid-j7pv25f6>Breaking</div> <div class="ticker-track" data-astro-cid-j7pv25f6> <div class="ticker-inner" id="ticker-inner" data-astro-cid-j7pv25f6></div> </div> </div>  <div class="hero-wrap" data-astro-cid-j7pv25f6> <div id="hero" class="hero" data-astro-cid-j7pv25f6></div> </div>  <div class="grid-wrap" data-astro-cid-j7pv25f6> <div class="section-header" data-astro-cid-j7pv25f6> <span class="section-title" id="section-title" data-astro-cid-j7pv25f6>Latest Dispatches</span> <div class="section-line" data-astro-cid-j7pv25f6></div> </div> <div id="grid" class="grid" data-astro-cid-j7pv25f6></div> <div style="text-align:center;padding:32px 0 48px" data-astro-cid-j7pv25f6> <button id="load-more-btn" onclick="loadMore()" style="background:none;border:1px solid #2a2a2a;color:#555;padding:10px 32px;font-size:12px;font-family:'Inter',sans-serif;cursor:pointer;border-radius:3px;letter-spacing:0.5px;transition:all 0.15s" onmouseover="this.style.color='#fff';this.style.borderColor='#555'" onmouseout="this.style.color='#555';this.style.borderColor='#2a2a2a'" data-astro-cid-j7pv25f6>Load more dispatches</button> </div> </div>  <div style="background:#111;border-top:3px solid #cc0000;border-bottom:1px solid #1e1e1e;padding:40px 24px;text-align:center" data-astro-cid-j7pv25f6> <p style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#cc0000;margin-bottom:12px;font-family:'Inter',sans-serif" data-astro-cid-j7pv25f6>Free Newsletter</p> <h2 style="font-family:'Playfair Display',serif;font-size:26px;font-weight:900;color:#fff;margin-bottom:10px" data-astro-cid-j7pv25f6>Stay ahead of the world</h2> <p style="font-size:14px;color:#666;margin-bottom:24px;font-family:'Inter',sans-serif;line-height:1.6;max-width:460px;margin-left:auto;margin-right:auto" data-astro-cid-j7pv25f6>Weekly foreign policy intelligence. No spin, no agenda. Free.</p> <form id="subscribe-form" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:460px;margin:0 auto" onsubmit="handleSubscribe(event)" data-astro-cid-j7pv25f6> <input type="email" id="sub-email" placeholder="your@email.com" required style="flex:1;min-width:200px;background:#111;border:1px solid #333;color:#fff;padding:12px 16px;border-radius:3px;font-size:13px;font-family:'Inter',sans-serif;outline:none" data-astro-cid-j7pv25f6> <button type="submit" style="background:#cc0000;color:#fff;border:none;padding:12px 24px;border-radius:3px;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;letter-spacing:0.5px" data-astro-cid-j7pv25f6>Subscribe free</button> </form> <p id="sub-msg" style="font-size:12px;margin-top:10px;display:none" data-astro-cid-j7pv25f6></p> </div> `, `  <div class="cookie-banner" id="cookie-banner" data-astro-cid-j7pv25f6> <p data-astro-cid-j7pv25f6>We use cookies to serve personalised ads and improve your experience. This includes Google AdSense. <a href="/privacy" data-astro-cid-j7pv25f6>Privacy Policy</a> \xB7 <a href="https://adssettings.google.com" target="_blank" data-astro-cid-j7pv25f6>Opt out</a>.</p> <div class="cookie-actions" data-astro-cid-j7pv25f6> <button class="btn-accept" onclick="acceptCookies()" data-astro-cid-j7pv25f6>Accept</button> <button class="btn-decline" onclick="document.getElementById('cookie-banner').style.display='none'" data-astro-cid-j7pv25f6>Decline</button> </div> </div>  <script data-name="BMC-Widget" data-cfasync="false" src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js" data-id="POTUSwatch" data-description="Support me on Buy me a coffee!" data-message="Your support keeps the dispatches coming 24/7, thank you." data-color="#FF5F5F" data-position="Right" data-x_margin="18" data-y_margin="18"><\/script> <script>(function(){`, `
var articles = JSON.parse(articlesJson);
var currentFilter = 'all';
var displayLimit = 21;
var searchQuery = '';

function buildTicker(items) {
  var inner = document.getElementById('ticker-inner');
  var duped = items.concat(items);
  inner.innerHTML = duped.map(function(t){ return '<span>' + escHtml(t) + '</span>'; }).join('');
}

function acceptCookies(){
  try { localStorage.setItem('cookies','1'); } catch(e){}
  document.getElementById('cookie-banner').style.display='none';
}
setTimeout(function(){
  try { if(!localStorage.getItem('cookies')) document.getElementById('cookie-banner').style.display='flex'; } catch(e){}
}, 3000);

function escHtml(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function imgPlaceholder(region, type){
  var label = (region || 'POTUS Watch').toUpperCase();
  if(type==='hero-main') return '<div class="hero-placeholder" style="height:480px"><span class="hero-placeholder-text">'+label+'</span></div>';
  if(type==='hero-small') return '<div class="hero-placeholder" style="height:100%;min-height:200px"><span class="hero-placeholder-text" style="font-size:11px">'+label+'</span></div>';
  return '<div class="card-placeholder"><div class="card-placeholder-inner">'+label+'</div></div>';
}

function getFiltered(){
  var list = articles;
  if(currentFilter!=='all') list=list.filter(function(a){return(a.region||'').toLowerCase()===currentFilter.toLowerCase();});
  if(searchQuery) list=list.filter(function(a){var q=searchQuery.toLowerCase();return(a.title||'').toLowerCase().includes(q)||(a.excerpt||'').toLowerCase().includes(q);});
  return list;
}

function renderFeed(){
  var filtered = getFiltered();
  var hero = document.getElementById('hero');
  var grid = document.getElementById('grid');
  var secTitle = document.getElementById('section-title');
  var loadBtn = document.getElementById('load-more-btn');

  if(!filtered.length){
    hero.innerHTML='';
    grid.innerHTML='<p style="color:#555;font-size:14px;padding:40px 0;grid-column:1/-1">No dispatches found.</p>';
    if(loadBtn) loadBtn.style.display='none';
    return;
  }

  // Hero (top 3)
  var main = filtered[0];
  var small1 = filtered[1];
  var small2 = filtered[2];

  var heroHTML = '<a class="hero-main" href="/article/'+escHtml(main.slug)+'" style="display:block;text-decoration:none;color:inherit">';
  heroHTML += main.image ? '<img class="hero-main-img" src="'+escHtml(main.image)+'" alt="'+escHtml(main.title)+'" loading="eager">' : imgPlaceholder(main.region,'hero-main');
  heroHTML += '<div class="overlay"><div class="tag">'+escHtml(main.region||'World')+'</div><div class="card-title">'+escHtml(main.title)+'</div>';
  if(main.excerpt) heroHTML += '<div class="card-excerpt">'+escHtml(main.excerpt)+'</div>';
  heroHTML += '</div></a>';

  var sideHTML = '<div class="hero-side">';
  [small1,small2].forEach(function(a){
    if(!a) return;
    sideHTML += '<a class="hero-small" href="/article/'+escHtml(a.slug)+'" style="display:block;text-decoration:none;color:inherit">';
    sideHTML += a.image ? '<img class="hero-small-img" src="'+escHtml(a.image)+'" alt="'+escHtml(a.title)+'" loading="lazy">' : imgPlaceholder(a.region,'hero-small');
    sideHTML += '<div class="overlay"><div class="tag">'+escHtml(a.region||'World')+'</div><div class="card-title">'+escHtml(a.title)+'</div></div>';
    sideHTML += '</a>';
  });
  sideHTML += '</div>';
  hero.innerHTML = heroHTML + sideHTML;

  // Grid (rest up to displayLimit)
  var gridItems = filtered.slice(3, displayLimit);
  grid.innerHTML = gridItems.map(function(a){
    var imgHTML = a.image ? '<img class="card-img" src="'+escHtml(a.image)+'" alt="'+escHtml(a.title)+'" loading="lazy">' : imgPlaceholder(a.region,'card');
    return '<a class="card" href="/article/'+escHtml(a.slug)+'" style="display:block;text-decoration:none;color:inherit">'+imgHTML+'<div class="card-body"><div class="tag">'+escHtml(a.region||'World')+'</div><div class="card-title">'+escHtml(a.title)+'</div><div class="card-excerpt">'+escHtml(a.excerpt||'')+'</div><div class="card-meta">'+escHtml(a.date||'')+(a.time?' \xB7 '+escHtml(a.time):'')+'</div></div></a>';
  }).join('');

  if(loadBtn) loadBtn.style.display = filtered.length > displayLimit ? 'inline-block' : 'none';
  if(secTitle) secTitle.textContent = currentFilter==='all' ? 'Latest Dispatches' : currentFilter + ' Dispatches';
}

function filterFeed(r){
  currentFilter=r; displayLimit=21; searchQuery='';
  document.getElementById('search-input').value='';
  document.querySelectorAll('#nav a').forEach(function(a){ a.classList.remove('nav-active'); });
  var active = Array.from(document.querySelectorAll('#nav a')).find(function(a){ return a.textContent.toLowerCase()===(r==='all'?'all':r.toLowerCase()); });
  if(active) active.classList.add('nav-active');
  renderFeed();
}

function searchArticles(q){
  searchQuery=q; displayLimit=21; renderFeed();
}

function loadMore(){
  displayLimit += 21; renderFeed();
}

async function handleSubscribe(e){
  e.preventDefault();
  var email = document.getElementById('sub-email').value;
  var msg = document.getElementById('sub-msg');
  var btn = e.target.querySelector('button');
  btn.textContent='Subscribing...'; btn.disabled=true;
  try {
    var r = await fetch('/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
    var d = await r.json();
    msg.style.display='block';
    if(r.ok){msg.style.color='#4caf50';msg.textContent='\u2713 Subscribed. First dispatch incoming.';document.getElementById('subscribe-form').style.display='none';}
    else{msg.style.color='#cc0000';msg.textContent=d.error||'Something went wrong. Try again.';btn.textContent='Subscribe free';btn.disabled=false;}
  } catch {
    msg.style.display='block';msg.style.color='#cc0000';msg.textContent='Connection error. Try again.';btn.textContent='Subscribe free';btn.disabled=false;
  }
}

// Init
var titles = articles.slice(0,8).map(function(a){return a.title;});
if(titles.length) buildTicker(titles);
renderFeed();
  })();<\/script> `])), renderSlot($$result2, $$slots["head"], renderTemplate(_a || (_a = __template([' <script type="application/ld+json">{JSON.stringify({\n      "@context":"https://schema.org","@type":"WebSite",\n      "name":"POTUS Watch Daily",\n      "url":"https://www.potuswatchdaily.com",\n      "description":"Independent foreign policy intelligence. Live analysis of global affairs.",\n      "publisher":{"@type":"Organization","name":"POTUS Watch Daily","url":"https://www.potuswatchdaily.com","logo":{"@type":"ImageObject","url":"https://www.potuswatchdaily.com/og-default.jpg"}}\n    })}<\/script> '])))), maybeRenderHead(), renderComponent($$result2, "Footer", $$Footer, { "data-astro-cid-j7pv25f6": true }), defineScriptVars({ articlesJson })) })} `;
}, "/Users/purpleworldinc/Desktop/potuswatch/src/pages/index.astro", void 0);

const $$file = "/Users/purpleworldinc/Desktop/potuswatch/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
