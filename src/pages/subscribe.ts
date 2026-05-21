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

export const OPTIONS: APIRoute = ({ request }) => {
  const origin = request.headers.get('Origin') || '';
  return new Response(null, { headers: corsHeaders(origin) });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const origin = request.headers.get('Origin') || '';
  const cors = corsHeaders(origin);
  const { env } = locals.runtime;

  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: 'Please enter a valid email address.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }
    const thuDate = nextThursdayStr();

    const audienceResp = await fetch(
      `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, unsubscribed: false }),
      }
    );
    if (!audienceResp.ok) {
      const err = await audienceResp.json().catch(() => ({})) as any;
      throw new Error(err.message || 'Subscription failed');
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL || 'POTUS Watch Daily <onboarding@resend.dev>',
        to: email,
        subject: `Welcome to POTUS Watch Daily — First issue arriving ${thuDate}`,
        html: buildWelcomeHtml(thuDate),
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }
};
