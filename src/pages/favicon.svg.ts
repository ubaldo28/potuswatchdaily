import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="5" fill="#C23B22"/>
  <path fill="#fff" d="M16 5.5l3.1 6.4 7 .9-5.1 4.9 1.3 6.9L16 21.2l-6.3 3.4 1.3-6.9-5.1-4.9 7-.9z"/>
</svg>`;

  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=604800' }
  });
};
