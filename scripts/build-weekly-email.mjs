#!/usr/bin/env node
/**
 * Builds the Sunday weekly briefing email as a single HTML file.
 *
 *   node scripts/build-weekly-email.mjs              # this week
 *   node scripts/build-weekly-email.mjs --days 7     # window length
 *
 * Output: email/out/weekly-YYYY-MM-DD.html and a matching .txt. Paste the HTML
 * into a Resend Broadcast (Audience: General). Nothing is sent from here.
 *
 * Reads only public data: published articles via the Supabase publishable key,
 * and presidential documents from the public Federal Register API. The
 * unsubscribe link is Resend's own merge tag, filled in per recipient at send.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../project.config.json', import.meta.url), 'utf8'));
const SITE = 'https://www.potuswatchdaily.com';
const SB_URL = process.env.SUPABASE_URL || cfg.supabase.url;
const SB_KEY = process.env.SUPABASE_KEY || cfg.supabase.publishableKey;
const days = Number(process.argv[process.argv.indexOf('--days') + 1]) || 7;
// This is an editorial newsletter: no ads, affiliate links, sponsors or tip jar, so it
// is not a "commercial" message under CAN-SPAM and needs no postal address. KEEP IT
// THAT WAY. The day an ad, sponsor, affiliate link or product promotion goes in, set
// MAILING_ADDRESS (a P.O. box is fine) and the footer will print it.
const ADDRESS = process.env.MAILING_ADDRESS || '';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const today = new Date();
const stamp = today.toISOString().slice(0, 10);
const utm = `utm_source=newsletter&utm_medium=email&utm_campaign=weekly-${stamp}`;
const link = (path) => `${SITE}${path}${path.includes('?') ? '&' : '?'}${utm}`;

const ROUTINE = /\bSDN\b|\bOFAC\b|specially designated|general licen[sc]e|designations?\b|blocking property|unblock/i;
// Bare "president" is deliberately absent: it matches "Security Council President".
const FOCUS = /tariff|dut(y|ies)\b|sanction|export|import|trade|embargo|proclamation|executive order|presidential|white house|iran|china|russia|ukrain|treasury|commerce|ustr|g20|nato/i;
const ON_FOCUS_SOURCE = /whitehouse\.gov|ustr\.gov/;
const fromFocusSource = a => { try { return ON_FOCUS_SOURCE.test(JSON.parse(a.sources || '[]')?.[0]?.url || ''); } catch { return false; } };

async function articles() {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const url = `${SB_URL}/rest/v1/articles?select=title,slug,excerpt,region,published_at,body,sources&removed_at=is.null&published_at=gte.${encodeURIComponent(since)}&order=published_at.desc&limit=80`;
  const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

async function presidentialDocs() {
  const out = [];
  for (const kind of ['executive_order', 'proclamation', 'memorandum']) {
    const u = `https://www.federalregister.gov/api/v1/documents.json?per_page=15&order=newest&conditions[presidential_document_type][]=${kind}` +
      `&conditions[publication_date][gte]=${new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)}` +
      '&fields[]=title&fields[]=html_url&fields[]=signing_date&fields[]=executive_order_number';
    try {
      const r = await fetch(u); if (!r.ok) continue;
      for (const d of (await r.json()).results || []) {
        if (kind === 'proclamation' && /,\s*20\d\d$/.test(d.title)) continue;   // observances
        out.push({ title: d.title, url: d.html_url, date: d.signing_date, kind: d.executive_order_number ? `EO ${d.executive_order_number}` : kind === 'proclamation' ? 'Proclamation' : 'Memorandum' });
      }
    } catch { /* optional section */ }
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
}

const section = (title) => `<tr><td style="padding:28px 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#B3321B">${esc(title)}</td></tr>`;

function storyRow(a) {
  return `<tr><td style="padding:14px 32px;border-bottom:1px solid #E4DFD0">
    <a href="${esc(link('/article/' + a.slug))}" style="font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.3;font-weight:700;color:#10141B;text-decoration:none">${esc(a.title)}</a>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:#353C4A;margin-top:6px">${esc(a.excerpt || '')}</div>
    <a href="${esc(link('/article/' + a.slug))}" style="display:inline-block;margin-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#144A8C;text-decoration:none">Read the analysis &rarr;</a>
  </td></tr>`;
}

function docRow(d) {
  const day = d.date ? new Date(d.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
  return `<tr><td style="padding:10px 32px;border-bottom:1px solid #E4DFD0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#10141B">
    <span style="color:#5E6474;font-weight:700">${esc(day)}</span> &nbsp;<span style="color:#B3321B;font-weight:700;font-size:11px;letter-spacing:.5px">${esc(d.kind.toUpperCase())}</span><br>
    <a href="${esc(d.url)}" style="color:#10141B;text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:16px">${esc(d.title)}</a>
  </td></tr>`;
}

function watchItems(review) {
  if (!review) return [];
  const m = review.body.match(/##\s*What to Watch[^\n]*\n+([\s\S]*?)(?:\n##|$)/i);
  if (!m) return [];
  return m[1].split('\n').map(l => l.replace(/^[-*]\s*/, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim()).filter(Boolean).slice(0, 4);
}

const rows = await articles();
const review = rows.find(a => a.slug.startsWith('week-in-'));
const stories = rows.filter(a => !a.slug.startsWith('week-in-') && !ROUTINE.test(a.title) && (fromFocusSource(a) || FOCUS.test(a.title))).slice(0, 5);
const docs = await presidentialDocs();
const watch = watchItems(review);

const subject = stories[0] ? `This week: ${stories[0].title}` : 'POTUS Watch Daily: the week in presidential action';
const preheader = review?.excerpt || stories.slice(0, 3).map(s => s.title).join(' · ');
const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F6F3EB">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F6F3EB">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F6F3EB" style="background:#F6F3EB"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #D8D2C2">

  <tr><td bgcolor="#0B2545" style="background:#0B2545;padding:22px 32px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="44" height="44" align="center" valign="middle" bgcolor="#C23B22" style="background:#C23B22;color:#FFFFFF;font-size:24px;line-height:44px;border-radius:3px">&#9733;</td>
      <td style="padding-left:14px">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#F6F3EB;line-height:1">POTUS <span style="color:#F2B84B">Watch</span> Daily</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:2.4px;color:#AEBBD0;margin-top:6px">TARIFFS &middot; TRADE &middot; SANCTIONS</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td bgcolor="#C23B22" height="4" style="background:#C23B22;height:4px;font-size:0;line-height:0">&nbsp;</td></tr>

  <tr><td style="padding:24px 32px 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5E6474">Weekly briefing &middot; ${esc(dateLabel)}</td></tr>
  <tr><td style="padding:0 32px 8px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:700;color:#10141B">${review ? esc(review.title.replace(/ — Week of.*$/, '')) : 'What the President did this week, and what it changes'}</td></tr>
  ${review?.excerpt ? `<tr><td style="padding:0 32px 8px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.6;color:#353C4A">${esc(review.excerpt)}</td></tr>` : ''}
  ${review ? `<tr><td style="padding:6px 32px 8px"><a href="${esc(link('/article/' + review.slug))}" style="display:inline-block;background:#C23B22;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;text-decoration:none;padding:12px 22px;border-radius:3px">Read the full weekly review</a></td></tr>` : ''}

  ${stories.length ? section('Top stories this week') + stories.map(storyRow).join('') : ''}
  ${docs.length ? section('Presidential actions') + docs.map(docRow).join('') + `<tr><td style="padding:12px 32px"><a href="${esc(link('/tracker'))}" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#144A8C;text-decoration:none">Open the full tracker &rarr;</a></td></tr>` : ''}
  ${watch.length ? section('What to watch next week') + `<tr><td style="padding:6px 32px 8px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${watch.map(w => `<tr><td width="16" valign="top" style="color:#C23B22;font-size:16px;line-height:1.5">&bull;</td><td style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:#10141B;padding-bottom:8px">${esc(w)}</td></tr>`).join('')}</table></td></tr>` : ''}

  <tr><td bgcolor="#EDE8DA" style="background:#EDE8DA;padding:22px 32px;margin-top:20px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#353C4A">
    <strong>How this is made.</strong> POTUS Watch Daily is automated analysis, drafted from primary documents (the White House, the Federal Register, Treasury, Commerce, USTR) and run through an automated check against those sources. Every article lists what it draws on. <a href="${esc(link('/editorial'))}" style="color:#144A8C">Our standards</a>.
  </td></tr>
  <tr><td bgcolor="#0B2545" style="background:#0B2545;padding:22px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:#C9D3E3">
    You are receiving this because you subscribed at potuswatchdaily.com.<br>
    <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#F2B84B">Unsubscribe</a> &middot; <a href="${esc(link('/'))}" style="color:#F2B84B">potuswatchdaily.com</a> &middot; <a href="${esc(link('/privacy'))}" style="color:#F2B84B">Privacy</a><br>
    <span style="color:#98A6BD">POTUS Watch Daily${ADDRESS ? ' &middot; ' + esc(ADDRESS) : ''}</span>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

const text = [
  subject, '', review?.excerpt || '', '',
  ...stories.map(s => `- ${s.title}\n  ${link('/article/' + s.slug)}`), '',
  ...(docs.length ? ['PRESIDENTIAL ACTIONS', ...docs.map(d => `- ${d.kind}: ${d.title}`)] : []), '',
  ...(watch.length ? ['WHAT TO WATCH', ...watch.map(w => `- ${w}`)] : []), '',
  'Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}', `POTUS Watch Daily${ADDRESS ? ', ' + ADDRESS : ''}`,
].join('\n');

mkdirSync(new URL('../email/out/', import.meta.url), { recursive: true });
const base = new URL(`../email/out/weekly-${stamp}`, import.meta.url);
writeFileSync(base.pathname + '.html', html);
writeFileSync(base.pathname + '.txt', text);
console.log(`Subject:   ${subject}`);
console.log(`Stories:   ${stories.length}   Presidential docs: ${docs.length}   Weekly review: ${review ? 'yes' : 'not yet published'}`);
console.log(`Written:   email/out/weekly-${stamp}.html (+ .txt)`);
if (!ADDRESS) console.log('Footer has no postal address: fine while the email carries no ads, affiliate links or promotion.');
