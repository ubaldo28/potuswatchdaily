# Migrating the article generator from Railway to Cloudflare Workers Cron Triggers

The hourly generator currently runs as a long-lived Node/Express process on
Railway (`localserver.js`, `railway.toml`). This moves it to a Cloudflare Worker
fired by a Cron Trigger, which fits inside the **Workers Free** plan.

**Nothing in this migration modifies existing files.** `localserver.js`,
`railway.toml`, `wrangler.jsonc` and `.github/workflows/deploy.yml` are
untouched, so you can run Railway and the Worker side by side until you have
verified the Worker, then shut Railway down.

New files:

| Path | What it is |
|---|---|
| `worker/generator.js` | The scheduled handler — a faithful port of `localserver.js` |
| `worker/wrangler.jsonc` | Worker config with the hourly Cron Trigger |
| `worker/.dev.vars.example` | Template for local secrets |
| `MIGRATION.md` | This document |

---

## 1. Does this fit the free plan? Yes — verified

Every number below was read from Cloudflare's current docs, with the source URL.

| Limit | Workers Free | What this job needs | Fits? |
|---|---|---|---|
| Cron Triggers per account | **5** | 1 | Yes |
| Minimum cron granularity | **1 minute** | 1 hour | Yes |
| **CPU time per Cron Trigger** | **10 ms** | **~0.75 ms measured** | Yes |
| Wall-clock duration per cron invocation | **15 min** | ~35–60 s typical | Yes |
| Subrequests per invocation | **50** | 9 typical, 13 worst case | Yes |
| Simultaneous open connections | 6 | 1–2 | Yes |
| Daily requests | 100,000 | 24 | Yes |
| Startup time (top-level code) | 1 s | negligible — no dependencies | Yes |
| Memory | 128 MB | negligible | Yes |

Sources:
- CPU time per Cron Trigger, subrequests, daily requests, cron count, startup time, memory —
  <https://developers.cloudflare.com/workers/platform/limits/>
- Cron expression syntax and one-minute granularity; local testing route —
  <https://developers.cloudflare.com/workers/configuration/cron-triggers/>
- `scheduled()` handler contract and the 15-minute duration ceiling —
  <https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/>

### The 10 ms question, answered

The free plan's 10 ms sounds fatal for a job whose Anthropic call takes ~30
seconds. It is not, because Workers meters **CPU time, not wall-clock time**.
Cloudflare states plainly:

> Waiting on network requests (such as `fetch()` calls, KV reads, or database
> queries) does **not** count toward CPU time.

So the ~30 s spent waiting on Anthropic, plus the NewsAPI, Unsplash and Supabase
round trips, are free. Only actual JavaScript execution is charged: JSON parsing,
the regex cleanup, the similarity comparison, and slug building.

That work was benchmarked against realistic payloads (a 31 KB NewsAPI response
with 20 articles, a 5.7 KB Anthropic response containing a ~700-word article,
and 60 recent titles to compare against). **A cold single run costs ~0.75 ms of
CPU** — roughly 7 % of the 10 ms budget, about a 13× margin.

Two things preserve that margin, and both are deliberate:

1. **No `@supabase/supabase-js` and no `axios`.** The port speaks to Supabase's
   PostgREST HTTP API with plain `fetch()`. Pulling in the Supabase client would
   add module evaluation and object graph construction to every cold isolate for
   no benefit here. (`axios` also would not work — its default adapter targets
   Node's `http` module.)
2. **The similarity query is capped** at 500 rows (`SIMILARITY_ROW_CAP`). Under
   hourly generation a 48-hour window holds at most ~48 rows, so the cap can
   never bind in normal operation. It exists so that a backfilled or
   bulk-imported `articles` table cannot silently push the comparison loop past
   10 ms and start failing every run with Error 1102.

If a run ever does exceed 10 ms, Cloudflare terminates the invocation with
**Error 1102, "Worker exceeded resource limits"**, which will appear in
`wrangler tail`. That is the signal to either trim the work or move to the
$5/month Workers Paid plan, where the cron CPU ceiling becomes 15 minutes for
intervals of an hour or more.

### Subrequest budget (limit: 50)

| Call | Count |
|---|---|
| NewsAPI | 1 (up to 3 on retry) |
| Supabase — round-robin region | 1 |
| Anthropic | 1 (up to 3 on retry) |
| Supabase — similarity check | 1 |
| Supabase — slug uniqueness probe | 1 |
| Unsplash — hero + card | 2 |
| Supabase — insert | 1 |
| IndexNow ping | 1 |
| **Typical / worst case** | **9 / 13** |

Comfortably clear of 50.

### Why not GitHub Actions?

A scheduled GitHub Actions workflow was the fallback, and it would work: Actions
is free with unlimited standard-runner minutes for public repositories, and
GitHub Free includes 2,000 minutes/month for private ones — an hourly 1-minute
job costs ~720 minutes/month, which fits either way
(<https://docs.github.com/en/billing/concepts/product-billing/github-actions>).

Workers is the better choice here for four reasons:

1. **`schedule` on Actions runs at most every 5 minutes and is explicitly
   best-effort** — "During periods of high load, scheduled workflow runs may be
   delayed", and runs are dropped rather than queued indefinitely. Skipped hours
   would be normal, not exceptional.
2. **Actions disables scheduled workflows after 60 days of repository
   inactivity.** For a site that mostly runs itself, that is a silent outage
   waiting to happen.
3. Your site, DNS and deploy pipeline are already on Cloudflare. One fewer
   platform holding a copy of your Anthropic and Supabase keys.
4. Cold-start latency and runner queue time disappear; the Worker starts in
   milliseconds.

The one thing Actions does better is a fatter CPU allowance. Given the measured
0.75 ms, that does not matter.

---

## 2. Set the secrets

From the repository root. Each command prompts for the value on stdin — nothing
is written to disk or shell history.

```bash
npx wrangler secret put ANTHROPIC_API_KEY   --config worker/wrangler.jsonc
npx wrangler secret put NEWS_API_KEY        --config worker/wrangler.jsonc
npx wrangler secret put UNSPLASH_ACCESS_KEY --config worker/wrangler.jsonc
npx wrangler secret put SUPABASE_URL        --config worker/wrangler.jsonc
npx wrangler secret put SUPABASE_KEY        --config worker/wrangler.jsonc
```

Use the same values Railway has today (Railway dashboard -> your service ->
Variables). `SUPABASE_URL` is the bare project URL with no trailing path, e.g.
`https://abcdefghijkl.supabase.co`.

Optional — only if you want the manual-trigger endpoint live in production:

```bash
npx wrangler secret put RUN_TOKEN --config worker/wrangler.jsonc
```

Confirm what landed (names only, never values):

```bash
npx wrangler secret list --config worker/wrangler.jsonc
```

> `wrangler secret put` requires the Worker to exist. If it complains that the
> script is not found, run the deploy in step 4 first — it will deploy with no
> secrets and fail its first cron run, which is harmless — then set the secrets.

---

## 3. Test locally before deploying

Create `worker/.dev.vars` from the template and fill in the real values:

```bash
cp worker/.dev.vars.example worker/.dev.vars
$EDITOR worker/.dev.vars
```

`.dev.vars` is already covered by `.gitignore`. Do not commit it.

Start the dev server:

```bash
npx wrangler dev --config worker/wrangler.jsonc --test-scheduled
```

Then, in a second terminal, fire the scheduled handler by hand:

```bash
# Path documented for current Wrangler:
curl "http://localhost:8787/cdn-cgi/handler/scheduled"

# Older Wrangler releases expose this instead — try it if the above 404s:
curl "http://localhost:8787/__scheduled"
```

Both routes exist only because Wrangler versions differ on which one they
expose; `--test-scheduled` is what enables the `/__scheduled` form. Try the
first, fall back to the second.

You should see, in the `wrangler dev` terminal:

```
[cron] Fired: pattern="0 * * * *" scheduledTime=...
[generator] Starting article generation...
[generator] Fetched 18 usable headlines.
[generator] Region selected: China
[generator] Saved: "..." | Region: China | Slug: ...
[indexnow] Submitted: ... (HTTP 200)
[generator] Done (cron) in 41231ms: {"status":"ok",...}
```

A local run writes a real row to your real Supabase table. That is the point —
it proves the whole path end to end. Delete the test row afterwards if you do
not want it live (step 5 tells you how to find it).

You can also check the health endpoint: `curl http://localhost:8787/health`.

---

## 4. Deploy

```bash
npx wrangler deploy --config worker/wrangler.jsonc
```

Wrangler prints the registered triggers on success. Confirm you see:

```
Uploaded potuswatch-generator (x.xx sec)
Deployed potuswatch-generator triggers (x.xx sec)
  schedule: 0 * * * *
```

This deploys a **new, separate Worker** named `potuswatch-generator`. It does
not touch the `potuswatchdaily` Pages project that serves the Astro site, and it
does not interfere with `.github/workflows/deploy.yml`.

---

## 5. Verify a row lands in Supabase

Watch the next scheduled run live. Start this a minute or two before the top of
the hour and leave it running:

```bash
npx wrangler tail potuswatch-generator --format pretty
```

If you do not want to wait for the hour, trigger it immediately. Two options:

- **Dashboard:** Workers & Pages -> `potuswatch-generator` -> Settings ->
  Triggers -> Cron Triggers -> the trigger's "..." menu -> Trigger.
- **HTTP,** if you set `RUN_TOKEN` in step 2:
  ```bash
  curl -X POST "https://potuswatch-generator.<your-subdomain>.workers.dev/run?token=<RUN_TOKEN>"
  ```

Then confirm the row exists. In the Supabase SQL editor:

```sql
select id, title, region, slug, published_at, date, time,
       (image  is not null and image  <> '') as has_card_image,
       (hero_image is not null and hero_image <> '') as has_hero_image,
       length(body) as body_chars
from articles
order by id desc
limit 5;
```

Check that:

- the newest row's `published_at` matches the run you just watched;
- `region` is the next one after the previous row's, in this order —
  `Iran, China, NATO, Americas, Mideast, Russia, Trade, Analysis` (round-robin);
- `slug` contains no year (`2024`–`2027` are stripped);
- `body_chars` is comfortably over 3,000 (the ~600-word minimum);
- `has_card_image` and `has_hero_image` are both true;
- `sources` holds a JSON array of three `{title, url}` objects.

Finally, load the article on the live site:
`https://www.potuswatchdaily.com/article/<slug>`

Let the Worker run for **at least 3–4 consecutive hours** alongside Railway
before cutting over. During that window both services generate, so you will get
two articles per hour — expected, and the similarity check will suppress some of
them. Confirm each hour produced a Worker row and that `wrangler tail` shows no
Error 1102 and no unhandled failures.

---

## 6. Shut down Railway

Only after step 5 looks clean for several consecutive hours.

1. **Stop the service.** Railway dashboard -> your project -> the generator
   service -> Settings -> scroll to Danger -> **Remove Service**. To keep it as
   a rollback option instead, open the service's Settings and set the replica
   count to 0, or disconnect the GitHub repo so no further deploys land.
2. **Confirm it is actually stopped:** the old `/health` URL should stop
   responding, and no new Supabase rows should appear except at the top of each
   hour.
3. **Watch one more full hour** with only the Worker running, and confirm
   exactly one new row appears.
4. **Then, and only then, clean up the repo** if you want to. These files become
   dead once Railway is gone — this migration deliberately leaves them in place:
   - `localserver.js`
   - `railway.toml`
   - the `express`, `axios`, `ws` and `dotenv` dependencies in `package.json`,
     and the `"start": "node localserver.js"` script
5. Revoke and reissue the API keys that Railway held, if you want a clean break.
   The Worker's copies are independent, so rotating means setting the new values
   with `wrangler secret put` again.

---

## 7. What behaves differently from the Railway version

Read this before cutting over. Nothing here is a bug, but some of it is a real
change in behaviour.

### Changed by necessity

- **No immediate run at startup.** `localserver.js` called `generateArticles()`
  once inside `app.listen()`. A Worker has no startup event; the first article
  arrives at the next top-of-hour. Use the manual trigger in step 5 if you need
  one right away.

- **The exponential-backoff retry is gone.** On failure the Railway version
  scheduled a retry via `setTimeout` at 5, 10, 20, then 30 minutes, tracked in
  `consecutiveFailures`. A Worker invocation ends when its promise settles and
  keeps no memory between runs, so this could not be ported as-is. In its place
  the port retries the two calls that actually fail transiently, **within** the
  single invocation: NewsAPI up to 3 attempts (5 s, 10 s backoff — unchanged
  from the original) and Anthropic up to 3 attempts (3 s, 6 s backoff — new).
  Anthropic 4xx responses other than 429 fail fast rather than retrying, since
  they will not fix themselves. **Net effect: a run that fails for a reason
  lasting more than ~30 seconds now waits for the next hour instead of retrying
  at +5 min.** At worst you lose one article that hour.

  If you want the old behaviour back, add a second cron such as `"30 * * * *"`
  to `worker/wrangler.jsonc` — but note it fires unconditionally, so you would
  need KV to record whether the previous hour succeeded. Given the retries
  above, this is probably not worth the complexity.

- **`consecutiveFailures`, `totalGenerated`, `uptime_minutes` and
  `last_article_title` are no longer tracked in memory.** They cannot be — there
  is no persistent process. The Worker still serves `/health`, but it now
  derives freshness by querying Supabase for the newest article rather than from
  in-process counters, and reports `degraded` if the newest article is more than
  180 minutes old. Railway's `healthcheckPath` is no longer relevant.

- **`process.on('uncaughtException')` / `('unhandledRejection')` are gone.**
  Those are Node APIs. The Worker's equivalent is that every failure propagates
  out of `scheduled()`, which marks the invocation failed and logs it — visible
  in `wrangler tail` and in Workers Logs (observability is enabled in the
  config, so logs persist for later inspection rather than only streaming live).

- **`express.static('.')` is gone.** The Railway process was also serving the
  repo directory over HTTP. The Astro site on Pages is what serves the site;
  nothing depended on this.

### Preserved exactly

Verified byte-for-byte or line-by-line against `localserver.js`:

- The **Anthropic prompt text** — confirmed byte-identical (SHA-256 of the
  interpolated template matches), same model `claude-haiku-4-5-20251001`, same
  `max_tokens: 2500`, same 30 s timeout.
- **Round-robin region selection**, including the fallback to a random region
  when the lookup fails.
- The **`JUNK_DOMAINS` source filter** and the `>= 3` threshold that falls back
  to the unfiltered list.
- The **per-region keyword filter** and its `>= 3` fallback to the full pool.
- The **title-similarity check** — 48-hour window, words longer than 3
  characters, `overlap >= 4` triggers a skip, and a failed check returns `false`
  (does not block publishing).
- **Slug handling** — `slugify` rules, the 80-character truncation, the
  `parsed.slug.length > 3` preference over the title, year-stripping for
  `2024`–`2027`, and the `Date.now()` suffix on collision.
- The **Unsplash fetch**, both calls, the same per-region query lists, the same
  `&w=600&q=75&fit=crop` / `&w=1200&q=85&fit=crop` suffixes on the `raw` URL,
  and returning `''` on failure so a run still publishes without images.
- The **Supabase insert field set**, identical keys and identical value
  expressions, including the `date` / `time` `en-US` locale formatting and the
  `sources` JSON string built from the top 3 headlines.
- The **IndexNow ping**, same key, host and URL shape.

### Known quirk carried over

`localserver.js` probes for slug collisions using `slug` (years still present)
but inserts `cleanSlug` (years stripped). If a model ever emits a slug
containing a year, the probe checks a string that is not the one being written,
so the collision suffix may not be applied. **This is reproduced faithfully**
rather than silently fixed, because changing it would alter which slugs get a
`-<timestamp>` suffix and could affect existing URLs.

To fix it later, move the `cleanSlug` computation above the probe and query
`slug=eq.${cleanSlug}` instead. Do that as its own deliberate change, after the
migration is verified — not during it.

### Timezone note

Both Railway containers and Cloudflare Workers run with `TZ=UTC`, so
`toLocaleDateString('en-US', ...)` and `toLocaleTimeString('en-US', ...)`
produce the same strings for the `date` and `time` columns as before. Verify
this on the first row anyway (step 5) — if it ever drifts, pin it explicitly by
adding `timeZone: 'UTC'` to both option objects in `worker/generator.js`.

---

## Quick reference

```bash
# deploy
npx wrangler deploy --config worker/wrangler.jsonc

# watch logs live
npx wrangler tail potuswatch-generator --format pretty

# test the cron handler locally
npx wrangler dev --config worker/wrangler.jsonc --test-scheduled
curl "http://localhost:8787/cdn-cgi/handler/scheduled"

# list configured secrets (names only)
npx wrangler secret list --config worker/wrangler.jsonc

# health
curl https://potuswatch-generator.<your-subdomain>.workers.dev/health
```
