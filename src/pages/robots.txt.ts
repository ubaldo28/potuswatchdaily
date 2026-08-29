import type { APIRoute } from 'astro';

// robots.txt groups are most-specific-wins and do NOT merge. A named group
// (Googlebot) that omits the Disallow lines from the `*` group leaves those
// paths fully crawlable for that bot, so every group repeats its own rules.
export const GET: APIRoute = () => {
  const content = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /get-articles
Disallow: /subscribe
Disallow: /_image

User-agent: Googlebot
Allow: /
Disallow: /api/
Disallow: /get-articles
Disallow: /subscribe
Disallow: /_image

User-agent: Googlebot-News
Allow: /
Allow: /article/
Disallow: /api/
Disallow: /get-articles
Disallow: /subscribe

User-agent: Bingbot
Allow: /
Disallow: /api/
Disallow: /get-articles
Disallow: /subscribe
Disallow: /_image

Sitemap: https://www.potuswatchdaily.com/sitemap.xml`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  });
};
