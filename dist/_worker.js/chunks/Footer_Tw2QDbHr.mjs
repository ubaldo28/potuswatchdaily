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
  const SITE = "https://www.potuswatchdaily.com";
  return renderTemplate(_a || (_a = __template(['<html lang="en"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>', '</title><meta name="description"', '><link rel="canonical"', ">", '<!-- Open Graph --><meta property="og:locale" content="en_US"><meta property="og:type"', '><meta property="og:title"', '><meta property="og:description"', '><meta property="og:url"', '><meta property="og:image"', '><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt"', '><meta property="og:site_name" content="POTUS Watch Daily"><!-- Twitter --><meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@POTUSwatch"><meta name="twitter:creator" content="@POTUSwatch"><meta name="twitter:title"', '><meta name="twitter:description"', '><meta name="twitter:image"', '><meta name="twitter:image:alt"', '><!-- Google AdSense --><meta name="google-adsense-account" content="ca-pub-7380718671497895"><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7380718671497895" crossorigin="anonymous"><\/script><!-- Adsterra -->', "", `<!-- Favicon --><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%230a0a0a'/><circle cx='16' cy='16' r='12' fill='none' stroke='%23cc0000' stroke-width='2.5'/><circle cx='16' cy='16' r='4' fill='%23cc0000'/></svg>"><!-- Feeds & discovery --><link rel="alternate" type="application/rss+xml" title="POTUS Watch Daily" href="/feed.xml"><link rel="sitemap" type="application/xml" href="/sitemap.xml"><!-- Preload critical assets --><link rel="preload" as="image"`, ' fetchpriority="high"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap"><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><!-- Google Analytics --><script async src="https://www.googletagmanager.com/gtag/js?id=G-FRVP4L2Z2T"><\/script>', "", "", '</head> <body> <div class="top-bar"></div> ', "  </body> </html>"])), title, addAttribute(description, "content"), addAttribute(canonicalUrl, "href"), noIndex ? renderTemplate`<meta name="robots" content="noindex, nofollow">` : renderTemplate`<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">`, addAttribute(ogType, "content"), addAttribute(title, "content"), addAttribute(description, "content"), addAttribute(canonicalUrl, "content"), addAttribute(ogImage, "content"), addAttribute(title, "content"), addAttribute(title, "content"), addAttribute(description, "content"), addAttribute(ogImage, "content"), addAttribute(title, "content"), renderScript($$result, "/Users/purpleworldinc/Desktop/potuswatch/src/layouts/BaseLayout.astro?astro&type=script&index=0&lang.ts"), renderScript($$result, "/Users/purpleworldinc/Desktop/potuswatch/src/layouts/BaseLayout.astro?astro&type=script&index=1&lang.ts"), addAttribute(`${SITE}/logo-v2.png`, "href"), renderScript($$result, "/Users/purpleworldinc/Desktop/potuswatch/src/layouts/BaseLayout.astro?astro&type=script&index=2&lang.ts"), renderSlot($$result, $$slots["head"]), renderHead(), renderSlot($$result, $$slots["default"]));
}, "/Users/purpleworldinc/Desktop/potuswatch/src/layouts/BaseLayout.astro", void 0);

const $$Astro = createAstro("https://www.potuswatchdaily.com");
const $$Footer = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Footer;
  const { maxWidth = "1280px" } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<footer class="footer" data-astro-cid-sz7xmlte> <div class="footer-inner"${addAttribute(`max-width: ${maxWidth}`, "style")} data-astro-cid-sz7xmlte> <a href="/" class="footer-logo" data-astro-cid-sz7xmlte> <img src="/logo-v2.png" width="200" height="35" alt="POTUS Watch Daily" style="display:block" data-astro-cid-sz7xmlte> </a> <nav class="footer-links" data-astro-cid-sz7xmlte> <a href="/" data-astro-cid-sz7xmlte>Home</a> <a href="/archive" data-astro-cid-sz7xmlte>Archive</a> <a href="/explainers/" data-astro-cid-sz7xmlte>Explainers</a> <a href="/newsletter" data-astro-cid-sz7xmlte>Newsletter</a> <a href="/about" data-astro-cid-sz7xmlte>About</a> <a href="/editorial" data-astro-cid-sz7xmlte>Editorial Standards</a> <a href="/contact" data-astro-cid-sz7xmlte>Contact</a> <a href="/privacy" data-astro-cid-sz7xmlte>Privacy Policy</a> <a href="/terms" data-astro-cid-sz7xmlte>Terms of Service</a> <a href="/disclaimer" data-astro-cid-sz7xmlte>Disclaimer</a> </nav> <p class="footer-copy" data-astro-cid-sz7xmlte>&copy; 2026 POTUS Watch Daily. All rights reserved. Independent foreign policy coverage.</p> </div> </footer> `;
}, "/Users/purpleworldinc/Desktop/potuswatch/src/components/Footer.astro", void 0);

export { $$BaseLayout as $, $$Footer as a };
