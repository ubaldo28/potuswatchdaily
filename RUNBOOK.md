# POTUS Watch Daily — Disaster Runbook

---

## 🚨 Site is down / not loading

1. Check Cloudflare Pages: https://dash.cloudflare.com → Workers & Pages → potuswatchdaily
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
- Delete and re-add: `CLOUDFLARE_API_KEY` (Global API Key from Cloudflare)
- Global API Key: https://dash.cloudflare.com/profile/api-tokens → View next to "Global API Key"

### Error: `Authentication error [code: 10000]`
- API token doesn't have Cloudflare Pages permission
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
| SUPABASE_URL / SUPABASE_KEY | Cloudflare Pages env (site) + Worker secrets (generator) |
| ANTHROPIC_API_KEY (optional) | Worker secret |

| UNSPLASH_ACCESS_KEY | Worker secret |
| CLOUDFLARE_API_KEY | GitHub Secrets |
| CLOUDFLARE_EMAIL | GitHub Secrets |
| CLOUDFLARE_ACCOUNT_ID | GitHub Secrets |
| SUPABASE_URL / SUPABASE_KEY | GitHub Secrets (deploy + backup workflows) |
| CF_ZONE_ID / CF_PURGE_TOKEN | Worker secrets — optional, enables purge-on-publish |
