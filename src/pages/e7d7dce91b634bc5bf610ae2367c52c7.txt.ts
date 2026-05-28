import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  return new Response('e7d7dce91b634bc5bf610ae2367c52c7', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
};
