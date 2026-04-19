const { createClient } = require('@supabase/supabase-js');
module.exports = async (req, res) => {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data, error } = await supabase.from('articles').select('*').order('id', { ascending: false }).range(parseInt(req.query.offset)||0, (parseInt(req.query.offset)||0)+23);
    if(error) throw error;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
