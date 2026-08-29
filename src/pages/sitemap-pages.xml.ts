import type { APIRoute } from 'astro';

const SITE_URL = 'https://www.potuswatchdaily.com';

const REGIONS = ['americas','china','nato','iran','mideast','russia','trade','analysis'];

const PATHS = [
  '/', '/archive', '/about', '/editorial', '/explainers/',
  '/explainers/iran-nuclear-program', '/explainers/nato-article-5',
  '/explainers/us-china-relations', '/newsletter', '/contact',
  '/privacy', '/terms', '/disclaimer',
  ...REGIONS.map(r => `/region/${r}`),
];

export const GET: APIRoute = () => {
  const now = new Date().toISOString();
  const urls = PATHS.map(p => `<url><loc>${SITE_URL}${p}</loc><lastmod>${now}</lastmod></url>`);

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } }
  );
};
