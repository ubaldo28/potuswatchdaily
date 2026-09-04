import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const GET: APIRoute = async ({ request, locals }) => {
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
    // Never return the raw PostgREST body to an unauthenticated caller.
    console.error('[get-articles]', e?.message);

    // When the page is empty, the one question worth answering is whether this
    // Worker was handed a usable database URL and key at all -- and that took
    // an hour to answer last time, because the only honest reply the site could
    // give was "Unable to load articles". So a failure now also reports the
    // shape of what it was configured with. No secret is exposed: the host of a
    // public REST endpoint, the length of the key, and the prefix of a key that
    // is only ever the publishable one, which Supabase ships in browser code.
    const key = env.SUPABASE_KEY || '';
    let host = '(unset)';
    try { host = new URL(env.SUPABASE_URL).host; } catch { host = env.SUPABASE_URL ? '(unparseable)' : '(unset)'; }

    return new Response(JSON.stringify({
      error: 'Unable to load articles',
      reason: e?.message || String(e),
      config: {
        supabase_host: host,
        key_length: key.length,
        key_kind: key.startsWith('sb_publishable_') ? 'publishable'
                : key.startsWith('sb_secret_')      ? 'secret'
                : key.split('.').length === 3       ? 'legacy JWT'
                : key                                ? 'unrecognised'
                                                     : '(unset)',
      },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
