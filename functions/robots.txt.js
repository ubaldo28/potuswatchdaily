export async function onRequest() {
  return new Response(
    'User-agent: *\nAllow: /\n\nSitemap: https://www.potuswatchdaily.com/sitemap.xml',
    { headers: { 'Content-Type': 'text/plain' } }
  );
}
