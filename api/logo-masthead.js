const fs = require('fs');
const path = require('path');
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(fs.readFileSync(path.join(__dirname, '../public/logo-masthead.svg')));
};
