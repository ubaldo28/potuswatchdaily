# POTUS Watch Daily — Disaster Runbook

## Start here

```bash
npm run doctor
```

Checks the three things in order and names which one is broken: whether the
repository's own identifiers agree, whether the generator Worker answers and can
read the database, and whether the public site serves real articles. Everything
below is for when `doctor` has already told you *what* is wrong and you need to
know *why*.

`npm run check:config` is the first half on its own — it needs no network and
runs in under a second. CI runs it before every deploy.

### What serves potuswatchdaily.com

**The Worker `potuswatchdaily-site`.** Both `potuswatchdaily.com` and
`www.potuswatchdaily.com` are custom domains of that Worker, which CI deploys on
every push to `main` (moved off the old Cloudflare Pages project on 2026-10-02).
The old Pages project still exists but is frozen and cannot be rebuilt; do not
move the domain back to it.

- Secrets for the live site are set on the site Worker (`SUPABASE_URL`,
  `SUPABASE_KEY`); CI provisions them from `project.config.json` and GitHub
  Secrets on every deploy.
- The live domain carries a build stamp (`<meta name="pw-build">`) that
  `health.yml` compares with the repository, so a deploy that does not reach
  readers is caught.
- `npm run doctor` checks the live domain, the generator and the config.

### One place for names

`project.config.json` holds the Cloudflare account id, both Worker names, the
workers.dev subdomain and the health URL. Nothing reads it at runtime;
`scripts/check-config.mjs` asserts that `wrangler.jsonc`,
`worker/wrangler.jsonc` and every workflow still agree with it, and the deploy
refuses to run if they don't.

This exists because the same failure kept repeating in three different costumes:
an account id pinned in one wrangler config but not the other put the generator
into an unrelated account; a stale `CLOUDFLARE_ACCOUNT_ID` repository secret
overrode the pinned account and reported it as an authentication error; a
hostname copied off a dashboard pointed the health check at a Worker belonging to
a different project, so the monitor stayed green while the site went stale. None
of those failed loudly. Each one deployed cleanly into the wrong place. A
one-second grep-level check catches all three.

---

## 🚨 Site is down / not loading

1. Check the Worker: https://dash.cloudflare.com → Workers & Pages → `potuswatchdaily-site` (the Worker that serves the domain and that CI deploys)
2. Check latest deployment — is it green?
3. If red: check GitHub Actions https://github.com/ubaldo28/potuswatch/actions
4. If Actions red: expand the failed step and read the error
5. If Actions green but site broken: purge Cloudflare cache → Caching → Purge Everything

---

## 🚨 Generator stopped (no new articles)

The generator is a Cloudflare Worker on an hourly cron. Railway is gone.

```bash
curl -s https://potuswatch-generator.potuswatchdaily.workers.dev/health
npx wrangler tail --config worker/wrangler.jsonc
```

`status: degraded` means the newest article is over 3 hours old. The
"Generator health check" workflow polls this hourly and opens a GitHub issue on failure.

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
- `CLOUDFLARE_API_TOKEN` is missing or wrong. `deploy.yml` verifies it against Cloudflare's own token-verify endpoint before building, and prints the token's length -- a short length means a truncated paste.
- Go to: https://github.com/ubaldo28/potuswatch/settings/secrets/actions
- Delete and re-add: `CLOUDFLARE_API_TOKEN` (Cloudflare → Manage account → Account API tokens → Create Token → "Edit Cloudflare Workers")
- Tokens live at: Cloudflare dashboard → Manage account → Account API tokens

### Error: `Authentication error [code: 10000]`
- The token is missing the Workers Scripts:Edit permission, or is scoped to the wrong account
- The token is missing `Workers Scripts:Edit`, or is scoped to a different account. Re-issue it from the "Edit Cloudflare Workers" template on the account pinned in `wrangler.jsonc`. Do **not** substitute the Global API Key: it grants the whole account and cannot be scoped.

### Error: `refusing to allow...workflow`
- GitHub token missing `workflow` scope
- Go to: https://github.com/settings/tokens → edit token → check `workflow` box
- Clear saved credential: `git credential-osxkeychain erase` then enter `protocol=https` / `host=github.com`

### Site not updating after green build:
- (removed: nothing in deploy.yml disables a Cloudflare auto-build, so this line described handling that does not exist)
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
curl -s -o /dev/null -D - "$SUPABASE_URL/rest/v1/articles?select=id&limit=1" \
  -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Prefer: count=exact" | grep -i content-range
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
curl -s https://potuswatch-generator.potuswatchdaily.workers.dev/health
npx wrangler tail --config worker/wrangler.jsonc      # watch a live run
curl -sS -X POST "https://potuswatch-generator.potuswatchdaily.workers.dev/run?token=$RUN_TOKEN"
```

`status: degraded` means the last article is over 3 hours old. The GitHub Actions
"Generator health check" workflow polls this hourly and opens a GitHub issue on failure.

Common causes:
- **Daily free Neuron allocation spent** (error 3040/4006) — 10,000/day, resets 00:00 UTC. ~147 neurons per article, so 24/day should use ~35%. If it is exhausted, something is retrying in a loop.
- **A source feed changed shape** — `[sources] <id> failed:` in the logs. The generator continues on the remaining feeds; it only skips the hour if ALL sources return nothing.
- **Supabase insert rejected** — check the error in `wrangler tail`.

---

## Credentials location

| Secret | Where stored | Notes |
|---|---|---|
| `SUPABASE_URL` | GitHub Secrets | Pushed to both Workers by `deploy.yml` on every deploy |
| `SUPABASE_WRITE_KEY` | GitHub Secrets | service_role or `sb_secret_`; uploaded to the generator as `SUPABASE_KEY` |
| `CLOUDFLARE_API_TOKEN` | GitHub Secrets | Scoped "Edit Cloudflare Workers" token. Never the Global API Key |
| `CF_PURGE_TOKEN` | GitHub Secrets (optional) | Zone -> Cache Purge on this zone ONLY. Enables purge-on-publish |
| `UNSPLASH_ACCESS_KEY` | GitHub Secrets (optional) | Without it, images come from government photo feeds only |
| `RESEND_API_KEY` / `RESEND_AUDIENCE_ID` | Site Worker secrets | Set by hand with `wrangler secret put`; no workflow provisions them |
| `SUBSCRIBE_SECRET` | Site Worker secret | Signs unsubscribe links |
| `RUN_TOKEN` | Generator Worker secret | Minted fresh by each deploy; gates `POST /run` and `GET /sources` |

The site's **read** key is not a secret and is not listed here: it is the
Supabase publishable key, committed in `project.config.json`. Supabase designs
that key to ship in browser JavaScript, and row-level security bounds it to
reading published articles.

`CLOUDFLARE_ACCOUNT_ID` is deliberately **not** a repository secret. When it was
one, a stale value silently overrode the account pinned in the wrangler configs
and every deploy failed with a generic authentication error that pointed at the
token instead.

---

## History: Pages to Workers (Aug to Oct 2026)

`@astrojs/cloudflare` v14 dropped Cloudflare Pages support, and staying on Astro 5
meant shipping known high-severity advisories, so the site moved to a Worker. The
code was deployed to the Worker in August and the domain was attached to it on
2026-10-02. Nothing about the generator Worker changed.

## The generator, and why it is set up this way

Everything lives in one Cloudflare account: **POTUS Watch Daily**,
`7ded3077a7ce39644f81502fc5e09647`. The site Worker, the generator Worker and
the domain are all there, and both wrangler configs pin that account id.

| Worker | Hostname |
|---|---|
| `potuswatchdaily-site` | `potuswatchdaily-site.potuswatchdaily.workers.dev` |
| `potuswatch-generator` | `potuswatch-generator.potuswatchdaily.workers.dev` |

**Nothing is configured by hand.** A push to `main` deploys both Workers,
pushes the generator's three secrets from GitHub Secrets, and then calls
`/health` and fails the run if the generator cannot reach the database. Delete
the generator entirely and one push rebuilds it — code, cron trigger, secrets.

This is deliberate. The generator used to be deployed by hand from a laptop,
which meant:

- it landed in whichever Cloudflare account that laptop was logged into, and
  ended up copied into three of them, identical in name, only one doing work;
- its credentials existed only on that one Worker, so nothing in the repository
  could rebuild it;
- a fix could sit committed and undeployed for a day while the copy holding the
  cron kept running old code;
- and the monitor was pointed at a hostname someone had written down, which
  turned out to be a different copy — so it reported healthy while the real one
  was dead.

Every one of those failures came from state that lived somewhere other than
this repository. So now none of it does.

### Required GitHub Secrets

| Secret | What it is |
|---|---|
| `CLOUDFLARE_API_TOKEN` | User API token, "Edit Cloudflare Workers" template, scoped to this account |
| `SUPABASE_URL` | `https://wvuydfupjpjmanqccdax.supabase.co` |
| `SUPABASE_WRITE_KEY` | Supabase **service_role** key — the generator inserts rows, and RLS blocks the publishable key from writing |
| `UNSPLASH_ACCESS_KEY` | Optional; without it images come from government photo feeds only |

The site Worker reads with the publishable key (`SUPABASE_KEY`); only the
generator needs the write key. Keeping them as separate secrets means the
read-only key cannot be mistaken for the write one.
