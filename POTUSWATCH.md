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
- GitHub Secrets needed: `CLOUDFLARE_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_WRITE_KEY` (required); `UNSPLASH_ACCESS_KEY` and `CF_PURGE_TOKEN` (optional). Do **not** set `CLOUDFLARE_ACCOUNT_ID` -- the account is pinned in the wrangler configs, and a stale secret overrides it

### Daily backup
- `.github/workflows/backup.yml` dumps the whole `articles` table to `backups/` at 06:00 UTC and commits it
- Refuses to write and fails loudly if the row count dropped >5% since the last snapshot
- Restore with `node scripts/restore-articles.mjs backups/articles-YYYY-MM-DD.json --dry-run` first

---

## Article generator (Cloudflare Worker)

- **File**: `worker/generator.js`
- **Runs**: Cloudflare Worker `potuswatch-generator`, cron `0 * * * *`
- **Health check**: `GET /health` on the generator Worker, https://potuswatch-generator.potuswatchdaily.workers.dev/health . `GET /sources` reports what material is left, behind the same token as `/run`
- **Schedule**: 1 article per hour via Cloudflare Workers AI + primary sources + Unsplash
- **Config**: `worker/wrangler.jsonc` — cron trigger, Workers AI binding, observability on
- **Deploy**: `npx wrangler deploy --config worker/wrangler.jsonc`

### Worker secrets (`wrangler secret put <NAME> --config worker/wrangler.jsonc`):
- `UNSPLASH_ACCESS_KEY`, `SUPABASE_URL`, `SUPABASE_KEY` — required
- `RUN_TOKEN` — optional, enables `POST /run` for manual triggering
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
├── worker/generator.js             # The article generator (Cloudflare Worker on a cron)
├── scripts/backup-articles.mjs     # Daily table dump
├── scripts/restore-articles.mjs    # Restore from a snapshot
├── wrangler.jsonc                  # Cloudflare Workers config
├── astro.config.mjs                # Astro SSR + Cloudflare adapter
└── .github/workflows/deploy.yml   # GitHub Actions auto-deploy
```

---

## Critical Rules

1. **`package.json` has `"type": "module"`** — always use `import/export`, never `require()`
2. **ALL **global** CSS lives in `BaseLayout.astro`. A scoped `<style>` in a component or page is fine; `<style is:global>` in a page file is the thing that breaks in production** — never in `<style>` blocks in page files. `<style is:global>` outside a layout wrapper is unreliable in Astro SSR + Cloudflare and silently breaks in production while working in dev. Article page uses scoped `<style>` which is fine — only `is:global` in page files is the problem.
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

---

## 2026-10 direction change (read this first)

- **Focus:** everything the President does, with tariffs, trade and sanctions as the emphasis. Anything presidential belongs (the name is POTUS). Brand and domain stay POTUS Watch Daily / potuswatchdaily.com on purpose.
- **Design:** "The Ledger" -- paper background, ink text, navy chrome, vermilion accent, gold highlight. Tokens live in `BaseLayout.astro` (`:root`). Fonts: Newsreader, IBM Plex Sans/Mono. Logo is `src/components/SiteLogo.astro` (live text, no image); `public/logo-v3.png` and `og-default.jpg` are raster copies for Google/social.
- **Front page** is text-first with a live sidebar from the Federal Register (`src/lib/actions.ts`); `/tracker` lists every executive order, proclamation and memorandum.
- **Generator** (`worker/generator.js`): 5 articles/day (07, 11, 15, 19, 23 UTC) plus a Sunday 12:00 UTC weekly review. Sources: White House, Federal Register, Treasury/Commerce/USTR, CSIS, plus BBC/NPR/Al Jazeera/Guardian/NYT headlines for corroboration only. Every draft is fact-checked against its sources and rewritten or dropped (`reviewAndRevise`). Routine OFAC/SDN notices are never articles.
- **Photos:** real Commons photos vetted by the model against the headline (`getStoryPhoto`); no match means a branded card (`BrandCard.astro`). Photos are never reused within 60 articles.
- **Free-tier budget:** Workers AI free plan is 10,000 neurons/day (resets 00:00 UTC). The owner does NOT want to pay; never suggest the paid plan. Deploys only run a test article when `worker/` changed.
- **Cron syntax:** Cloudflare wants `SUN`, not `0`, for day-of-week.
- Newsletter email is Sundays. Site signup works (fixed 2026-10-03).

## Weekly email (set up 2026-10-03)

- Sunday briefing, Ledger-styled, real logo image header. Layout lives in `worker/email.js` (shared by the generator and `scripts/build-weekly-email.mjs` for previews).
- Platform: **Resend** (domain potuswatchdaily.com verified), audience segment "General". beehiiv is no longer used.
- **Automatic from 2026-10-11**: the weekly review is written Sunday 12:00 UTC (5 AM Pacific), then the generator builds the email and schedules it in Resend for 14:00 UTC (7 AM Pacific). Needs the `RESEND_API_KEY` secret on the generator Worker (set). `WEEKLY_EMAIL=off` in `worker/wrangler.jsonc` stops it. The 2026-10-04 send was scheduled by hand.
- Editorial only: no ads, affiliate links, sponsors or tip jar, so no postal address is required. If any promotion is ever added, set an address (P.O. box) first.
- Sender `briefing@potuswatchdaily.com`; replies forward to the project Gmail through Cloudflare Email Routing (the old registrar forwarding records were removed from Cloudflare DNS).
- Site signup form works. On the SITE Worker (`potuswatchdaily-site`): `RESEND_API_KEY` and `SUBSCRIBE_SECRET` are encrypted secrets (set in the dashboard; must be type Secret or a deploy wipes them), `RESEND_AUDIENCE_ID` is a var in `wrangler.jsonc` (the General segment id). Welcome email sends from `briefing@potuswatchdaily.com` (default in `src/pages/subscribe.ts`; the old default was Resend's sandbox sender, which only delivers to the account owner). Already-subscribed addresses get a silent success and no email: test with a new address (a Gmail dot variant lands in the same inbox). SEO strategy: `SEO-PLAN.md`.

## Per-order pages (added 2026-10-03, SEO)
- `/order/<federal-register-document-number>` (e.g. `/order/2026-20321`) is a page for each executive order, proclamation and memorandum: metadata, abstract or lead paragraph, our coverage matched by document number, and the full official text (Federal Register, public domain). Code: `src/pages/order/[doc].astro`, `getOrder()` in `src/lib/actions.ts` (uses the Federal Register `subtype` field; `presidential_document_type` is not a valid field on the single-document endpoint). Pages under 150 words of text are `noindex`.
- `/sitemap-orders.xml` lists the 150 newest; it is part of the sitemap index. Tracker rows and the four policy topic hubs (tariffs, sanctions, export controls, presidential actions) link to these pages.
- `/corrections` page added and linked in the footer.
- Static pages now build as `about.html` etc. (`build.format: 'file'` in `astro.config.mjs`) so `/about` serves with 200 and no redirect to `/about/`. Do not link static pages with a trailing slash.
- Strategy and next steps: `SEO-PLAN.md`.

- Timeline pages (2026-10-03): `/timeline/tariffs`, `/timeline/sanctions`, `/timeline/export-controls` list every presidential document matching the term from the Federal Register (`searchActions()` in `src/lib/actions.ts`), grouped by year, each linking to its `/order/<doc>` page, plus latest analysis. In the sitemap, footer and hubs. Live data, so they never go stale.
- Country timelines: `/timeline/china`, `/timeline/iran`, `/timeline/russia` (same route and data as the topic timelines; config in `src/pages/timeline/[topic].astro`). Footer region links point to them.

## Content prune (2026-10-03)
Search Console showed 1.46K of 2.95K known pages not indexed (840 discovered, 378 crawled, not indexed). All 3,368 articles from April to August had no primary-document source (written from news feeds, no fact-check); all 509 from September on cite the White House, Federal Register, USTR or war.gov. The 3,368 were removed (`removed_at` set, they now answer 410) so the site is judged on the fact-checked work. 518 articles live. To restore any: `update articles set removed_at = null where id = ...`. Favicon is now 192px at `/favicon.png`, `/favicon.ico`, `/apple-touch-icon.png` (`src/lib/favicon.ts`).
- Article pages show an "Official text on this site" link to `/order/<doc>`: from a Federal Register source that is a presidential document, else by matching the White House source title in the Federal Register (`findOrderByTitle`). Documents signed in the last few days may not be in the Federal Register yet, so no link until they are. Articles also link to the matching `/timeline/<x>` page.

## Generator visibility and sources (2026-10-05)
- The generator stopped publishing for ~35 h: the only fresh presidential feed was already used and every other candidate was a routine notice. Added the White House **fact sheets** and **briefings-statements** feeds to `RSS_SOURCES` (full text, anything the President does is on-topic). The `articles` feed is skipped on purpose (commentary).
- Every run is now written to Supabase table `generator_runs` (source, ok, outcome with `rejected[]` reasons, including why the fact check dropped a draft). `GET /health` on the generator shows the last 3 runs as `recent_runs`. Read this first when nothing publishes; it needs no Cloudflare login.
- `/health` reports `degraded` only after 20 h without an article (a quiet weekend legitimately has gaps).
- The Cloudflare dashboard and Cloudflare MCP in the Claude app may be signed in to the Round The Way account, not POTUS Watch; use `/health` and GitHub Actions instead.
- 2026-10-07: the drafting prompt now requires every analytic sentence to follow a cited sentence and bans motives/predictions. Before, drafts carried 16-18 speculative claims and the fact check dropped them (run log showed `first-pass-18-unsupported`). The same document that failed at 15:07 UTC published at 16:46 UTC. Do NOT loosen the fact check to fix a quiet generator; read `/health` `recent_runs` and fix the prompt or sources.
