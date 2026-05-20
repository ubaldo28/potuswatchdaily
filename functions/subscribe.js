const WELCOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to POTUS Watch Daily</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;padding:40px 20px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">
      <!-- Red bar -->
      <tr><td style="background:#cc0000;height:3px;font-size:0">&nbsp;</td></tr>
      <!-- Header -->
      <tr><td style="background:#111;padding:32px 40px;border-bottom:1px solid #1e1e1e">
        <div style="font-family:Georgia,serif;font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.5px">POTUS <span style="color:#cc0000">Watch</span> Daily</div>
        <div style="font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#444;margin-top:4px">Foreign Policy Intelligence</div>
      </td></tr>
      <!-- Welcome -->
      <tr><td style="background:#111;padding:40px 40px 32px">
        <div style="font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#555;margin-bottom:16px">Welcome</div>
        <h1 style="font-family:Georgia,serif;font-size:30px;font-weight:900;color:#fff;line-height:1.2;margin:0 0 20px">Good to have you.</h1>
        <p style="font-size:15px;color:#888;line-height:1.8;margin:0 0 24px">Every Sunday you'll get a short briefing on what happened in U.S. foreign policy and global affairs that week — what it means, and what to watch going forward.</p>
        <p style="font-size:15px;color:#888;line-height:1.8;margin:0 0 32px">Your first issue is coming this Thursday. In the meantime, here's what's on the site right now.</p>
        <a href="https://www.potuswatchdaily.com" style="display:inline-block;background:#cc0000;color:#fff;text-decoration:none;padding:14px 28px;border-radius:3px;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">Read the latest →</a>
      </td></tr>
      <!-- Divider -->
      <tr><td style="padding:0 40px"><div style="border-top:1px solid #1e1e1e"></div></td></tr>
      <!-- What to expect -->
      <tr><td style="background:#111;padding:32px 40px">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#444;margin-bottom:20px">What to expect</div>
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding-bottom:16px;padding-right:12px;vertical-align:top;width:50%">
              <div style="border-left:2px solid #cc0000;padding-left:14px">
                <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:4px">Sent every Sunday</div>
                <div style="font-size:12px;color:#555;line-height:1.6">One short email every Thursday covering the week's most important foreign policy stories.</div>
              </div>
            </td>
            <td style="padding-bottom:16px;padding-left:12px;vertical-align:top;width:50%">
              <div style="border-left:2px solid #cc0000;padding-left:14px">
                <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:4px">Real analysis</div>
                <div style="font-size:12px;color:#555;line-height:1.6">What happened, the context behind it, and what it likely means going forward.</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-right:12px;vertical-align:top;width:50%">
              <div style="border-left:2px solid #cc0000;padding-left:14px">
                <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:4px">Short and readable</div>
                <div style="font-size:12px;color:#555;line-height:1.6">Written to be read in under ten minutes. No padding.</div>
              </div>
            </td>
            <td style="padding-left:12px;vertical-align:top;width:50%">
              <div style="border-left:2px solid #cc0000;padding-left:14px">
                <div style="font-size:13px;font-weight:600;color:#fff;margin-bottom:4px">Free</div>
                <div style="font-size:12px;color:#555;line-height:1.6">No subscription tiers, no credit card, nothing to upgrade.</div>
              </div>
            </td>
          </tr>
        </table>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:#0d0d0d;padding:24px 40px;border-top:1px solid #1a1a1a;text-align:center">
        <div style="font-size:11px;color:#333;margin-bottom:8px">
          <a href="https://www.potuswatchdaily.com" style="color:#444;text-decoration:none">potuswatchdaily.com</a> &nbsp;·&nbsp;
          <a href="https://www.potuswatchdaily.com/about.html" style="color:#444;text-decoration:none">About</a> &nbsp;·&nbsp;
          <a href="https://www.potuswatchdaily.com/privacy.html" style="color:#444;text-decoration:none">Privacy</a>
        </div>
        <div style="font-size:10px;color:#2a2a2a">© 2026 POTUS Watch Daily. Independent foreign policy intelligence.</div>
        <div style="font-size:10px;color:#2a2a2a;margin-top:6px">You're receiving this because you subscribed at potuswatchdaily.com. <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#333;text-decoration:underline">Unsubscribe</a></div>
      </td></tr>
      <!-- Bottom bar -->
      <tr><td style="background:#cc0000;height:2px;font-size:0">&nbsp;</td></tr>
    </table>
  </td></tr>
</table>
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

    // Add to Resend audience
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

    // Send welcome email
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL || 'POTUS Watch Daily <onboarding@resend.dev>',
        to: email,
        subject: 'Welcome to POTUS Watch Daily — First dispatch incoming',
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
