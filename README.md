# POTUS Watch Daily

A foreign-policy news site that writes and publishes itself.

Every hour a Cloudflare Worker wakes up, pulls the day's primary source
documents — presidential actions, Federal Register filings, Department of War
releases, UN and European Council statements — scores them for relevance,
writes an analysis of the strongest one, finds a matching public-domain
photograph, and publishes it to a live site. Nobody presses a button.

**Live:** <https://www.potuswatchdaily.com>

| | |
|---|---|
| Articles published | 3,400+ since April 2026 |
| Cadence | hourly, unattended |
| Human input per article | none |
| Infrastructure cost | $0/month |
| Servers | none |

The zero is the interesting part. It is not a free-tier trick that falls over
under load — it is the result of choosing primitives that are free at this
scale and then staying inside their limits on purpose. The generator burns
~147 of Cloudflare's 10,000 free daily Neurons per article; at 24 articles a
day that is roughly a third of the allowance, which is the headroom that lets
the cadence rise without a bill.

---

## Architecture

```
Cron trigger (hourly, UTC)
   │
   ▼
Cloudflare Worker ── fetch ──▶ whitehouse.gov       presidential actions, full text
   │                          federalregister.gov  JSON API
   │                          war.gov · press.un.org · consilium.europa.eu
   │
   ├── relevance scoring ─── reject ceremonial and off-topic documents,
   │                         reassign the region when the material fits another
   │
   ├── Workers AI (@cf/openai/gpt-oss-120b) ──▶ article JSON
   │
   ├── image: war.gov photo feed (public domain, credited), else Unsplash
   │
   └── INSERT ──▶ Supabase Postgres
                     │
                     ▼
              Astro SSR on Cloudflare Workers
                     │
                     ▼
     Edge cache · sitemap index · Google News feed · region hubs
```

Two Workers, one database, no servers. The generator and the site are deployed
independently and share nothing but the table.

## Decisions

| Concern | Choice | Why |
|---|---|---|
| Site | Astro 7, SSR, `@astrojs/cloudflare` | Articles publish hourly; a static build would need a deploy per article |
| Hosting | Cloudflare Workers with static assets | Free tier, edge cache, same platform as the generator |
| Generation | Cloudflare Workers AI | 10,000 free Neurons/day, no API key, and the call never leaves Cloudflare's network — so it does not count against the Worker subrequest limit either |
| Scheduling | Workers Cron Trigger | Replaced a paid Railway service at identical reliability |
| Data | Supabase Postgres | PostgREST over HTTP, so the Worker ships no SDK and starts inside the 1s budget |
| Sources | U.S. government primary documents | Public domain under 17 U.S.C. § 105: no licence, no key, no rate limit |
| Images | war.gov photo feed first | Public domain, and the subject actually matches the article |

## Decisions worth explaining

**Primary sources, not headlines.** The generator originally rewrote wire
headlines from a news API. That was replaced for two reasons: the API's free
plan forbids production use, and rewriting other outlets' headlines at scale
sits close to Google's definition of scaled content abuse. Articles are now
written from the text of the government documents themselves and cite them by
bracket number. The change removed a licensing problem and a ranking risk in
one move, and made the writing better, because the model is now reading a
statute rather than a summary of a summary.

**One article, one document.** Earlier versions blended several sources into a
piece and produced confident nonsense at the seams. Now a single lead document
drives the headline and structure; the rest is supporting context the article
may cite, and context that fails the same relevance bar is dropped rather than
padded in.

**Any cap without pagination is a bug.** The sitemap was capped at 1,000 rows,
the archive at 300 and the homepage at 60, while the table held about 4,000
articles. Roughly 2,400 articles had no crawlable path to them at all — they
existed, were indexed nowhere, and were invisible to search. The fix was a
sitemap index, a paginated archive, eight region hubs and prev/next links on
every article, so every row is reachable by following links from the root.

**Filling a named Astro slot is `<Fragment slot="x">`, not `<slot name="x">`.**
The latter *defines* an outlet; used inside a page it renders its children into
the layout's default slot instead. That silently placed every JSON-LD block and
`article:*` meta tag inside `<body>` for months, where no crawler reads them.

**`_headers` never reaches server-rendered routes.** It applies to files served
from the static asset store. Cache-Control and security headers for SSR routes
are set in `src/middleware.ts`; edge caching is a Cache Rule applied through the
API in `scripts/setup-cache-rule.mjs` rather than clicked into a dashboard, so
it is reproducible.

**A monitor that has never gone green is not a monitor.** The generator health
check depended on a repo secret that was never set, so all twelve of its runs
failed on missing configuration rather than on generator health — and the
generator sat broken for hours behind a workflow that looked like it was
running. The URL is hardcoded now, because `/health` exposes nothing worth
hiding, and the same lesson was applied to the backup workflow: unconfigured is
a warning, broken is a failure, and the two must not look alike.

## Security posture

- **Row-level security on.** The public key can read published articles and
  nothing else; writes are rejected. Verified by replaying a previously exposed
  key against the API: read `200`, write `401`.
- **The generator writes with a separate secret key** held only as a Worker
  secret. It is never in the repository, the client bundle, or the build.
- **JSON-LD is escaped before it is embedded.** `<`, `>` and `&` become unicode
  escapes so an article title can never break out of a `<script>` block.
- **URLs from the database are scheme-checked** against an http/https allowlist
  before rendering, so a stored `javascript:` URL cannot become a link.
- **The manual generation endpoint compares its bearer token in constant time**
  and returns 404 when no token is configured, rather than advertising itself.
- **The newsletter endpoint** enforces a same-origin check server-side (CORS is
  a browser courtesy, not a control), caps the request body, rate-limits by IP,
  refuses to re-send a welcome email to an address already subscribed — so it
  cannot be used to mail a stranger repeatedly — and never echoes an upstream
  error back to the browser.
- **Security headers and the apex → www 301** are applied in middleware, on
  every server-rendered response.
- Vulnerability reports: see `SECURITY.md`.

## Accessibility

WCAG 2.2 AA: a skip link, one `<main>` landmark per page, ordered headings, a
visible focus ring, `prefers-reduced-motion` honoured, and a palette checked
for contrast — body text at 8.3:1, secondary at 5.0:1, and the red accent
lightened to #ff5c5c (5.75:1) when used as text, because the brand red is only
3.36:1 as ink.

## Repository layout

```
src/
  layouts/BaseLayout.astro         design tokens, meta, global CSS
  middleware.ts                    cache + security headers, apex→www 301
  pages/
    index.astro                    homepage
    article/[slug].astro           article page, SSR from Supabase
    archive/[...page].astro        paginated archive
    region/[region].astro          eight region hubs
    subscribe.ts                   newsletter signup
    sitemap.xml.ts                 sitemap index
    sitemap-articles-[page].xml.ts paginated article sitemaps
    news-sitemap.xml.ts            Google News, last 48h only
worker/
  generator.js                     the hourly generator
  wrangler.jsonc                   cron trigger + Workers AI binding
scripts/
  backup-articles.mjs              daily table snapshot, with a shrink guard
  restore-articles.mjs             restore from a snapshot
  setup-cache-rule.mjs             applies the Cloudflare cache rule via API
.github/workflows/
  deploy.yml                       build and deploy on push to main
  health.yml                       hourly generator liveness check
  backup.yml                       daily database snapshot
  cache-rule.yml                   reapplies the edge cache rule
```

## Local development

```bash
npm install
npm run dev

# generator
cp worker/.dev.vars.example worker/.dev.vars   # then fill it in
npx wrangler dev --config worker/wrangler.jsonc
```

Worker secrets — `SUPABASE_URL`, `SUPABASE_KEY`, `UNSPLASH_ACCESS_KEY`.
Optional: `CF_ZONE_ID` + `CF_PURGE_TOKEN` (purge the edge cache on publish),
`RUN_TOKEN` (enables `POST /run` to generate on demand).

## Operations

`RUNBOOK.md` covers failure modes and recovery, including the Pages → Workers
cutover and its rollback. `POTUSWATCH.md` is the working reference.
`MIGRATION.md` documents the Railway → Cloudflare move.

## Licence

MIT — see `LICENSE`.
