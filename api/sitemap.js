const { createClient } = require('@supabase/supabase-js');
module.exports = async (req, res) => {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data } = await supabase.from('articles').select('slug,date').order('id',{ascending:false}).limit(200);
    const urls = (data||[]).filter(a=>a.slug).map(a=>'  <url><loc>https://potuswatchdaily.com/article/'+a.slug+'</loc><changefreq>never</changefreq><priority>0.7</priority></url>').join('\n');
    res.setHeader('Content-Type','application/xml');
    res.setHeader('Cache-Control','public, s-maxage=3600');
    res.send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://potuswatchdaily.com/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>\n'+urls+'\n</urlset>');
  } catch(e) { res.status(500).send('Sitemap error: '+e.message); }
};