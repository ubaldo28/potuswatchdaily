globalThis.process ??= {}; globalThis.process.env ??= {};
import { a1 as createAstro, a2 as createComponent, ac as maybeRenderHead, _ as addAttribute, am as renderTemplate } from './astro/server_OjTTKv9z.mjs';
/* empty css                         */

const $$Astro = createAstro("https://www.potuswatchdaily.com");
const $$Masthead = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Masthead;
  const { backLink, backLabel } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<header class="masthead" data-astro-cid-r6zpem2t> <div class="masthead-inner" data-astro-cid-r6zpem2t> <a href="/" class="logo-link" data-astro-cid-r6zpem2t> <img src="/logo.png" width="300" height="52" alt="POTUS Watch Daily" style="display:block" data-astro-cid-r6zpem2t> </a> <div class="masthead-right" data-astro-cid-r6zpem2t> <a href="/newsletter" class="btn-subscribe" data-astro-cid-r6zpem2t>Subscribe</a> ${backLink && renderTemplate`<a${addAttribute(backLink, "href")} class="back-link" data-astro-cid-r6zpem2t>${backLabel ?? "\u2190 Back to feed"}</a>`} </div> </div> </header> `;
}, "/Users/purpleworldinc/Desktop/potuswatch/src/components/Masthead.astro", void 0);

export { $$Masthead as $ };
