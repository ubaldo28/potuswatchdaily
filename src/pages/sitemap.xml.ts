import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.potuswatchdaily.com';
export const PAGE_SIZE = 2000;

// Sitemap INDEX. The previous single-file sitemap hard-capped at .limit(1000),
// so every article beyond the newest 1000 was absent from the only surface
// Google uses to discover them.
export const GET: APIRoute = async ({ locals }) => {
  const { env } = locals.runtime;

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    const { count } = await supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .not('slug', 'is', null);

    const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
    const now = new Date().toISOString();

    const entries = [
      `<sitemap><loc>${SITE_URL}/sitemap-pages.xml</loc><lastmod>${now}</lastmod></sitemap>`,
      `<sitemap><loc>${SITE_URL}/news-sitemap.xml</loc><lastmod>${now}</lastmod></sitemap>`,
      ...Array.from({ length: pages }, (_, i) =>
        `<sitemap><loc>${SITE_URL}/sitemap-articles-${i + 1}.xml</loc><lastmod>${now}</lastmod></sitemap>`),
    ];

    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</sitemapindex>`,
      { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=1800' } }
    );
  } catch (e: any) {
    return new Response('Sitemap error: ' + e.message, { status: 500 });
  }
};
