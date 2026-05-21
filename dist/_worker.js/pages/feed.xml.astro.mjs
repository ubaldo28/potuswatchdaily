globalThis.process ??= {}; globalThis.process.env ??= {};
import { c as createClient } from '../chunks/index_CqzAMo15.mjs';
export { renderers } from '../renderers.mjs';

const SITE_URL = "https://www.potuswatchdaily.com";
const SITE_NAME = "POTUS Watch Daily";
const SITE_DESC = "Independent foreign policy intelligence. Live analysis updated every hour.";
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const GET = async ({ locals }) => {
  const { env } = locals.runtime;
  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    const { data: articles } = await supabase.from("articles").select("slug,title,excerpt,body,region,hero_image,published_at,date").not("slug", "is", null).order("published_at", { ascending: false }).limit(50);
    const list = articles || [];
    const isoOf = (val) => {
      if (val) {
        const d = new Date(val);
        if (!isNaN(d.getTime()) && d.getFullYear() >= 2024) return d;
      }
      return null;
    };
    const items = list.map((a) => {
      const url = `${SITE_URL}/article/${a.slug}`;
      const pubDate = (isoOf(a.published_at) || isoOf(a.date) || /* @__PURE__ */ new Date()).toUTCString();
      const paragraphs = (a.body || "").split("\n").filter((p) => p.trim()).map((p) => `<p>${esc(p)}</p>`).join("");
      const heroImg = a.hero_image ? `<img src="${esc(a.hero_image)}" alt="${esc(a.title)}"/>` : "";
      return `<item>
  <title><![CDATA[${a.title}]]></title>
  <link>${url}</link>
  <guid isPermaLink="true">${url}</guid>
  <pubDate>${pubDate}</pubDate>
  <dc:creator><![CDATA[POTUS Watch Editorial]]></dc:creator>
  <category>${esc(a.region || "World")}</category>
  <description><![CDATA[${a.excerpt || ""}]]></description>
  <content:encoded><![CDATA[${heroImg}${paragraphs}]]></content:encoded>
</item>`;
    }).join("\n");
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}/</link>
    <description>${SITE_DESC}</description>
    <language>en-us</language>
    <lastBuildDate>${(/* @__PURE__ */ new Date()).toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
    return new Response(rss, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=600, s-maxage=600"
      }
    });
  } catch (e) {
    return new Response("Feed error", { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
