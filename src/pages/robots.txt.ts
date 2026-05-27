import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const content = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /get-articles
Disallow: /subscribe

# Google
User-agent: Googlebot
Allow: /
Crawl-delay: 1

# Google News
User-agent: Googlebot-News
Allow: /
Allow: /article/

# Bing
User-agent: Bingbot
Allow: /
Crawl-delay: 2

Sitemap: https://www.potuswatchdaily.com/sitemap.xml`;

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
};
