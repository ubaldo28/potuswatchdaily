import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.potuswatchdaily.com';
const PAGE_SIZE = 2000;

function esc(s: string | null | undefined) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const GET: APIRoute = async ({ params, locals }) => {
  const { env } = locals.runtime;
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const from = (page - 1) * PAGE_SIZE;

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    const { data } = await supabase
      .from('articles')
      .select('slug,title,hero_image,image,date,published_at,updated_at')
      .not('slug', 'is', null)
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    // lastmod is the only crawl-scheduling hint the major engines still act on,
    // so prefer updated_at — otherwise a corrected article never gets recrawled.
    const isoOf = (a: any) => {
      if (a.updated_at) return new Date(a.updated_at).toISOString();
      if (a.published_at) return new Date(a.published_at).toISOString();
      if (a.date) { const d = new Date(a.date); if (!isNaN(d.getTime()) && d.getFullYear() >= 2024) return d.toISOString(); }
      return new Date().toISOString();
    };

    const urls = (data || []).filter(a => a.slug && a.slug.length > 3).map(a => {
      const img = a.hero_image || a.image;
      return `<url><loc>${SITE_URL}/article/${esc(a.slug)}</loc><lastmod>${isoOf(a)}</lastmod>`
        + (img ? `<image:image><image:loc>${esc(img)}</image:loc><image:title>${esc(a.title)}</image:title></image:image>` : '')
        + `</url>`;
    });

    if (!urls.length) return new Response('Not found', { status: 404 });

    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>`,
      { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=1800' } }
    );
  } catch (e: any) {
    return new Response('Sitemap error: ' + e.message, { status: 500 });
  }
};
