# SEO Plan: how POTUS Watch Daily wins on Google (free only)

Goal: be the top result for the questions people ask about what the President signs, especially tariffs, trade and sanctions.

**Reality check.** Ranking number 1 for the word "news" is not possible against the New York Times, CNN and Reuters. Ranking number 1 for narrow, specific searches is possible and is how small sites win:
"[executive order name] explained", "what did the tariff proclamation change", "Section 232 tariffs list by country", "Iran sanctions timeline". Each of those wins separately, and the wins add up to site authority. Expect months, not weeks.

## 1. Technical base (mostly done, keep it clean)
- Done: sitemap.xml, news-sitemap.xml (last 48 h), feed.xml, IndexNow ping on publish, canonical URLs, noindex on thin notices, 410 for removed pages, fast Astro SSR on Cloudflare, Cloudflare analytics.
- To check each month: Search Console "Pages" report (indexed vs not, and why), "Core Web Vitals", structured data errors.
- To add: NewsArticle JSON-LD with author/publisher/dateModified on every article (verify it is present); BreadcrumbList on topic pages; one www/non-www canonical (www is canonical).

## 2. Win the niche: primary document first, plain English second
- Speed is the edge. The White House and Federal Register publish; most outlets explain hours later. The generator already runs 5 times a day; keep source polling frequent and publish within hours.
- Every article must answer the search query in the first 100 words (what it is, who it hits, when it starts), then Key Facts, then What to Watch. Quote the primary document and link it.
- Titles: lead with the document name or the number people search ("Executive Order 14xxx", "Proclamation", country + product + tariff rate). Keep under 60 characters.

## 3. Topical authority (this is what lifts every page)
- Tracker: give every executive order, proclamation and memorandum its own page (number, date, what it does, status, link to the explainer). These pages match exact-number searches.
- Evergreen explainers that get updated, not republished: "Current US tariffs by country", "Sanctions on Iran: timeline", "Export controls on chips: what is banned", "How executive orders work". Show a real "Updated" date and actually change them when facts change.
- Internal links: every article links to its topic hub, the tracker entry, and 2 related articles. Hubs link to the best pieces.

## 4. Trust (E-E-A-T), honest version
- Keep the About and Editorial pages explaining automated drafting plus the source fact-check. Do not invent a person. A named human with a real bio would help; only if Ubi chooses to.
- Add a Corrections page and a visible way to report errors (briefing@potuswatchdaily.com).
- Every article shows its sources. Never publish unsupported claims (the fact-check pass drops them).

## 5. Google surfaces beyond blue links
- Google News Publisher Center: apply once there are 3+ weeks of steady, clean publishing (target late October).
- Top Stories eligibility: news-sitemap fresh, clear dates, no paywall, consistent publishing.
- Discover: strong photo (vetted) at 1200px wide, large-image meta robots tag (check it is set).

## 6. Free links and distribution
- Weekly Sunday email (growth loop; the form on every page).
- Post each Weekly Review and tracker updates on X, Reddit (r/politics is strict; use topic subs such as r/economy, r/geopolitics where self-posts of original analysis are allowed, follow each sub's rules), LinkedIn.
- Answer journalist requests (Qwoted, Featured, Help a B2B Writer) with the tracker as a source; a link from a news or university site is worth more than hundreds of directory links.
- Pitch the tracker to bloggers and newsletters covering trade and policy as a free reference.

## 7. Measure and iterate (weekly, 15 minutes)
- Search Console > Performance: top queries, pages with impressions but CTR under 2% (rewrite title/description), queries at positions 8 to 20 (expand or update that page).
- Track: indexed pages, impressions, clicks, average position, newsletter signups.
- Rule: never add pages just for volume. Thin or duplicate output is what got AdSense to reject the old site.

## Status 2026-10-03
Done: NewsArticle JSON-LD and max-image-preview verified; per-order pages with official text (`/order/<doc>`, own sitemap, IndexNow pinged); primary-document lists on policy hubs; Corrections page; trailing-slash redirects removed so URLs match canonicals; sitemap.xml and news-sitemap.xml read by Google.

## Next actions
1. (done) sitemaps submitted, show Success.
2. (done) JSON-LD and robots verified.
3. (done) per-order pages.
4. Add evergreen "Current US tariffs by country" and "Sanctions timeline" pages.
5. (done) Corrections page.
6. Late October: Google News Publisher Center. Early to mid November: AdSense reapply.
