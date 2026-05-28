import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#0a0a0a"/>
  <circle cx="16" cy="16" r="11" fill="none" stroke="#cc0000" stroke-width="2"/>
  <line x1="16" y1="5" x2="16" y2="11" stroke="#cc0000" stroke-width="2" stroke-linecap="round"/>
  <line x1="16" y1="21" x2="16" y2="27" stroke="#cc0000" stroke-width="2" stroke-linecap="round"/>
  <line x1="5" y1="16" x2="11" y2="16" stroke="#cc0000" stroke-width="2" stroke-linecap="round"/>
  <line x1="21" y1="16" x2="27" y2="16" stroke="#cc0000" stroke-width="2" stroke-linecap="round"/>
  <circle cx="16" cy="16" r="2.5" fill="#cc0000"/>
</svg>`;

  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=604800' }
  });
};
