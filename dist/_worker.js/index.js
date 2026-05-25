globalThis.process ??= {}; globalThis.process.env ??= {};
import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_CqRP-xIa.mjs';
import { manifest } from './manifest_Cqx70CiZ.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/about.astro.mjs');
const _page2 = () => import('./pages/ads.txt.astro.mjs');
const _page3 = () => import('./pages/archive.astro.mjs');
const _page4 = () => import('./pages/article/_slug_.astro.mjs');
const _page5 = () => import('./pages/contact.astro.mjs');
const _page6 = () => import('./pages/disclaimer.astro.mjs');
const _page7 = () => import('./pages/editorial.astro.mjs');
const _page8 = () => import('./pages/explainers/iran-nuclear-program.astro.mjs');
const _page9 = () => import('./pages/explainers/nato-article-5.astro.mjs');
const _page10 = () => import('./pages/explainers/us-china-relations.astro.mjs');
const _page11 = () => import('./pages/explainers.astro.mjs');
const _page12 = () => import('./pages/feed.xml.astro.mjs');
const _page13 = () => import('./pages/get-articles.astro.mjs');
const _page14 = () => import('./pages/newsletter.astro.mjs');
const _page15 = () => import('./pages/privacy.astro.mjs');
const _page16 = () => import('./pages/robots.txt.astro.mjs');
const _page17 = () => import('./pages/sitemap.xml.astro.mjs');
const _page18 = () => import('./pages/subscribe.astro.mjs');
const _page19 = () => import('./pages/terms.astro.mjs');
const _page20 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/@astrojs/cloudflare/dist/entrypoints/image-endpoint.js", _page0],
    ["src/pages/about.astro", _page1],
    ["src/pages/ads.txt.ts", _page2],
    ["src/pages/archive.astro", _page3],
    ["src/pages/article/[slug].astro", _page4],
    ["src/pages/contact.astro", _page5],
    ["src/pages/disclaimer.astro", _page6],
    ["src/pages/editorial.astro", _page7],
    ["src/pages/explainers/iran-nuclear-program.astro", _page8],
    ["src/pages/explainers/nato-article-5.astro", _page9],
    ["src/pages/explainers/us-china-relations.astro", _page10],
    ["src/pages/explainers/index.astro", _page11],
    ["src/pages/feed.xml.ts", _page12],
    ["src/pages/get-articles.ts", _page13],
    ["src/pages/newsletter.astro", _page14],
    ["src/pages/privacy.astro", _page15],
    ["src/pages/robots.txt.ts", _page16],
    ["src/pages/sitemap.xml.ts", _page17],
    ["src/pages/subscribe.ts", _page18],
    ["src/pages/terms.astro", _page19],
    ["src/pages/index.astro", _page20]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./noop-entrypoint.mjs'),
    middleware: () => import('./_astro-internal_middleware.mjs')
});
const _args = undefined;
const _exports = createExports(_manifest);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { __astrojsSsrVirtualEntry as default, pageMap };
