// Evergreen hubs that group related dispatches. Matching is by headline
// keyword at render time, so no database change is needed and every new
// article joins its topics the moment it is published.
export interface Topic { slug: string; name: string; blurb: string; intro: string; keywords: string[] }

export const TOPICS: Topic[] = [
  { slug: 'iran-nuclear-sanctions', name: 'Iran: Nuclear Program and Sanctions',
    blurb: 'Coverage of the Iran nuclear file, U.S. sanctions, Gulf shipping and the diplomacy around them.',
    intro: 'Iran policy runs on three tracks at once: what Tehran does with its nuclear program, what Washington does with sanctions and military pressure, and how Gulf neighbors and the UN Security Council respond. Each dispatch below is written from a primary document, such as a Treasury action, a presidential proclamation or a UN record, and linked back to it.',
    keywords: ['iran', 'tehran', 'hormuz', 'enrichment', 'iaea'] },
  { slug: 'us-china-trade-technology', name: 'U.S.–China Trade and Technology',
    blurb: 'Tariffs, export controls, antidumping cases and the strategic competition between Washington and Beijing.',
    intro: 'The U.S.–China relationship is now managed largely through trade and technology rules: tariffs, antidumping and countervailing duties, export controls on advanced chips, and entity listings. These dispatches track each formal step by the U.S. government and explain what it does and why it matters.',
    keywords: ['china', 'chinese', 'beijing', 'taiwan'] },
  { slug: 'russia-ukraine-sanctions', name: 'Russia, Ukraine and Sanctions',
    blurb: 'The war in Ukraine, U.S. and EU sanctions on Russia, and the wider diplomatic fallout.',
    intro: 'Sanctions, military aid and negotiating positions all shape the war in Ukraine. This hub follows official actions from Washington, Brussels and the UN, so readers can see what has formally changed rather than what is rumored.',
    keywords: ['russia', 'russian', 'ukraine', 'moscow', 'kyiv'] },
  { slug: 'nato-european-security', name: 'NATO and European Security',
    blurb: 'Alliance burden-sharing, defense policy and European security decisions.',
    intro: 'NATO policy is made through summit communiques, defense ministerials and national budget decisions. These dispatches cover the alliance and the U.S. role in it, citing the documents where commitments are actually written down.',
    keywords: ['nato', 'alliance', 'european union', 'eu council', 'baltic'] },
  { slug: 'tariffs-trade-policy', name: 'Tariffs and Trade Policy',
    blurb: 'Presidential tariff actions, Commerce duty rulings and USTR negotiations.',
    intro: 'Tariffs, antidumping orders and trade agreements change prices for importers and exporters directly. Each dispatch here starts from the official notice, whether a proclamation, a Commerce Department determination or a USTR announcement, and explains the practical effect.',
    keywords: ['tariff', 'duties', 'duty', 'antidumping', 'countervailing', 'trade representative', 'ustr'] },
  { slug: 'sanctions-policy', name: 'U.S. Sanctions Policy',
    blurb: 'How the U.S. uses sanctions: executive orders, Treasury designations, licenses and policy shifts.',
    intro: 'Sanctions are the most frequently used tool of U.S. foreign policy. This hub collects analysis of the policy decisions behind them, such as why a program is expanded, eased or waived, rather than every routine list update.',
    keywords: ['sanction', 'treasury', 'ofac', 'waive', 'waives'] },
  { slug: 'middle-east-diplomacy', name: 'Middle East Diplomacy',
    blurb: 'U.S. diplomacy and security policy across the Gulf, the Levant and the wider region.',
    intro: 'U.S. policy in the Middle East spans Gulf partnerships, the Israeli–Palestinian conflict, Syria and shipping security. These dispatches follow official statements and actions and cite them directly.',
    keywords: ['israel', 'gaza', 'syria', 'saudi', 'gulf', 'lebanon', 'mideast', 'yemen'] },
  { slug: 'export-controls-defense-trade', name: 'Export Controls and Defense Trade',
    blurb: 'ITAR, Commerce export rules, arms sales and technology transfer.',
    intro: 'Export controls decide which technologies and weapons can cross borders. These dispatches cover rule changes by the State and Commerce Departments, major arms sale notifications and what they signal about U.S. priorities.',
    keywords: ['export', 'itar', 'munitions', 'arms sale', 'military sale', 'entity list', 'semiconductor'] },
  { slug: 'presidential-actions', name: 'Presidential Actions',
    blurb: 'Executive orders, proclamations and memoranda, and what each one changes.',
    intro: 'Executive orders, proclamations and presidential memoranda are how the White House sets trade, tariff and sanctions policy directly. Each dispatch here starts from the signed document and explains what it does in practice.',
    keywords: ['president', 'proclamation', 'executive order', 'memorandum'] },
  { slug: 'weekly-review', name: 'Weekly Review',
    blurb: 'The week in presidential action on tariffs, trade and sanctions.',
    intro: 'Every Sunday, a review that ties the week together: the biggest actions, the themes connecting them, and what to watch next.',
    keywords: ['week of'] },
];

export const topicBySlug = (slug: string) => TOPICS.find(t => t.slug === slug);

export const topicsFor = (title: string | null | undefined) => {
  const t = String(title ?? '').toLowerCase();
  return TOPICS.filter(x => x.keywords.some(k => t.includes(k)));
};

// PostgREST .or() filter for a topic's keywords.
export const topicFilter = (t: Topic) => t.keywords.map(k => `title.ilike.%${k.replace(/[,()%]/g, '')}%`).join(',');
