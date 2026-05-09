const { createClient } = require('@supabase/supabase-js');
module.exports = async (req, res) => {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data, error } = await supabase
      .from('articles')
      .select('slug, date')
      .order('id', { ascending: false })
      .limit(500);

    if (error) throw error;

    const articles = (data || []).filter(a => a.slug && a.slug.length > 3);

    const urls = articles.map(a =>
      '  <url>\n    <loc>https://potuswatchdaily.com/article/' + a.slug + '</loc>\n    <changefreq>never</changefreq>\n    <priority>0.7</priority>\n  </url>'
    ).join('\n');

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://potuswatchdaily.com/</loc>\n    <changefreq>hourly</changefreq>\n    <priority>1.0</priority>\n  </url>\n  <url>\n    <loc>https://potuswatchdaily.com/archive</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.5</priority>\n  </url>\n' + urls + '\n</urlset>';

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=1800');
    res.send(xml);
  } catch(e) {
    res.status(500).send('Sitemap error: ' + e.message);
  }
};