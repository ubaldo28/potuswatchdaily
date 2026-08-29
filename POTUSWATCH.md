# POTUS Watch Daily — Claude Working Memory

> Paste this file into any new chat to get full context instantly.

---

## Site
- **URL**: https://www.potuswatchdaily.com
- **Purpose**: Auto-generated foreign policy news site. Articles generated hourly by AI from live news.
- **GitHub**: https://github.com/ubaldo28/potuswatch
- **Local folder**: `~/potuswatch`

---

## Full Stack

| Service | Purpose | URL |
|---|---|---|
| **Astro** | Site framework (SSR) | - |
| **Cloudflare Workers** | Hosts the website (static assets + SSR) | dash.cloudflare.com |
| **Cloudflare Workers AI** | Writes the articles (free, 10k neurons/day) | dash.cloudflare.com |
| **Supabase** | Stores articles in DB | supabase.com |
| **GitHub** | Code + triggers deploys | github.com/ubaldo28/potuswatch |
| **AdSense** | Ads (`ca-pub-7380718671497895`) | - |
| **Adsterra** | Ads (publisher ID: `3301202`) | - |

---

## Deployment — HOW IT WORKS

```
git push → GitHub Actions → npm run build → wrangler deploy → Cloudflare Workers live
```

- **Just run `git push`** — everything else is automatic
- GitHub Actions workflow: `.github/workflows/deploy.yml`
- Workflow also disables Cloudflare's own auto-build (prevents conflicts)
- GitHub Secrets needed: `CLOUDFLARE_API_KEY`, `CLOUDFLARE_EMAIL`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_URL`, `SUPABASE_KEY`

### Daily backup
- `.github/workflows/backup.yml` dumps the whole `articles` table to `backups/` at 06:00 UTC and commits it
- Refuses to write and fails loudly if the row count dropped >5% since the last snapshot
- Restore with `node scripts/restore-articles.mjs backups/articles-YYYY-MM-DD.json --dry-run` first

---

## Article generator (Cloudflare Worker)

- **File**: `worker/generator.js`
- **Runs**: Cloudflare Worker `potuswatch-generator`, cron `0 * * * *`
- **Health check**: `GET /health` on `process.env.PORT`
- **Schedule**: 1 article per hour via Cloudflare Workers AI + primary sources + Unsplash
- **Config**: `worker/wrangler.jsonc` — cron trigger, Workers AI binding, observability on
- **Deploy**: `npx wrangler deploy --config worker/wrangler.jsonc`

### Worker secrets (`wrangler secret put <NAME> --config worker/wrangler.jsonc`):
- `UNSPLASH_ACCESS_KEY`, `SUPABASE_URL`, `SUPABASE_KEY` — required
- `RUN_TOKEN` — optional, enables `POST /run` for manual triggering
- `ANTHROPIC_API_KEY` — OPTIONAL. Costs money. Set it only to get Haiku prose
  instead of the free model; failures fall back to Workers AI automatically.
- `CF_ZONE_ID` / `CF_PURGE_TOKEN` — optional, purges the edge cache on publish

**No NEWS_API_KEY.** NewsAPI's free plan forbids production use; the generator
now reads public-domain U.S. government primary sources instead (White House
Presidential Actions with full document text, Federal Register, war.gov, UN,
EU Council). No keys, no licence, no rate limits.

---

## Key Files

```
potuswatch/
├── src/
│   ├── layouts/BaseLayout.astro    # All meta, AdSense, Adsterra, fonts
│   ├── pages/
│   │   ├── index.astro             # Homepage — 3-col grid, filter, search
│   │   ├── article/[slug].astro    # Article page — SSR from Supabase
│   │   ├── sitemap.xml.ts          # Sitemap INDEX (not a urlset)
│   │   ├── sitemap-articles-[page].xml.ts  # Paginated article sitemaps, 2000/page
│   │   ├── sitemap-pages.xml.ts    # Static pages + region hubs
│   │   ├── news-sitemap.xml.ts     # Google News, last 48h ONLY
│   │   ├── region/[region].astro   # 8 region hub pages
│   │   ├── archive/[...page].astro # Paginated archive, 100/page
│   │   ├── robots.txt.ts           # Robots with Googlebot-News rules
│   │   ├── ads.txt.ts              # AdSense + Adsterra publisher IDs
│   │   ├── feed.xml.ts             # RSS feed
│   │   └── subscribe.ts            # Email subscribe endpoint
│   └── components/
│       ├── Footer.astro
│       └── Masthead.astro
├── public/
│   ├── _headers                    # Cache rules (logo-v2.png, articles, JS/CSS)
│   ├── _redirects                  # HTML → clean URL redirects
│   ├── logo-v2.png                 # Current logo
│   └── og-default.jpg              # OG fallback image
├── src/middleware.ts               # Cache-Control + security headers for SSR routes
├── worker/generator.js             # Cloudflare Cron replacement — see MIGRATION.md
├── scripts/backup-articles.mjs     # Daily table dump
├── scripts/restore-articles.mjs    # Restore from a snapshot
├── wrangler.jsonc                  # Cloudflare Workers config
├── astro.config.mjs                # Astro SSR + Cloudflare adapter
└── .github/workflows/deploy.yml   # GitHub Actions auto-deploy
```

---

## Critical Rules

1. **`package.json` has `"type": "module"`** — always use `import/export`, never `require()`
2. **ALL CSS lives in `BaseLayout.astro`** — never in `<style>` blocks in page files. `<style is:global>` outside a layout wrapper is unreliable in Astro SSR + Cloudflare and silently breaks in production while working in dev. Article page uses scoped `<style>` which is fine — only `is:global` in page files is the problem.
3. **`dist/` is in `.gitignore`** — never commit it, GitHub Actions builds fresh
5. **SUPABASE_URL / SUPABASE_KEY are Worker secrets**, set with `npx wrangler secret put`, never in code. Since adapter v14 the pages read them via `import { env } from 'cloudflare:workers'` — `Astro.locals.runtime` no longer exists
6. **Static files in `public/` are unreliable with the Cloudflare SSR adapter** — serve them as Astro API routes (`.ts` files in `src/pages/`) like `ads.txt.ts`, `robots.txt.ts`, `favicon.svg.ts`
7. **Filling a named slot uses `<Fragment slot="head">`, NEVER `<slot name="head">`.** A `<slot>` element in a page *defines* an outlet, it does not fill one — its children render as fallback into the layout's default slot, i.e. inside `<body>`. This silently put every JSON-LD block and `article:*` meta tag in the body for months.
8. **`public/_headers` does NOT apply to SSR routes.** It only touches files served from the static asset store. Cache and security headers for SSR pages live in `src/middleware.ts`.
9. **Never cap a discovery surface without pagination.** The sitemap `.limit(1000)`, archive `.limit(300)` and homepage `.limit(60)` left ~2400 articles with no crawlable path to them.
10. **The Google News sitemap must contain only the last 48 hours.** That is `news-sitemap.xml`. Do not put `<news:news>` tags in the main article sitemaps.
11. **`dist/` is gitignored but was also tracked** — files committed before an ignore rule is added stay tracked. Untracked as of Aug 2026; do not re-add.
12. **After every deployment, verify the live site visually** — code looking correct locally is not enough. CSS failures only appear in production.

---

## Common Issues & Fixes

See `RUNBOOK.md` for step-by-step disaster recovery.
