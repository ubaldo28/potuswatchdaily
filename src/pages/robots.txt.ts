import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  return new Response(
    'User-agent: *\nAllow: /\n\nSitemap: https://www.potuswatchdaily.com/sitemap.xml',
    { headers: { 'Content-Type': 'text/plain' } }
  );
};
