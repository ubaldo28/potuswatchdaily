// Vercel serverless function — serves /feed.xml (RSS 2.0)
// Reads latest 50 articles from Supabase.

const { createClient } = require('@supabase/supabase-js');

const SITE_URL = 'https://www.potuswatchdaily.com';
const SITE_NAME = 'POTUS Watch Daily';
const SITE_DESC = 'Independent foreign policy intelligence. Live analysis updated every hour.';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

module.exports = async (req, res) => {
    try {
        const { data: articles } = await supabase
            .from('articles')
            .select('*')
            .eq('published', true)
            .order('date', { ascending: false })
            .limit(50);

        const list = articles || [];

        const items = list.map(a => {
            const url = `${SITE_URL}/article/${a.slug}`;
            const pub = new Date(a.date).toUTCString();
            const author = a.author || 'POTUS Watch Editorial';
            const paragraphs = (a.body || '')
                .split('\n').filter(p => p.trim())
                .map(p => `<p>${esc(p)}</p>`).join('');
            const heroImg = a.hero_image
                ? `<img src="${esc(a.hero_image)}" alt="${esc(a.title)}"/>`
                : '';
            return `<item>
  <title><![CDATA[${a.title}]]></title>
  <link>${url}</link>
  <guid isPermaLink="true">${url}</guid>
  <pubDate>${pub}</pubDate>
  <dc:creator><![CDATA[${author}]]></dc:creator>
  <category>${esc(a.region || 'World')}</category>
  <description><![CDATA[${a.excerpt || ''}]]></description>
  <content:encoded><![CDATA[${heroImg}${paragraphs}]]></content:encoded>
</item>`;
        }).join('\n');

        const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}/</link>
    <description>${SITE_DESC}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/logo.png</url>
      <title>${SITE_NAME}</title>
      <link>${SITE_URL}/</link>
    </image>
    ${items}
  </channel>
</rss>`;

        res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600');
        res.status(200).send(rss);
    } catch (e) {
        console.error('[feed]', e);
        res.status(500).send('Feed error');
    }
};
