# POTUS Watch Daily

An autonomous foreign-policy news site. A scheduled Cloudflare Worker reads
primary source documents — U.S. presidential actions, Federal Register filings,
Department of War releases, UN and European Council statements — writes an
analysis of one of them, and publishes it to a live Astro site.

**Live:** https://www.potuswatchdaily.com

It runs at zero cost. No servers, no paid APIs, no scheduled-job service.

---

## Architecture

```
Cron (hourly)
   ↓
Cloudflare Worker ── fetch ──▶ whitehouse.gov RSS (full document text)
   │                          federalregister.gov JSON API
   │                          war.gov · press.un.org · consilium.europa.eu
   │
   ├── Workers AI (@cf/openai/gpt-oss-120b) ──▶ article JSON
   ├── image: war.gov photo feed, else Unsplash
   └── INSERT ──▶ Supabase (Postgres)
                     ↓
             Astro SSR on Cloudflare Workers
                     ↓
              Edge cache · sitemap index · Google News feed
```

| Concern | Choice | Why |
|---|---|---|
| Site | Astro 7, SSR, `@astrojs/cloudflare` | Articles publish hourly; a static build would need a deploy per article |
| Hosting | Cloudflare Workers (static assets) | Free tier, edge cache, same platform as the generator. Moved off Pages in Aug 2026: `@astrojs/cloudflare` v14 dropped Pages support, and the Astro 5 line had no patch for five runtime XSS/SSRF advisories |
| Generation | Cloudflare Workers AI | 10,000 free Neurons/day; ~147 per article, so ~67/day of headroom against a 24/day cadence |
| Scheduling | Workers Cron Trigger | Replaced a Railway service — same reliability, no bill |
| Data | Supabase Postgres | Free tier, PostgREST over HTTP so the Worker needs no SDK |
| Sources | U.S. government primary documents | Public domain (17 U.S.C. § 105): no licence, no key, no rate limit |

## Repository layout

```
src/
  layouts/BaseLayout.astro      design tokens, meta, global CSS
  middleware.ts                 cache headers, security headers, apex→www 301
  pages/
    index.astro                 homepage
    article/[slug].astro        article page, SSR from Supabase
    archive/[...page].astro     paginated archive
    region/[region].astro       eight region hubs
    sitemap.xml.ts              sitemap index
    sitemap-articles-[page].xml.ts
    news-sitemap.xml.ts         Google News, last 48h only
worker/
  generator.js                  the hourly generator
  wrangler.jsonc                cron trigger + Workers AI binding
scripts/
  backup-articles.mjs           daily table snapshot, with a shrink guard
  restore-articles.mjs          restore from a snapshot
  setup-cache-rule.mjs          applies the Cloudflare cache rule via API
```

## Decisions worth explaining

**Primary sources, not headlines.** The generator originally rewrote wire
headlines from a news API. That was replaced for two reasons: the API's free
plan forbids production use, and rewriting other outlets' headlines at scale is
close to Google's definition of scaled content abuse. Articles are now written
from the text of the government documents themselves and cite them by number.

**Discovery surfaces must paginate.** The sitemap was capped at 1,000 rows, the
archive at 300 and the homepage at 60, while the table held ~4,000 articles.
About 2,400 articles had no crawlable path to them. Any cap without pagination
is a bug.

**`_headers` does not reach SSR routes on Pages.** It applies to static assets
only. Cache-Control and security headers for server-rendered routes are set in
`src/middleware.ts`, and edge caching is enabled by a Cache Rule applied through
the API in `scripts/setup-cache-rule.mjs`.

**Filling a named Astro slot is `<Fragment slot="x">`, not `<slot name="x">`.**
The latter *defines* an outlet; used in a page it renders its children into the
layout's default slot instead. That silently placed every JSON-LD block inside
`<body>`.

## Local development

```bash
npm install
npm run dev

# generator
cp worker/.dev.vars.example worker/.dev.vars   # then fill it in
npx wrangler dev --config worker/wrangler.jsonc
```

Required Worker secrets: `SUPABASE_URL`, `SUPABASE_KEY`, `UNSPLASH_ACCESS_KEY`.
Optional: `ANTHROPIC_API_KEY` (better prose, paid — falls back to Workers AI),
`CF_ZONE_ID` + `CF_PURGE_TOKEN` (purge the edge cache on publish).

## Operations

`RUNBOOK.md` covers failure modes and recovery. `POTUSWATCH.md` is the working
reference. `MIGRATION.md` documents the Railway → Workers cutover.

## Licence

MIT — see `LICENSE`.
