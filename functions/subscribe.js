const WELCOME_HTML = `<!DOCTYPE html>
<html lang="en" style="background:#0a0a0a!important">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark only">
<meta name="supported-color-schemes" content="dark">
<title>Welcome to POTUS Watch Daily</title>
<style>
:root { color-scheme: dark only; }
html, body, table, td, div, p, h1, h2, h3 { color-scheme: dark only; }
body { margin:0!important; padding:0!important; background-color:#0a0a0a!important; }
table { background-color:#0a0a0a!important; }
.bg-dark { background-color:#111111!important; }
.bg-darker { background-color:#0d0d0d!important; }
.bg-outer { background-color:#0a0a0a!important; }
div[style*="background"], td[style*="background"] { background-color: inherit!important; }
u + .body .bg-dark { background-color:#111111!important; }
#MessageViewBody .bg-dark { background-color:#111111!important; }
</style>
</head>
<body class="body" style="margin:0!important;padding:0!important;background-color:#0a0a0a!important;-webkit-text-size-adjust:100%;mso-line-height-rule:exactly">
<div style="background-color:#0a0a0a!important;padding:40px 20px">
<table class="bg-outer" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a!important;border-collapse:collapse">
  <tr><td align="center" style="background-color:#0a0a0a!important;padding:0">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#0a0a0a!important;border-collapse:collapse">
      <tr><td style="background-color:#c0392b!important;height:4px;font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td class="bg-dark" style="background-color:#111111!important;padding:32px 40px;border-bottom:1px solid #1e1e1e">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:900;color:#ffffff!important;letter-spacing:-0.5px">POTUS <span style="color:#c0392b!important">Watch</span> Daily</div>
        <div style="font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#666666!important;margin-top:4px">Foreign Policy Coverage</div>
      </td></tr>
      <tr><td class="bg-dark" style="background-color:#111111!important;padding:40px 40px 32px">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#888888!important;margin-bottom:16px">Welcome</div>
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:900;color:#ffffff!important;line-height:1.2;margin:0 0 20px">Good to have you.</h1>
        <p style="font-size:15px;color:#aaaaaa!important;line-height:1.8;margin:0 0 16px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">Every Thursday you'll get a short briefing on what happened in U.S. foreign policy and global affairs that week — what it means, and what to watch going forward.</p>
        <p style="font-size:15px;color:#aaaaaa!important;line-height:1.8;margin:0 0 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">Your first issue is coming this Thursday. In the meantime, here's what's on the site right now.</p>
        <a href="https://www.potuswatchdaily.com" style="display:inline-block;background-color:#c0392b!important;color:#ffffff!important;text-decoration:none;padding:14px 28px;border-radius:3px;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">Read the latest &#8594;</a>
      </td></tr>
      <tr><td style="background-color:#111111!important;padding:0 40px"><div style="border-top:1px solid #1e1e1e;font-size:0;line-height:0">&nbsp;</div></td></tr>
      <tr><td class="bg-dark" style="background-color:#111111!important;padding:32px 40px">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#666666!important;margin-bottom:20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">What to expect</div>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
          <tr>
            <td style="background-color:#111111!important;padding-bottom:16px;padding-right:12px;vertical-align:top;width:50%">
              <div style="border-left:2px solid #c0392b;padding-left:14px">
                <div style="font-size:13px;font-weight:600;color:#ffffff!important;margin-bottom:4px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">Sent every Thursday</div>
                <div style="font-size:12px;color:#666666!important;line-height:1.6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">One short email covering the week's most important foreign policy stories.</div>
              </div>
            </td>
            <td style="background-color:#111111!important;padding-bottom:16px;padding-left:12px;vertical-align:top;width:50%">
              <div style="border-left:2px solid #c0392b;padding-left:14px">
                <div style="font-size:13px;font-weight:600;color:#ffffff!important;margin-bottom:4px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">Real analysis</div>
                <div style="font-size:12px;color:#666666!important;line-height:1.6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">What happened, the context behind it, and what it likely means going forward.</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#111111!important;padding-right:12px;vertical-align:top;width:50%">
              <div style="border-left:2px solid #c0392b;padding-left:14px">
                <div style="font-size:13px;font-weight:600;color:#ffffff!important;margin-bottom:4px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">Short and readable</div>
                <div style="font-size:12px;color:#666666!important;line-height:1.6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">Written to be read in under ten minutes. No padding.</div>
              </div>
            </td>
            <td style="background-color:#111111!important;padding-left:12px;vertical-align:top;width:50%">
              <div style="border-left:2px solid #c0392b;padding-left:14px">
                <div style="font-size:13px;font-weight:600;color:#ffffff!important;margin-bottom:4px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">Free</div>
                <div style="font-size:12px;color:#666666!important;line-height:1.6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">No subscription tiers, no credit card, nothing to upgrade.</div>
              </div>
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td class="bg-darker" style="background-color:#0d0d0d!important;padding:24px 40px;border-top:1px solid #1a1a1a;text-align:center">
        <div style="font-size:11px;color:#555555!important;margin-bottom:8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
          <a href="https://www.potuswatchdaily.com" style="color:#555555!important;text-decoration:none">potuswatchdaily.com</a> &nbsp;&#183;&nbsp;
          <a href="https://www.potuswatchdaily.com/about.html" style="color:#555555!important;text-decoration:none">About</a> &nbsp;&#183;&nbsp;
          <a href="https://www.potuswatchdaily.com/privacy.html" style="color:#555555!important;text-decoration:none">Privacy</a>
        </div>
        <div style="font-size:10px;color:#333333!important;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">&#169; 2026 POTUS Watch Daily. Independent foreign policy coverage.</div>
        <div style="font-size:10px;color:#333333!important;margin-top:6px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">You're receiving this because you subscribed at potuswatchdaily.com. <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#444444!important;text-decoration:underline">Unsubscribe</a></div>
      </td></tr>
      <tr><td style="background-color:#c0392b!important;height:2px;font-size:0;line-height:0">&nbsp;</td></tr>
    </table>
  </td></tr>
</table>
</div>
</body>
</html>`;

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { email } = await request.json();
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const audienceResp = await fetch(`https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, unsubscribed: false })
    });

    if (!audienceResp.ok) {
      const err = await audienceResp.json().catch(() => ({}));
      throw new Error(err.message || 'Subscription failed');
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL || 'POTUS Watch Daily <onboarding@resend.dev>',
        to: email,
        subject: 'Welcome to POTUS Watch Daily — First issue coming Thursday',
        html: WELCOME_HTML
      })
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
