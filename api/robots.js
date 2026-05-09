module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://www.potuswatchdaily.com/sitemap.xml');
};
