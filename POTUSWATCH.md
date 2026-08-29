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
| **Cloudflare Pages** | Hosts the website | dash.cloudflare.com |
| **Railway** | Runs article generator | railway.com |
| **Supabase** | Stores articles in DB | supabase.com |
| **GitHub** | Code + triggers deploys | github.com/ubaldo28/potuswatch |
| **AdSense** | Ads (`ca-pub-7380718671497895`) | - |
| **Adsterra** | Ads (publisher ID: `3301202`) | - |

---

## Deployment — HOW IT WORKS

```
git push → GitHub Actions → npm run build → wrangler pages deploy dist → Cloudflare Pages live
```

- **Just run `git push`** — everything else is automatic
- GitHub Actions workflow: `.github/workflows/deploy.yml`
- Workflow also disables Cloudflare's own auto-build (prevents conflicts)
- GitHub Secrets needed: `CLOUDFLARE_API_KEY`, `CLOUDFLARE_EMAIL`, `CLOUDFLARE_ACCOUNT_ID`

---

## Railway (Article Generator)

- **File**: `localserver.js`
- **Runs**: `node localserver.js`
- **Health check**: `GET /health` on `process.env.PORT`
- **Schedule**: Generates 1 article per hour via Claude Haiku + NewsAPI + Unsplash
- **Config**: `railway.toml` — always-restart policy, healthcheck at /health
- **Auto-deploys**: Yes, from GitHub pushes

### Railway env vars (set in Railway dashboard):
- `ANTHROPIC_API_KEY`
- `NEWS_API_KEY`
- `UNSPLASH_ACCESS_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY`

---

## Key Files

```
potuswatch/
├── src/
│   ├── layouts/BaseLayout.astro    # All meta, AdSense, Adsterra, fonts
│   ├── pages/
│   │   ├── index.astro             # Homepage — 3-col grid, filter, search
│   │   ├── article/[slug].astro    # Article page — SSR from Supabase
│   │   ├── sitemap.xml.ts          # Dynamic sitemap from Supabase
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
├── localserver.js                  # Railway article generator
├── railway.toml                    # Railway config
├── wrangler.jsonc                  # Cloudflare Pages config
├── astro.config.mjs                # Astro SSR + Cloudflare adapter
└── .github/workflows/deploy.yml   # GitHub Actions auto-deploy
```

---

## Critical Rules

1. **`package.json` has `"type": "module"`** — always use `import/export`, never `require()`
2. **ALL CSS lives in `BaseLayout.astro`** — never in `<style>` blocks in page files. `<style is:global>` outside a layout wrapper is unreliable in Astro SSR + Cloudflare and silently breaks in production while working in dev. Article page uses scoped `<style>` which is fine — only `is:global` in page files is the problem.
3. **`dist/` is in `.gitignore`** — never commit it, GitHub Actions builds fresh
4. **Railway listens on `process.env.PORT`** — not hardcoded 3000
5. **Cloudflare Pages env vars** (SUPABASE_URL, SUPABASE_KEY) are set in Cloudflare dashboard, not in code
6. **Static files in `public/` don't work with Cloudflare SSR adapter** — serve them as Astro API routes (`.ts` files in `src/pages/`) like `ads.txt.ts`, `robots.txt.ts`, `favicon.svg.ts`
7. **After every deployment, verify the live site visually** — code looking correct locally is not enough. CSS failures only appear in production.

---

## Common Issues & Fixes

See `RUNBOOK.md` for step-by-step disaster recovery.
