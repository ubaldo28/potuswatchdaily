import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.potuswatchdaily.com';

function esc(s: string | null | undefined) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Google News sitemaps must contain ONLY articles from the last 2 days.
// The old sitemap put <news:news> on all 1000 entries, the oldest ~50 days
// old, which invalidates the file as a News discovery channel.
export const GET: APIRoute = async ({ locals }) => {
  // env comes from the Workers runtime module (Astro.locals.runtime was removed in adapter v14)
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    const { data } = await supabase
      .from('articles')
      .select('slug,title,published_at')
      .not('slug', 'is', null)
      .gte('published_at', cutoff)
      .order('published_at', { ascending: false })
      .limit(1000);

    const urls = (data || []).map(a => `<url>
  <loc>${SITE_URL}/article/${esc(a.slug)}</loc>
  <news:news>
    <news:publication><news:name>POTUS Watch Daily</news:name><news:language>en</news:language></news:publication>
    <news:publication_date>${new Date(a.published_at).toISOString()}</news:publication_date>
    <news:title>${esc(a.title)}</news:title>
  </news:news>
</url>`);

    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${urls.join('\n')}\n</urlset>`,
      { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=300' } }
    );
  } catch (e: any) {
    return new Response('Sitemap error: ' + e.message, { status: 500 });
  }
};
