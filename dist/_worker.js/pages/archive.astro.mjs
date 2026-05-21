globalThis.process ??= {}; globalThis.process.env ??= {};
import { a1 as createAstro, a2 as createComponent, ae as renderComponent, am as renderTemplate, ac as maybeRenderHead, _ as addAttribute } from '../chunks/astro/server_OjTTKv9z.mjs';
import { c as createClient } from '../chunks/index_CqzAMo15.mjs';
import { $ as $$BaseLayout, a as $$Footer } from '../chunks/Footer_DpkYmgHs.mjs';
import { $ as $$Masthead } from '../chunks/Masthead_BhgOdb-3.mjs';
/* empty css                                   */
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro("https://www.potuswatchdaily.com");
const $$Archive = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Archive;
  const { env } = Astro2.locals.runtime;
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  const { data: articles = [] } = await supabase.from("articles").select("title,slug,excerpt,region,date,time").order("id", { ascending: false }).limit(300);
  const byRegion = {};
  for (const a of articles ?? []) {
    const r = a.region || "World";
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(a);
  }
  return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, { "title": "Archive \u2014 POTUS Watch Daily", "description": "Full archive of foreign policy intelligence dispatches from POTUS Watch Daily.", "canonical": "https://www.potuswatchdaily.com/archive", "data-astro-cid-qma2cssl": true }, { "default": async ($$result2) => renderTemplate` ${renderComponent($$result2, "Masthead", $$Masthead, { "backLink": "/", "backLabel": "\u2190 Back to feed", "data-astro-cid-qma2cssl": true })} ${maybeRenderHead()}<div class="page" data-astro-cid-qma2cssl> <div class="eyebrow" data-astro-cid-qma2cssl>Archive</div> <h1 data-astro-cid-qma2cssl>All Dispatches</h1> <p class="page-sub" data-astro-cid-qma2cssl>Full archive of foreign policy intelligence, organised by region.</p> ${Object.entries(byRegion).map(([region, items]) => renderTemplate`<section class="region-section" data-astro-cid-qma2cssl> <h2 class="region-heading" data-astro-cid-qma2cssl>${region}</h2> ${items.map((a) => renderTemplate`<div class="archive-item" data-astro-cid-qma2cssl> <a${addAttribute(`/article/${a.slug}`, "href")} class="archive-link" data-astro-cid-qma2cssl> <span class="archive-title" data-astro-cid-qma2cssl>${a.title}</span> <span class="archive-meta" data-astro-cid-qma2cssl>${a.date || ""}${a.time ? ` \xB7 ${a.time}` : ""}</span> </a> ${a.excerpt && renderTemplate`<p class="archive-excerpt" data-astro-cid-qma2cssl>${a.excerpt}</p>`} </div>`)} </section>`)} </div> ${renderComponent($$result2, "Footer", $$Footer, { "data-astro-cid-qma2cssl": true })} ` })} `;
}, "/Users/purpleworldinc/Desktop/potuswatch/src/pages/archive.astro", void 0);

const $$file = "/Users/purpleworldinc/Desktop/potuswatch/src/pages/archive.astro";
const $$url = "/archive";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Archive,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
