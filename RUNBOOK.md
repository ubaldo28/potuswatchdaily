# POTUS Watch Daily — Disaster Runbook

---

## 🚨 Site is down / not loading

1. Check the Worker: https://dash.cloudflare.com → Workers & Pages → potuswatchdaily
2. Check latest deployment — is it green?
3. If red: check GitHub Actions https://github.com/ubaldo28/potuswatch/actions
4. If Actions red: expand the failed step and read the error
5. If Actions green but site broken: purge Cloudflare cache → Caching → Purge Everything

---

## 🚨 Generator stopped (no new articles)

The generator is a Cloudflare Worker on an hourly cron. Railway is gone.

```bash
curl -s https://potuswatch-generator.<your-subdomain>.workers.dev/health
npx wrangler tail --config worker/wrangler.jsonc
```

`status: degraded` means the newest article is over 3 hours old. The
"Generator health check" workflow polls this every 3 hours and emails on failure.

Common causes:
- **Daily free Neuron allocation spent** (error 3040/4006) — 10,000/day, resets
  00:00 UTC, ~147 per article. 24/day should use ~35%; if it is exhausted,
  something is retrying in a loop.
- **A source feed changed shape** — look for `[sources] <id> failed:`. The run
  continues on the remaining feeds and only skips the hour if all return nothing.
- **All documents already covered** — `no-fresh-sources` is correct behaviour,
  not a fault. It refuses to write the same document twice within five days.
- **Supabase insert rejected** — the error is in `wrangler tail`.

---

## 🚨 GitHub Actions deploy failing

**Always expand the failed step to read the actual error.**

### Error: `Not logged in`
- `CLOUDFLARE_API_KEY` or `CLOUDFLARE_EMAIL` secret is wrong/missing
- Go to: https://github.com/ubaldo28/potuswatch/settings/secrets/actions
- Delete and re-add: `CLOUDFLARE_API_TOKEN` (Cloudflare → Manage account → Account API tokens → Create Token → "Edit Cloudflare Workers")
- Tokens live at: Cloudflare dashboard → Manage account → Account API tokens

### Error: `Authentication error [code: 10000]`
- The token is missing the Workers Scripts:Edit permission, or is scoped to the wrong account
- Use Global API Key instead of scoped token (always works)

### Error: `refusing to allow...workflow`
- GitHub token missing `workflow` scope
- Go to: https://github.com/settings/tokens → edit token → check `workflow` box
- Clear saved credential: `git credential-osxkeychain erase` then enter `protocol=https` / `host=github.com`

### Site not updating after green build:
- Cloudflare's own auto-build is overwriting — workflow already handles this
- Try purging cache: https://dash.cloudflare.com → potuswatchdaily.com → Caching → Purge Everything

---

## 🚨 Ads not showing

### US visitors not seeing ads:
- Check `ads.txt` is correct: https://www.potuswatchdaily.com/ads.txt
- Should contain Google, Adsterra (publisher 3301202), Amazon
- Adsterra scripts must be `async` at bottom of body (not blocking in `<head>`)
- Check Adsterra dashboard for geo-targeting settings

### AdSense not showing:
- Auto ads must be ENABLED in AdSense dashboard
- Account: `ca-pub-7380718671497895`
- Check: https://adsense.google.com → Sites → potuswatchdaily.com → Auto ads

---

## 🚨 CSS/layout broken (images too big, grid wrong, styles not applying)

**Root cause:** `<style is:global>` placed in a page file (outside the `<BaseLayout>` wrapper) does NOT reliably inject into `<head>` in Astro SSR + Cloudflare production. Works fine in dev, silently breaks in prod.

**The permanent rule:** ALL CSS lives in `src/layouts/BaseLayout.astro` inside the `<head>` block. Never add `<style is:global>` to page-level `.astro` files.

**Fix:**
1. Cut the `<style is:global>` block from the page file (e.g. `index.astro`)
2. Paste the styles into `BaseLayout.astro` inside the existing `<style is:global>` block in `<head>`
3. `git push` to rebuild

**After deploying:** open the live URL and visually confirm styles are rendering before calling it done.

---

## 🚨 Logo showing old version (Safari cache)

- Logo file: `public/logo-v2.png`
- `public/_headers` has `Cache-Control: no-store` for `logo.png` and 7-day cache for `logo-v2.png`
- If stuck: rename the logo file to `logo-v3.png` and update all references

---

## Routine deployment

```bash
cd ~/potuswatch
# make your changes
git add -A
git commit -m "describe what you changed"
git push
# GitHub Actions builds and deploys automatically (~2 min)
# Watch: https://github.com/ubaldo28/potuswatch/actions
```

---

## 🚨 Articles missing from Google / archive looks short

Check the row count first — the articles are probably present but undiscoverable:

```bash
railway run bash -c 'curl -s -o /dev/null -D - "$SUPABASE_URL/rest/v1/articles?select=id&limit=1" -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY" -H "Prefer: count=exact" | grep -i content-range'
```

`content-range: 0-0/N` — N is the true row count.

- **N is large, but few pages indexed** → a discovery cap. Check `sitemap-articles-[page].xml.ts`, `archive/[...page].astro`, `index.astro` for a `.limit()` without pagination.
- **N is small / dropped** → restore from a backup:
  ```bash
  node scripts/restore-articles.mjs backups/articles-YYYY-MM-DD.json --dry-run   # inspect
  node scripts/restore-articles.mjs backups/articles-YYYY-MM-DD.json             # insert
  ```
  It only inserts slugs not already live and never deletes.
- **Backup workflow failing** → it fails on purpose when rows drop >5%. Investigate before overriding; a blind re-run would overwrite the last good snapshot.

---

## 🚨 No new articles appearing

The generator is a Cloudflare Worker (cron `0 * * * *`), not Railway.

```bash
curl -s https://potuswatch-generator.<your-subdomain>.workers.dev/health
npx wrangler tail --config worker/wrangler.jsonc      # watch a live run
curl -sS -X POST "https://potuswatch-generator.<your-subdomain>.workers.dev/run?token=$RUN_TOKEN"
```

`status: degraded` means the last article is over 3 hours old. The GitHub Actions
"Generator health check" workflow polls this every 3 hours and emails on failure.

Common causes:
- **Daily free Neuron allocation spent** (error 3040/4006) — 10,000/day, resets 00:00 UTC. ~147 neurons per article, so 24/day should use ~35%. If it is exhausted, something is retrying in a loop.
- **A source feed changed shape** — `[sources] <id> failed:` in the logs. The generator continues on the remaining feeds; it only skips the hour if ALL sources return nothing.
- **Supabase insert rejected** — check the error in `wrangler tail`.

---

## Credentials location

| Secret | Where stored |
|---|---|
| SUPABASE_URL / SUPABASE_KEY | Worker secrets on both the site Worker and the generator Worker (`npx wrangler secret put ...`) |

| UNSPLASH_ACCESS_KEY | Worker secret |
| CLOUDFLARE_API_TOKEN | GitHub Secrets (scoped token, Edit Cloudflare Workers) |
| CLOUDFLARE_EMAIL | GitHub Secrets |
| CLOUDFLARE_ACCOUNT_ID | GitHub Secrets |
| SUPABASE_URL / SUPABASE_KEY | GitHub Secrets (deploy + backup workflows) |
| CF_ZONE_ID / CF_PURGE_TOKEN | Worker secrets — optional, enables purge-on-publish |

---

## Pages → Workers cutover (Aug 2026)

Why: `@astrojs/cloudflare` v14 removed Cloudflare Pages support, and Astro 5 had
no patched release for five runtime advisories — including a **high** Host-header
SSRF (GHSA-2pvr-wf23-7pc7) and a **high** reflected XSS via unescaped slot name
(GHSA-8hv8-536x-4wqp). Staying on Astro 5 meant shipping those. `npm audit` is
now clean.

The Worker is named `potuswatchdaily-site`, not `potuswatchdaily`: the old
Pages project still owns that name and is left in place as the rollback target. Nothing about the
generator Worker changed.

### Cutover, in order

1. `npm ci && npm run build` — must succeed locally first.
2. Set the site Worker's secrets (once):
   ```
   npx wrangler secret put SUPABASE_URL   --config dist/server/wrangler.json
   npx wrangler secret put SUPABASE_KEY   --config dist/server/wrangler.json
   ```
   Use the Supabase **anon/publishable** key here, never `service_role`: this
   Worker only reads, and its bundle is reachable by anyone.
3. `npx wrangler deploy --config dist/server/wrangler.json`
4. Verify on the `*.workers.dev` URL **before touching DNS** — the live site is
   still served by Pages at this point:
   `/`, `/article/<any-slug>`, `/archive/`, `/region/china`, `/sitemap.xml`,
   `/news-sitemap.xml`, `/robots.txt`, `/feed.xml`.
5. Only then, in the dashboard: Workers & Pages → potuswatchdaily → Settings →
   Domains & Routes on **potuswatchdaily-site** → add `www.potuswatchdaily.com`
   and `potuswatchdaily.com`.
   Adding the custom domain to the Worker takes it off the Pages project.
6. Re-verify on the real domain, including the apex → www 301.

### Rollback

Re-point the custom domain at the Pages project. The last Pages deployment is
still there and still serves the pre-migration build.

### What changed in code

- `Astro.locals.runtime` is gone in adapter v14. Every route that needed Supabase
  now does `import { env } from 'cloudflare:workers'` (10 files).
- `wrangler.jsonc` lost `pages_build_output_dir`; the adapter generates the real
  deploy config at `dist/server/wrangler.json`.
- `session: false` and `imageService: 'passthrough'` in `astro.config.mjs`. Without
  them the adapter provisions a KV namespace and a Cloudflare Images binding on
  every deploy; this site uses neither.
- `src/pages/index.astro` had `<main>` closed by `</div>` and a stray `</main>`
  around the newsletter block. Astro 5 tolerated it; Astro 7's compiler rejects
  it. The landmark had been wrapping the wrong content in production.


---

## Cloudflare account

Everything for this project lives in **POTUS Watch Daily**,
account `7ded3077a7ce39644f81502fc5e09647` — the site Worker, the generator
Worker, and the domain.

| Worker | URL | Purpose |
|---|---|---|
| `potuswatchdaily-site` | `potuswatchdaily-site.potuswatchdaily.workers.dev` | serves the site |
| `potuswatch-generator` | `potuswatch-generator.potuswatchdaily.workers.dev` | hourly cron, writes articles |

Same-named copies of the generator exist in other Cloudflare accounts this
machine can log into. They are not this project. If `/health` is being checked
or a deploy is being made, the hostname must be `*.potuswatchdaily.workers.dev`
— any other subdomain is a different account's copy.

Both wrangler configs pin `account_id`. This matters because the same machine
is logged into other Cloudflare accounts for other projects: without the pin,
`wrangler deploy` silently creates a copy of the Worker in whichever account
happens to be active, and the copy looks identical in the dashboard while not
being the one running the cron. With the pin, a deploy from the wrong login
fails and says so.

If a deploy reports an account mismatch, the fix is `npx wrangler login` as the
POTUS Watch Daily account — not changing the config.
