import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';

function buildWelcomeHtml(thuDate: string) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome to POTUS Watch Daily</title>
<style type="text/css">body{margin:0!important;padding:0!important;background-color:#0a0a0a!important}</style>
</head>
<body id="body" bgcolor="#0a0a0a" style="margin:0;padding:0;background-color:#0a0a0a">
<table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#0a0a0a" style="background-color:#0a0a0a;min-width:100%">
<tr><td align="center" bgcolor="#0a0a0a" style="padding:40px 20px">
<table width="600" border="0" cellpadding="0" cellspacing="0" bgcolor="#0a0a0a" style="max-width:600px;width:100%;background-color:#0a0a0a">
  <tr><td bgcolor="#cc0000" height="4" style="background-color:#cc0000;height:4px;font-size:0;line-height:0">&nbsp;</td></tr>
  <tr><td bgcolor="#111111" style="background-color:#111111;padding:28px 36px 24px;border-bottom:1px solid #1e1e1e">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:900;color:#ffffff">POTUS <span style="color:#cc0000">Watch</span> Daily</div>
    <div style="font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#555555;margin-top:4px;font-family:Arial,Helvetica,sans-serif">Foreign Policy Coverage</div>
  </td></tr>
  <tr><td bgcolor="#111111" style="background-color:#111111;padding:36px 36px 28px">
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#777777;margin-bottom:14px;font-family:Arial,Helvetica,sans-serif">Welcome</div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:900;color:#ffffff;line-height:1.2;margin:0 0 18px">You're in. First issue arrives ${thuDate}.</div>
    <p style="font-size:15px;color:#999999;line-height:1.8;margin:0 0 14px;font-family:Arial,Helvetica,sans-serif">Every Thursday you'll get a short briefing on what happened in U.S. foreign policy and global affairs that week — what it means, and what to watch going forward.</p>
    <p style="font-size:15px;color:#999999;line-height:1.8;margin:0 0 28px;font-family:Arial,Helvetica,sans-serif">In the meantime, here's what's on the site right now.</p>
    <table border="0" cellpadding="0" cellspacing="0"><tr><td bgcolor="#cc0000" style="background-color:#cc0000;border-radius:3px">
      <a href="https://www.potuswatchdaily.com" style="display:inline-block;background-color:#cc0000;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:3px;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif">Read the latest &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td bgcolor="#0d0d0d" style="background-color:#0d0d0d;padding:22px 36px;border-top:1px solid #1a1a1a;text-align:center">
    <div style="font-size:11px;color:#444444;margin-bottom:7px;font-family:Arial,Helvetica,sans-serif">
      <a href="https://www.potuswatchdaily.com" style="color:#555555;text-decoration:none">potuswatchdaily.com</a> &nbsp;&middot;&nbsp;
      <a href="https://www.potuswatchdaily.com/about" style="color:#555555;text-decoration:none">About</a> &nbsp;&middot;&nbsp;
      <a href="https://www.potuswatchdaily.com/privacy" style="color:#555555;text-decoration:none">Privacy</a>
    </div>
    <div style="font-size:10px;color:#333333;font-family:Arial,Helvetica,sans-serif">&copy; 2026 POTUS Watch Daily. Independent foreign policy coverage.</div>
    <div style="font-size:10px;color:#333333;margin-top:5px;font-family:Arial,Helvetica,sans-serif">You subscribed at potuswatchdaily.com. <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#444444;text-decoration:underline">Unsubscribe</a></div>
  </td></tr>
  <tr><td bgcolor="#cc0000" height="2" style="background-color:#cc0000;height:2px;font-size:0;line-height:0">&nbsp;</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const ALLOWED_ORIGINS = [
  'https://www.potuswatchdaily.com',
  'https://potuswatchdaily.com',
];

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

// CORS is a browser-side courtesy: it does not stop a script POSTing directly.
// This endpoint spends money (Resend quota) and sends mail to whatever address
// it is handed, so it needs a server-side check too. A same-origin browser POST
// always carries one of these; curl carries neither.
function isFromOurSite(request: Request) {
  const origin = request.headers.get('Origin');
  if (origin) return ALLOWED_ORIGINS.includes(origin);
  const referer = request.headers.get('Referer');
  if (referer) return ALLOWED_ORIGINS.some(o => referer.startsWith(o + '/') || referer === o);
  return false;
}

// Best-effort throttle. There is no KV binding on this Worker, so the counter
// lives in the datacenter-local edge cache: an attacker spread across PoPs gets
// one bucket per PoP rather than one globally. That is a real limit, not a
// perfect one -- it exists to stop the cheap case (a loop from one host mailing
// the same victim repeatedly), and the address-already-subscribed check below
// is what actually caps mail per address.
const RATE_WINDOW_SECONDS = 60;
const RATE_MAX_PER_WINDOW = 3;

async function overRateLimit(request: Request): Promise<boolean> {
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (!ip) return false;
  const key = new Request(`https://rate-limit.internal/subscribe/${encodeURIComponent(ip)}`);
  try {
    const cache = (caches as any).default;
    const hit = await cache.match(key);
    const count = hit ? Number(await hit.text()) || 0 : 0;
    if (count >= RATE_MAX_PER_WINDOW) return true;
    await cache.put(key, new Response(String(count + 1), {
      headers: { 'Cache-Control': `max-age=${RATE_WINDOW_SECONDS}` }
    }));
    return false;
  } catch {
    return false;   // never fail a real signup because the cache misbehaved
  }
}

function isValidEmail(email: string) {
  return typeof email === 'string' &&
    email.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function nextThursdayStr() {
  const now = new Date();
  const daysLeft = (4 - now.getDay() + 7) % 7 || 7;
  const thu = new Date(now);
  thu.setDate(now.getDate() + daysLeft);
  return thu.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export const GET: APIRoute = () => {
  return new Response(null, {
    status: 301,
    headers: { Location: '/newsletter' }
  });
};

export const OPTIONS: APIRoute = ({ request }) => {
  const origin = request.headers.get('Origin') || '';
  return new Response(null, { headers: corsHeaders(origin) });
};

const MAX_BODY_BYTES = 1024;

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get('Origin') || '';
  const cors = corsHeaders(origin);
  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json', ...cors },
    });

  if (!isFromOurSite(request)) return json({ error: 'Not allowed.' }, 403);

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) return json({ error: 'Request too large.' }, 413);

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: 'Request too large.' }, 413);

    let body: any;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Please enter a valid email address.' }, 400); }

    const email = String(body?.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return json({ error: 'Please enter a valid email address.' }, 400);
    }

    if (await overRateLimit(request)) {
      return json({ error: 'Too many requests. Please try again in a minute.' }, 429);
    }

    const auth = {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    };
    const audience = `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`;

    // Resend upserts on POST, so without this check anyone could re-post a
    // stranger's address in a loop and this endpoint would mail them each time.
    // Already subscribed is reported as success and sends nothing: it is the
    // truth from the visitor's side, and it does not disclose who is on the list.
    const existing = await fetch(`${audience}/${encodeURIComponent(email)}`, { headers: auth });
    if (existing.ok) return json({ success: true });

    const thuDate = nextThursdayStr();

    const audienceResp = await fetch(audience, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ email, unsubscribed: false }),
    });
    if (!audienceResp.ok) {
      const detail = await audienceResp.text().catch(() => '');
      console.error(`[subscribe] Resend contact create failed (${audienceResp.status}): ${detail.slice(0, 300)}`);
      return json({ error: 'Subscription failed. Please try again.' }, 502);
    }

    const mailResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL || 'POTUS Watch Daily <onboarding@resend.dev>',
        to: email,
        subject: `Welcome to POTUS Watch Daily — First issue arriving ${thuDate}`,
        html: buildWelcomeHtml(thuDate),
      }),
    });
    // The subscription is the thing that matters; a failed welcome email is
    // logged but not surfaced, since the address is already on the list.
    if (!mailResp.ok) {
      const detail = await mailResp.text().catch(() => '');
      console.error(`[subscribe] Welcome email failed (${mailResp.status}): ${detail.slice(0, 300)}`);
    }

    return json({ success: true });
  } catch (e: any) {
    // Never echo the upstream error to the client: it is written by Resend, not
    // by us, and has no business being rendered in someone's browser.
    console.error('[subscribe] Unhandled failure:', e?.message || e);
    return json({ error: 'Subscription failed. Please try again.' }, 500);
  }
};
