import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const content = [
    // Google AdSense
    'google.com, pub-7380718671497895, DIRECT, f08c47fec0942fa0',
    // Adsterra
    'adsterra.com, 3301202, DIRECT',
    'effectivercpmnetwork.com, 3301202, DIRECT',
    // Amazon
    'amazon.com, 3159, DIRECT',
  ].join('\n');

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
};
