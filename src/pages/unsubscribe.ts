import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';

/**
 * One-click unsubscribe.
 *
 * The welcome email previously carried Resend's Broadcasts merge tag, which a
 * transactional send never substitutes — so the only opt-out affordance every
 * subscriber received was a link to the literal string
 * `{{{RESEND_UNSUBSCRIBE_URL}}}`. That is a CAN-SPAM problem, a GDPR Art. 7(3)
 * problem, and it trains recipients to use "report spam" as the only exit that
 * works, which costs deliverability for everyone else on the list.
 *
 * The signature is an HMAC over the address, so a link cannot be edited to
 * unsubscribe someone else, and no database lookup is needed to verify it.
 *
 * GET renders a confirmation page. POST is what Gmail and Yahoo call for
 * List-Unsubscribe-Post: it must act without any further interaction.
 */
async function signEmail(email: string): Promise<string> {
  const secret = env.SUBSCRIBE_SECRET;
  if (!secret) return '';
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(email.toLowerCase()));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Constant time, so the signature cannot be recovered a byte at a time. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const page = (heading: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${heading} — POTUS Watch Daily</title>
<style>
  body{background:#0a0a0a;color:#e8e8e8;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
  main{max-width:34rem;text-align:center}
  h1{font-size:22px;margin:0 0 12px;color:#fff}
  p{color:#b3b3b3;margin:0 0 24px}
  a{color:#ff5c5c;text-decoration:underline;text-underline-offset:2px}
</style></head><body><main><h1>${heading}</h1><p>${body}</p>
<p><a href="/">Back to POTUS Watch Daily</a></p></main></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );

async function unsubscribe(email: string, sig: string) {
  if (!email || !sig) return { ok: false, status: 400 };
  const expected = await signEmail(email);
  if (!expected || !safeEqual(sig, expected)) return { ok: false, status: 403 };

  const res = await fetch(
    `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts/${encodeURIComponent(email.toLowerCase())}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ unsubscribed: true }),
    }
  );
  // A contact that is already gone is a success from the reader's side.
  if (!res.ok && res.status !== 404) {
    console.error(`[unsubscribe] Resend returned ${res.status}`);
    return { ok: false, status: 502 };
  }
  return { ok: true, status: 200 };
}

export const GET: APIRoute = async ({ url }) => {
  const r = await unsubscribe(url.searchParams.get('e') || '', url.searchParams.get('s') || '');
  if (r.ok) return page('You are unsubscribed', 'You will not receive any further emails from us. No hard feelings.');
  if (r.status === 403 || r.status === 400) {
    return page('That link is not valid', 'It may have been altered in transit. Reply to any issue and we will remove you by hand.', 404);
  }
  return page('Something went wrong', 'We could not complete that just now. Please try the link again shortly.', 502);
};

// Required by RFC 8058 for one-click unsubscribe: mail clients POST here and
// expect the address to be removed with no further interaction.
export const POST: APIRoute = async ({ url, request }) => {
  let email = url.searchParams.get('e') || '';
  let sig = url.searchParams.get('s') || '';
  if (!email) {
    try {
      const form = new URLSearchParams(await request.text());
      email = form.get('e') || email;
      sig = form.get('s') || sig;
    } catch { /* query string is the normal path */ }
  }
  const r = await unsubscribe(email, sig);
  return new Response(null, { status: r.ok ? 200 : r.status });
};
