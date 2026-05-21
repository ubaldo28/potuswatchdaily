globalThis.process ??= {}; globalThis.process.env ??= {};
import { a1 as createAstro, a2 as createComponent, am as renderTemplate, ak as renderSlot, ag as renderHead, aj as renderScript, _ as addAttribute, ac as maybeRenderHead } from './astro/server_OjTTKv9z.mjs';
/* empty css                         */

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Astro$1 = createAstro("https://www.potuswatchdaily.com");
const $$BaseLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$BaseLayout;
  const {
    title,
    description = "Independent foreign policy intelligence. Live analysis of Trump administration diplomacy, geopolitics, and global affairs.",
    canonical,
    ogImage = "https://www.potuswatchdaily.com/og-default.jpg",
    ogType = "website",
    noIndex = false
  } = Astro2.props;
  const canonicalUrl = canonical ?? new URL(Astro2.url.pathname, Astro2.site).href;
  return renderTemplate(_a || (_a = __template(['<html lang="en"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>', '</title><meta name="description"', '><link rel="canonical"', ">", '<meta property="og:title"', '><meta property="og:description"', '><meta property="og:url"', '><meta property="og:image"', '><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:site_name" content="POTUS Watch Daily"><meta property="og:type"', '><meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@POTUSwatch"><meta name="twitter:title"', '><meta name="twitter:description"', '><meta name="twitter:image"', '><meta name="google-adsense-account" content="ca-pub-7380718671497895"><link rel="icon" href="/og-default.jpg" type="image/jpeg"><link rel="alternate" type="application/rss+xml" title="POTUS Watch Daily" href="/feed.xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"><script async src="https://www.googletagmanager.com/gtag/js?id=G-FRVP4L2Z2T"><\/script>', "", "", '</head> <body> <div class="top-bar"></div> ', "  </body> </html>"])), title, addAttribute(description, "content"), addAttribute(canonicalUrl, "href"), noIndex ? renderTemplate`<meta name="robots" content="noindex, nofollow">` : renderTemplate`<meta name="robots" content="index, follow">`, addAttribute(title, "content"), addAttribute(description, "content"), addAttribute(canonicalUrl, "content"), addAttribute(ogImage, "content"), addAttribute(ogType, "content"), addAttribute(title, "content"), addAttribute(description, "content"), addAttribute(ogImage, "content"), renderScript($$result, "/Users/purpleworldinc/Desktop/potuswatch/src/layouts/BaseLayout.astro?astro&type=script&index=0&lang.ts"), renderSlot($$result, $$slots["head"]), renderHead(), renderSlot($$result, $$slots["default"]));
}, "/Users/purpleworldinc/Desktop/potuswatch/src/layouts/BaseLayout.astro", void 0);

const $$Astro = createAstro("https://www.potuswatchdaily.com");
const $$Footer = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Footer;
  const { maxWidth = "1280px" } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<footer class="footer" data-astro-cid-sz7xmlte> <div class="footer-inner"${addAttribute(`max-width: ${maxWidth}`, "style")} data-astro-cid-sz7xmlte> <a href="/" class="footer-logo" data-astro-cid-sz7xmlte> <img src="/logo.png" width="200" height="35" alt="POTUS Watch Daily" style="display:block" data-astro-cid-sz7xmlte> </a> <nav class="footer-links" data-astro-cid-sz7xmlte> <a href="/" data-astro-cid-sz7xmlte>Home</a> <a href="/archive" data-astro-cid-sz7xmlte>Archive</a> <a href="/explainers/" data-astro-cid-sz7xmlte>Explainers</a> <a href="/newsletter" data-astro-cid-sz7xmlte>Newsletter</a> <a href="/about" data-astro-cid-sz7xmlte>About</a> <a href="/editorial" data-astro-cid-sz7xmlte>Editorial Standards</a> <a href="/contact" data-astro-cid-sz7xmlte>Contact</a> <a href="/privacy" data-astro-cid-sz7xmlte>Privacy Policy</a> <a href="/terms" data-astro-cid-sz7xmlte>Terms of Service</a> <a href="/disclaimer" data-astro-cid-sz7xmlte>Disclaimer</a> </nav> <p class="footer-copy" data-astro-cid-sz7xmlte>&copy; 2026 POTUS Watch Daily. All rights reserved. Independent foreign policy coverage.</p> </div> </footer> `;
}, "/Users/purpleworldinc/Desktop/potuswatch/src/components/Footer.astro", void 0);

export { $$BaseLayout as $, $$Footer as a };
