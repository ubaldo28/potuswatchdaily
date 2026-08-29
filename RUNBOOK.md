# POTUS Watch Daily — Disaster Runbook

---

## 🚨 Site is down / not loading

1. Check Cloudflare Pages: https://dash.cloudflare.com → Workers & Pages → potuswatchdaily
2. Check latest deployment — is it green?
3. If red: check GitHub Actions https://github.com/ubaldo28/potuswatch/actions
4. If Actions red: expand the failed step and read the error
5. If Actions green but site broken: purge Cloudflare cache → Caching → Purge Everything

---

## 🚨 Railway crashed / no new articles

**Check logs first:**
Go to https://railway.com → potuswatch service → Deploy Logs

### Error: `require is not defined in ES module scope`
- `package.json` has `"type": "module"` — must use `import` not `require`
- Fix: convert all `require()` to `import` in `localserver.js`

### Error: `Cannot find package 'express'`
- Package missing from `package.json` dependencies
- Fix: add to dependencies, run `npm install`, push

### Error: `npm ci` lock file mismatch
- `package-lock.json` out of sync
- Fix: run `npm install --package-lock-only`, commit and push

### Error: Healthcheck failure
- Railway can't reach `/health` endpoint
- Fix: make sure `localserver.js` listens on `process.env.PORT` not hardcoded 3000

### General Railway fix:
```bash
cd ~/potuswatch
git commit --allow-empty -m "trigger Railway redeploy"
git push
```

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

## Credentials location

| Secret | Where stored |
|---|---|
| SUPABASE_URL / SUPABASE_KEY | Cloudflare Pages dashboard (runtime env) |
| ANTHROPIC_API_KEY | Railway dashboard |
| NEWS_API_KEY | Railway dashboard |
| UNSPLASH_ACCESS_KEY | Railway dashboard |
| CLOUDFLARE_API_KEY | GitHub Secrets |
| CLOUDFLARE_EMAIL | GitHub Secrets |
| CLOUDFLARE_ACCOUNT_ID | GitHub Secrets |
| SUPABASE_URL / SUPABASE_KEY | GitHub Secrets (deploy + backup workflows) |
| CF_ZONE_ID / CF_PURGE_TOKEN | Worker secrets — optional, enables purge-on-publish |
