// Live presidential actions and agency notices, straight from the Federal
// Register API (keyless, public domain). Fetched at request time and cached at
// Cloudflare's edge for 15 minutes, so the tracker is current without a
// database table or a generator run.
const FR = 'https://www.federalregister.gov/api/v1/documents.json';

export type Tag = 'Tariffs' | 'Sanctions' | 'Export Controls' | 'Trade' | 'Other';
export interface PresAction { title: string; url: string; date: string; signed: string; kind: string; number: string; tag: Tag }
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

export async function presidentialActions(limit = 60): Promise<PresAction[]> {
  const batches = await Promise.all(KINDS.map(async ([k, label]) => {
    const rows = await frJson(
      `per_page=30&order=newest&conditions[presidential_document_type][]=${k}` +
      '&fields[]=title&fields[]=html_url&fields[]=publication_date&fields[]=signing_date&fields[]=executive_order_number');
    return rows.map(r => ({
      title: String(r.title || ''), url: r.html_url, date: r.publication_date,
      signed: r.signing_date || r.publication_date, kind: label,
      number: r.executive_order_number ? `EO ${r.executive_order_number}` : '', tag: classify(String(r.title || '')),
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
