module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0"?>
<users>
<user>4DFBAADA7727539520638CC755C75540</user>
</users>`);
};
