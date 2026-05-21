import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.potuswatchdaily.com';

function esc(s: string | null | undefined) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const GET: APIRoute = async ({ locals }) => {
  const { env } = locals.runtime;

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    const { data, error } = await supabase
      .from('articles')
      .select('slug,title,hero_image,image,date,published_at')
      .order('id', { ascending: false })
      .limit(1000);

    if (error) throw error;

    const articles = (data || []).filter(a => a.slug && a.slug.length > 3);

    const isoOf = (a: any) => {
      if (a.published_at) return new Date(a.published_at).toISOString();
      if (a.date) { const d = new Date(a.date); if (!isNaN(d.getTime()) && d.getFullYear() >= 2024) return d.toISOString(); }
      return new Date().toISOString();
    };

    const latestModified = articles[0] ? isoOf(articles[0]) : new Date().toISOString();

    const staticUrls = [
      `<url><loc>${SITE_URL}/</loc><lastmod>${latestModified}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
      `<url><loc>${SITE_URL}/archive</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`,
      `<url><loc>${SITE_URL}/about</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>`,
      `<url><loc>${SITE_URL}/editorial</loc><changefreq>monthly</changefreq><priority>0.4</priority></url>`,
      `<url><loc>${SITE_URL}/explainers/</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
      `<url><loc>${SITE_URL}/explainers/iran-nuclear-program</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
      `<url><loc>${SITE_URL}/explainers/nato-article-5</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
      `<url><loc>${SITE_URL}/explainers/us-china-relations</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
      `<url><loc>${SITE_URL}/newsletter</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>`,
      `<url><loc>${SITE_URL}/contact</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
      `<url><loc>${SITE_URL}/privacy</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
      `<url><loc>${SITE_URL}/terms</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
      `<url><loc>${SITE_URL}/disclaimer</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
    ];

    const articleUrls = articles.map(a => {
      const lastmod = isoOf(a);
      const img = a.hero_image || a.image;
      return `<url>
  <loc>${SITE_URL}/article/${esc(a.slug)}</loc>
  <lastmod>${lastmod}</lastmod>
  <changefreq>never</changefreq>
  <priority>0.8</priority>
  <news:news>
    <news:publication><news:name>POTUS Watch Daily</news:name><news:language>en</news:language></news:publication>
    <news:publication_date>${lastmod}</news:publication_date>
    <news:title>${esc(a.title)}</news:title>
  </news:news>${img ? `\n  <image:image><image:loc>${esc(img)}</image:loc><image:title>${esc(a.title)}</image:title></image:image>` : ''}
</url>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticUrls.concat(articleUrls).join('\n')}
</urlset>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=1800, max-age=600',
      },
    });
  } catch (e: any) {
    return new Response('Sitemap error: ' + e.message, { status: 500 });
  }
};
