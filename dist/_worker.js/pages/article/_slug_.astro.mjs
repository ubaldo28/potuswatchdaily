globalThis.process ??= {}; globalThis.process.env ??= {};
import { a1 as createAstro, a2 as createComponent, ae as renderComponent, am as renderTemplate, ak as renderSlot, _ as addAttribute, ar as unescapeHTML, ac as maybeRenderHead } from '../../chunks/astro/server_OjTTKv9z.mjs';
import { c as createClient } from '../../chunks/index_CqzAMo15.mjs';
import { $ as $$BaseLayout, a as $$Footer } from '../../chunks/Footer_BLXYkK5Z.mjs';
/* empty css                                     */
export { renderers } from '../../renderers.mjs';

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Astro = createAstro("https://www.potuswatchdaily.com");
const $$slug = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$slug;
  const { env } = Astro2.locals.runtime;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  const { slug } = Astro2.params;
  const { data: a, error } = await supabase.from("articles").select("*").eq("slug", slug).limit(1).single();
  const { data: related = [] } = await supabase.from("articles").select("title,slug,excerpt,region,image,date").eq("region", a?.region ?? "").neq("slug", slug ?? "").order("id", { ascending: false }).limit(3);
  if (error || !a) {
    return new Response(
      `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Not Found \u2014 POTUS Watch Daily</title><meta name="robots" content="noindex"><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%230a0a0a'/><circle cx='16' cy='16' r='12' fill='none' stroke='%23cc0000' stroke-width='2.5'/><circle cx='16' cy='16' r='4' fill='%23cc0000'/></svg>"></head><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px;text-align:center"><div style="height:3px;background:#cc0000;position:fixed;top:0;left:0;right:0"></div><h1 style="font-size:72px;font-weight:900;color:#cc0000;margin:0">404</h1><p style="font-size:18px;color:#666">Dispatch not found.</p><a href="/" style="color:#cc0000;font-size:13px;text-decoration:none;border:1px solid #cc0000;padding:8px 20px;border-radius:3px">\u2190 Back to the feed</a></body></html>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
  const SITE_URL = "https://www.potuswatchdaily.com";
  const canonicalUrl = `${SITE_URL}/article/${a.slug}`;
  const img = a.hero_image || a.image || `${SITE_URL}/og-default.jpg`;
  const region = a.region || "Analysis";
  const dateIso = a.published_at || a.created_at || (/* @__PURE__ */ new Date()).toISOString();
  const words = (a.body || "").split(/\s+/).length;
  const readTime = Math.max(1, Math.round(words / 200)) + " min read";
  (a.meta_description || a.excerpt || "").replace(/"/g, "&quot;");
  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  const paras = (a.body || "").split(/\n+/).filter(Boolean).map((p) => {
    if (p.startsWith("## ")) return `<h2>${esc(p.slice(3))}</h2>`;
    if (p.startsWith("# ")) return `<h2>${esc(p.slice(2))}</h2>`;
    return `<p>${esc(p)}</p>`;
  }).join("");
  let sources = [];
  try {
    sources = JSON.parse(a.sources || "[]");
  } catch {
  }
  const encodedUrl = encodeURIComponent(canonicalUrl);
  const encodedTitle = encodeURIComponent(a.title || "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": a.title,
    "description": a.meta_description || a.excerpt,
    "image": [{ "@type": "ImageObject", "url": img, "width": 1200, "height": 630 }],
    "datePublished": dateIso,
    "dateModified": a.updated_at || dateIso,
    "author": [{ "@type": "Organization", "name": "POTUS Watch Daily", "url": `${SITE_URL}/about` }],
    "publisher": { "@type": "NewsMediaOrganization", "name": "POTUS Watch Daily", "url": SITE_URL, "logo": { "@type": "ImageObject", "url": `${SITE_URL}/logo.png`, "width": 300, "height": 52 } },
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
    "articleSection": region,
    "wordCount": words,
    "inLanguage": "en-US",
    "isAccessibleForFree": true
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL },
      { "@type": "ListItem", "position": 2, "name": region, "item": `${SITE_URL}/archive` },
      { "@type": "ListItem", "position": 3, "name": a.title, "item": canonicalUrl }
    ]
  };
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": `${a.title} \u2014 POTUS Watch Daily`, "description": a.meta_description || a.excerpt || "", "canonical": canonicalUrl, "ogImage": img, "ogType": "article", "data-astro-cid-yvq5cjnk": true }, { "default": async ($$result2) => renderTemplate` ${renderSlot($$result2, $$slots["head"], renderTemplate(_a || (_a = __template([' <script type="application/ld+json">', '<\/script> <script type="application/ld+json">', '<\/script> <meta property="og:article:published_time"', '> <meta property="og:article:modified_time"', '> <meta property="og:article:section"', '> <meta property="og:article:author" content="POTUS Watch Daily"> '])), unescapeHTML(JSON.stringify(jsonLd)), unescapeHTML(JSON.stringify(breadcrumbLd)), addAttribute(dateIso, "content"), addAttribute(a.updated_at || dateIso, "content"), addAttribute(region, "content")))} ${maybeRenderHead()}<header class="masthead" data-astro-cid-yvq5cjnk> <a href="/" style="display:flex;align-items:center;text-decoration:none" data-astro-cid-yvq5cjnk> <img src="/logo.png" width="260" height="45" alt="POTUS Watch Daily" style="display:block" data-astro-cid-yvq5cjnk> </a> </header> <div class="editorial-bar" data-astro-cid-yvq5cjnk>POTUS Watch Daily covers foreign policy through an analytical lens — policy, diplomacy, economics and strategy.</div> ${img && img !== `${SITE_URL}/og-default.jpg` && renderTemplate`<img class="hero-img"${addAttribute(img, "src")}${addAttribute(a.title, "alt")} fetchpriority="high" data-astro-cid-yvq5cjnk>`}<div class="article-content" data-astro-cid-yvq5cjnk> <a class="back" href="/" data-astro-cid-yvq5cjnk>← Back to feed</a> <div class="eyebrow" data-astro-cid-yvq5cjnk> <span class="tag" data-astro-cid-yvq5cjnk>${region}</span> <span style="color:#333" data-astro-cid-yvq5cjnk>·</span> <span class="byline-meta" data-astro-cid-yvq5cjnk>By <a href="/about" rel="author" data-astro-cid-yvq5cjnk>POTUS Watch Daily Editorial Staff</a> · <time${addAttribute(dateIso, "datetime")} data-astro-cid-yvq5cjnk>${a.date || ""}</time>${a.time ? ` \xB7 ${a.time}` : ""} · ${readTime}</span> </div> <h1 data-astro-cid-yvq5cjnk>${a.title}</h1> <hr data-astro-cid-yvq5cjnk> <div class="article-body" data-astro-cid-yvq5cjnk>${unescapeHTML(paras)}</div> <aside class="affiliate-box" data-astro-cid-yvq5cjnk> <strong data-astro-cid-yvq5cjnk>Affiliate disclosure</strong><br data-astro-cid-yvq5cjnk>
With global instability rising, many readers are preparing. As an Amazon Associate POTUS Watch Daily earns from qualifying purchases — <a href="https://amzn.to/4cgkdM3" target="_blank" rel="noopener nofollow sponsored" data-astro-cid-yvq5cjnk>view the #1 rated emergency survival kit</a>.
</aside> <div class="support-box" data-astro-cid-yvq5cjnk> <p class="support-title" data-astro-cid-yvq5cjnk>Keep the dispatches coming</p> <p class="support-sub" data-astro-cid-yvq5cjnk>POTUS Watch Daily is independent and ad-light by design. If this briefing was useful, a coffee keeps the lights on.</p> <a href="https://www.buymeacoffee.com/POTUSwatch" target="_blank" rel="noopener" class="btn-coffee" data-astro-cid-yvq5cjnk>☕ Buy me a coffee</a> </div> ${sources.length > 0 && renderTemplate`<div class="sources" data-astro-cid-yvq5cjnk> <p class="sources-label" data-astro-cid-yvq5cjnk>Sources</p> ${sources.map((s) => renderTemplate`<a${addAttribute(s.url, "href")} target="_blank" rel="noopener" data-astro-cid-yvq5cjnk>${s.title}</a>`)} </div>`} <div class="share-row" data-astro-cid-yvq5cjnk> <span class="share-label" data-astro-cid-yvq5cjnk>Share</span> <a${addAttribute(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`, "href")} target="_blank" rel="noopener" class="icon-btn" data-astro-cid-yvq5cjnk> <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff" data-astro-cid-yvq5cjnk><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" data-astro-cid-yvq5cjnk></path></svg> </a> <a${addAttribute(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, "href")} target="_blank" rel="noopener" class="icon-btn" data-astro-cid-yvq5cjnk> <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff" data-astro-cid-yvq5cjnk><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" data-astro-cid-yvq5cjnk></path></svg> </a> <a${addAttribute(`https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`, "href")} target="_blank" rel="noopener" class="icon-btn" data-astro-cid-yvq5cjnk> <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff" data-astro-cid-yvq5cjnk><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" data-astro-cid-yvq5cjnk></path></svg> </a> <a${addAttribute(`https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`, "href")} target="_blank" rel="noopener" class="icon-btn" data-astro-cid-yvq5cjnk> <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#fff" data-astro-cid-yvq5cjnk><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" data-astro-cid-yvq5cjnk></path></svg> </a> </div> ${related && related.length > 0 && renderTemplate`<div class="related-section" data-astro-cid-yvq5cjnk> <p class="related-label" data-astro-cid-yvq5cjnk>More from ${region}</p> <div class="related-grid" data-astro-cid-yvq5cjnk> ${related.map((r) => renderTemplate`<a${addAttribute(`/article/${r.slug}`, "href")} class="related-card" data-astro-cid-yvq5cjnk> ${r.image && renderTemplate`<img${addAttribute(r.image, "src")}${addAttribute(r.title, "alt")} class="related-img" loading="lazy" data-astro-cid-yvq5cjnk>`} <div class="related-region" data-astro-cid-yvq5cjnk>${r.region || ""}</div> <div class="related-title-text" data-astro-cid-yvq5cjnk>${r.title}</div> <div class="related-date" data-astro-cid-yvq5cjnk>${r.date || ""}</div> </a>`)} </div> </div>`} </div> ${renderComponent($$result2, "Footer", $$Footer, { "data-astro-cid-yvq5cjnk": true })} ` })} `;
}, "/Users/purpleworldinc/Desktop/potuswatch/src/pages/article/[slug].astro", void 0);

const $$file = "/Users/purpleworldinc/Desktop/potuswatch/src/pages/article/[slug].astro";
const $$url = "/article/[slug]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$slug,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
