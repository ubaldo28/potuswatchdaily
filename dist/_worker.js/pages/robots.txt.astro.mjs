globalThis.process ??= {}; globalThis.process.env ??= {};
export { renderers } from '../renderers.mjs';

const GET = () => {
  return new Response(
    "User-agent: *\nAllow: /\n\nSitemap: https://www.potuswatchdaily.com/sitemap.xml",
    { headers: { "Content-Type": "text/plain" } }
  );
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
