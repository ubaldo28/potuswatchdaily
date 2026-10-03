import type { APIRoute } from 'astro';
import { recentOrderDocs } from '../lib/actions';

const SITE_URL = 'https://www.potuswatchdaily.com';

// One URL per recent executive order, proclamation and memorandum. Each page
// carries the full official text, so these are real pages and not stubs.
export const GET: APIRoute = async () => {
  const docs = await recentOrderDocs(150);
  const urls = docs.map(d => `<url><loc>${SITE_URL}/order/${d.doc}</loc><lastmod>${d.date}</lastmod></url>`);
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=900, s-maxage=3600' } }
  );
};
