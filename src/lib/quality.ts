// Single definition of "routine notice": list-maintenance filings (SDN list
// additions, general licenses) that the generator used to stretch into 700-word
// "analyses". AdSense reads a feed of those as scaled, low-value content, so
// they stay readable but are kept out of search (noindex) and out of every
// sitemap. Title-only on purpose: sitemaps select titles, not bodies, and the
// page and the sitemap must agree or Search Console reports "submitted URL
// marked noindex".
const ROUTINE = [
  /\bSDN\b/i,
  /\bOFAC\b/i,
  /specially designated/i,
  /\bgeneral licen[sc]es?\b/i,
  /\b(GL|GLs)\s?[0-9A-Z]{1,4}\b/,
  /\blicen[sc]es?\b.*\b(revok|suspend|expire|issu|publish)/i,
  /\b(unblock|adds? persons|new designations|blocking property)/i,
];

export const isRoutineNotice = (title: string | null | undefined) =>
  ROUTINE.some(re => re.test(String(title ?? '')));

// A photo that already appeared higher on the same page is dropped, so the
// card falls back to the branded placeholder instead of repeating one building
// across a dozen different stories.
const imageKey = (u: string) => u.split('?')[0];

export function dedupeImages<T extends { image?: string | null }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.map(a => {
    if (!a.image) return a;
    const k = imageKey(a.image);
    if (seen.has(k)) return { ...a, image: null };
    seen.add(k);
    return a;
  });
}

// The card that stands in for a photo names the document the story came from,
// so it is always true: a stock photo can only ever look like the story, a
// label can say what it is.
const HOSTS: Array<[RegExp, string]> = [
  [/whitehouse\.gov/, 'THE WHITE HOUSE'], [/federalregister\.gov/, 'FEDERAL REGISTER'],
  [/war\.gov|defense\.gov/, 'DEPT. OF WAR'], [/un\.org/, 'UNITED NATIONS'],
  [/consilium\.europa/, 'EU COUNCIL'], [/csis\.org/, 'CSIS ANALYSIS'], [/ustr\.gov/, 'USTR'],
  [/potuswatchdaily/, 'WEEKLY REVIEW'],
];
export function sourceLabel(sources: string | null | undefined, region?: string | null) {
  try {
    const first = JSON.parse(sources || '[]')?.[0]?.url || '';
    for (const [re, label] of HOSTS) if (re.test(first)) return label;
  } catch {}
  return (region || 'POTUS WATCH').toUpperCase();
}
