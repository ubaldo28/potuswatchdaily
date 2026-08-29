import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const GET: APIRoute = async ({ request, locals }) => {
  const { env } = locals.runtime;
  const url = new URL(request.url);
  // Clamp: an unvalidated parseInt lets ?offset=abc reach .range() as NaN,
  // and negatives or huge values go straight through to PostgREST.
  const rawOffset = parseInt(url.searchParams.get('offset') || '0', 10);
  const offset = Math.max(0, Math.min(Number.isFinite(rawOffset) ? rawOffset : 0, 10000));

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    const { data, error } = await supabase
      .from('articles')
      .select('id,title,slug,excerpt,region,date,time,image')
      .order('id', { ascending: false })
      .range(offset, offset + 23);

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (e: any) {
    // Never return the raw PostgREST body to an unauthenticated caller.
    console.error('[get-articles]', e?.message);
    return new Response(JSON.stringify({ error: 'Unable to load articles' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
