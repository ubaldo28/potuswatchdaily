// Live presidential actions and agency notices, straight from the Federal
// Register API (keyless, public domain). Fetched at request time and cached at
// Cloudflare's edge for 15 minutes, so the tracker is current without a
// database table or a generator run.
const FR = 'https://www.federalregister.gov/api/v1/documents.json';

export type Tag = 'Tariffs' | 'Sanctions' | 'Export Controls' | 'Trade' | 'Other';
export interface PresAction { title: string; url: string; date: string; signed: string; kind: string; number: string; tag: Tag; doc: string }
export interface Notice { title: string; url: string; date: string; agency: string; tag: Tag }

export function classify(title: string): Tag {
  const t = title.toLowerCase();
  if (/tariff|duty|duties|adjusting imports|section 232|section 301|antidumping|countervailing|reciprocal/.test(t)) return 'Tariffs';
  if (/sanction|blocking|ofac|designat|licen[sc]e|national emergenc/.test(t)) return 'Sanctions';
  if (/export|itar|munitions|entity list|chip|semiconductor/.test(t)) return 'Export Controls';
  if (/trade|import|agreement|commerce|investment/.test(t)) return 'Trade';
  return 'Other';
}

async function frJson(params: string): Promise<any[]> {
  try {
    const r = await fetch(`${FR}?${params}`, {
      headers: { 'User-Agent': 'POTUSWatchDaily/1.0 (+https://www.potuswatchdaily.com)' },
      // @ts-ignore Cloudflare-specific fetch option
      cf: { cacheTtl: 900, cacheEverything: true },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    return (await r.json()).results ?? [];
  } catch { return []; }
}

const KINDS: Array<[string, string]> = [
  ['executive_order', 'Executive Order'], ['proclamation', 'Proclamation'], ['memorandum', 'Memorandum'],
];

export async function presidentialActions(limit = 60, perKind = 30): Promise<PresAction[]> {
  const batches = await Promise.all(KINDS.map(async ([k, label]) => {
    const rows = await frJson(
      `per_page=${perKind}&order=newest&conditions[presidential_document_type][]=${k}` +
      '&fields[]=title&fields[]=html_url&fields[]=publication_date&fields[]=signing_date&fields[]=executive_order_number&fields[]=proclamation_number&fields[]=document_number');
    return rows.map(r => ({
      title: String(r.title || ''), url: r.html_url, date: r.publication_date,
      signed: r.signing_date || r.publication_date, kind: label,
      number: r.executive_order_number ? `EO ${r.executive_order_number}` : r.proclamation_number ? `Proc. ${r.proclamation_number}` : '',
      doc: String(r.document_number || ''), tag: classify(String(r.title || '')),
    } as PresAction));
  }));
  // Observance proclamations ("Gold Star Mother's Day, 2026") carry a year suffix;
  // policy proclamations do not.
  return batches.flat().filter(a => a.title && a.url && !(a.kind === 'Proclamation' && /,\s*20\d\d$/.test(a.title)))
    .sort((a, b) => (b.signed || '').localeCompare(a.signed || '')).slice(0, limit);
}

const AGENCIES: Array<[string, string, Tag]> = [
  ['foreign-assets-control-office', 'Treasury · OFAC', 'Sanctions'],
  ['industry-and-security-bureau', 'Commerce · BIS', 'Export Controls'],
  ['international-trade-administration', 'Commerce · ITA', 'Tariffs'],
];

export async function agencyNotices(limit = 40): Promise<Notice[]> {
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const batches = await Promise.all(AGENCIES.map(async ([slug, label, tag]) => {
    const rows = await frJson(
      `per_page=20&order=newest&conditions[agencies][]=${slug}&conditions[publication_date][gte]=${since}` +
      '&fields[]=title&fields[]=html_url&fields[]=publication_date');
    return rows.map(r => ({ title: String(r.title || ''), url: r.html_url, date: r.publication_date, agency: label, tag } as Notice));
  }));
  return batches.flat().filter(n => n.title && n.url)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

export interface Order {
  doc: string; title: string; kind: string; label: string; signed: string; published: string;
  citation: string; abstract: string; htmlUrl: string; pdfUrl: string; text: string; tag: Tag;
}

// One presidential document, with its official text. Federal Register text is a
// US government work in the public domain; the page adds structure, context and
// links, it does not claim the words.
export async function getOrder(doc: string): Promise<Order | null> {
  if (!/^[0-9]{4}-[0-9]{4,6}$/.test(doc)) return null;
  try {
    const r = await fetch(
      `https://www.federalregister.gov/api/v1/documents/${doc}.json?fields[]=title&fields[]=abstract&fields[]=signing_date&fields[]=publication_date` +
      '&fields[]=citation&fields[]=html_url&fields[]=pdf_url&fields[]=raw_text_url&fields[]=subtype' +
      '&fields[]=executive_order_number&fields[]=proclamation_number&fields[]=type',
      {
        headers: { 'User-Agent': 'POTUSWatchDaily/1.0 (+https://www.potuswatchdaily.com)' },
        // @ts-ignore Cloudflare-specific fetch option
        cf: { cacheTtl: 3600, cacheEverything: true },
        signal: AbortSignal.timeout(8000),
      });
    if (!r.ok) return null;
    const d: any = await r.json();
    const kindLabel = String(d.subtype || '');
    if (d.type !== 'Presidential Document' || !['Executive Order', 'Proclamation', 'Memorandum'].includes(kindLabel)) return null;
    let text = '';
    if (d.raw_text_url) {
      const t = await fetch(d.raw_text_url, {
        // @ts-ignore Cloudflare-specific fetch option
        cf: { cacheTtl: 3600, cacheEverything: true }, signal: AbortSignal.timeout(8000),
      });
      if (t.ok) text = (await t.text()).replace(/\r/g, '').trim();
    }
    const number = d.executive_order_number || d.proclamation_number;
    return {
      doc, title: String(d.title || ''), kind: kindLabel,
      label: number ? `${kindLabel} ${number}` : kindLabel,
      signed: d.signing_date || d.publication_date || '', published: d.publication_date || '',
      citation: d.citation || '', abstract: d.abstract || '', htmlUrl: d.html_url, pdfUrl: d.pdf_url || '',
      text, tag: classify(String(d.title || '')),
    };
  } catch { return null; }
}

// Recent documents for the sitemap: policy documents only, no observances.
export async function recentOrderDocs(limit = 150): Promise<Array<{ doc: string; date: string }>> {
  const rows = await presidentialActions(limit, 100);
  return rows.filter(a => a.doc).map(a => ({ doc: a.doc, date: a.signed }));
}

// Every presidential document matching a search term, newest first. Powers the
// timeline pages: a page that is current by construction because it is the
// Federal Register's own record, not a hand-written summary that goes stale.
export async function searchActions(term: string, limit = 100): Promise<PresAction[]> {
  const batches = await Promise.all(KINDS.map(async ([k, label]) => {
    const rows = await frJson(
      `per_page=${limit}&order=newest&conditions[term]=${encodeURIComponent(term)}&conditions[presidential_document_type][]=${k}` +
      '&fields[]=title&fields[]=html_url&fields[]=publication_date&fields[]=signing_date&fields[]=executive_order_number&fields[]=proclamation_number&fields[]=document_number');
    return rows.map(r => ({
      title: String(r.title || ''), url: r.html_url, date: r.publication_date,
      signed: r.signing_date || r.publication_date, kind: label,
      number: r.executive_order_number ? `EO ${r.executive_order_number}` : r.proclamation_number ? `Proc. ${r.proclamation_number}` : '',
      doc: String(r.document_number || ''), tag: classify(String(r.title || '')),
    } as PresAction));
  }));
  return batches.flat().filter(a => a.title && a.url && a.doc && !(a.kind === 'Proclamation' && /,\s*20\d\d$/.test(a.title)))
    .sort((a, b) => (b.signed || '').localeCompare(a.signed || ''));
}

// A White House "presidential actions" page and its Federal Register document
// are the same text under the same title, but the White House URL carries no
// document number. Find the Federal Register copy by title so the article can
// link to its order page. A document signed in the last few days may not be in
// the Federal Register yet; that is a miss, not an error.
export async function findOrderByTitle(title: string): Promise<string | null> {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const want = norm(title);
  if (want.length < 12) return null;
  const rows = await frJson(
    `per_page=10&order=newest&conditions[term]=${encodeURIComponent(`"${title}"`)}&conditions[type][]=PRESDOCU` +
    '&fields[]=title&fields[]=document_number&fields[]=subtype');
  const hit = rows.find(r => norm(String(r.title || '')) === want && ['Executive Order', 'Proclamation', 'Memorandum'].includes(r.subtype));
  return hit?.document_number ?? null;
}
