import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const GET: APIRoute = async ({ request }) => {
  // env comes from the Workers runtime module (Astro.locals.runtime was removed in adapter v14)
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
    // Diagnostics go to Workers Logs, which observability already surfaces.
    // They used to go in the RESPONSE: the raw PostgREST message (which names
    // tables, columns and RLS policies), the Supabase host, the key length and
    // — worst of the four — the key KIND, which told an anonymous caller
    // whether the live Worker was running a publishable key, a secret key or a
    // legacy JWT. That is precisely the question worth asking before deciding
    // whether a misconfiguration is worth chasing.
    const key = env.SUPABASE_KEY || '';
    let host = '(unset)';
    try { host = new URL(env.SUPABASE_URL).host; } catch { host = env.SUPABASE_URL ? '(unparseable)' : '(unset)'; }
    console.error('[get-articles]', e?.message, JSON.stringify({
      supabase_host: host,
      key_length: key.length,
      key_kind: key.startsWith('sb_publishable_') ? 'publishable'
              : key.startsWith('sb_secret_')      ? 'secret'
              : key.split('.').length === 3       ? 'legacy JWT'
              : key                                ? 'unrecognised'
                                                   : '(unset)',
    }));

    return new Response(JSON.stringify({ error: 'Unable to load articles' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
};
