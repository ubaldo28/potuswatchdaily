require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
app.use(express.static('.'));
app.use(express.json());

const regions = ['Iran','China','NATO','Americas','Mideast','Russia','Trade'];
const imageQueries = {
  Iran:'iran military',
  China:'china beijing politics',
  NATO:'nato military europe',
  Americas:'washington dc white house',
  Mideast:'middle east conflict',
  Russia:'moscow kremlin',
  Trade:'global trade economy'
};
const affiliate = 'SPONSORED: With global instability rising, thousands of Americans are preparing. Get the #1 rated emergency survival kit on Amazon: https://amzn.to/4cgkdM3';

async function getImage(region) {
  try {
    const r = await axios.get('https://api.unsplash.com/photos/random', {
      params: { query: imageQueries[region] || 'politics', orientation: 'landscape' },
      headers: { Authorization: 'Client-ID ' + process.env.UNSPLASH_ACCESS_KEY }
    });
    return r.data.urls.regular;
  } catch(e) {
    return '';
  }
}

async function generateArticles() {
  try {
    const newsRes = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: 'Trump foreign policy',
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10,
        apiKey: process.env.NEWS_API_KEY
      }
    });
    const newsItems = newsRes.data.articles.filter(a => a.title && a.description);
    const newsContext = newsItems.map((a, i) => 'Article ' + (i+1) + ': ' + a.title + '\n' + a.description).join('\n\n');

    for (let i = 0; i < 2; i++) {
      const region = regions[Math.floor(Math.random() * regions.length)];
      const prompt = 'You are an elite AI foreign policy correspondent for POTUS Watch. Today is April 2026. Latest Trump news:\n\n' + newsContext + '\n\nWrite a sharp analytical dispatch focused on ' + region + '. Return ONLY valid JSON no markdown no backticks: {"title":"provocative specific headline","region":"' + region + '","excerpt":"2-3 punchy sentences","body":"6 paragraphs of serious analysis. What is Trump next move and why."}';

      const res = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_API_KEY,
        { contents: [{ parts: [{ text: prompt }] }] },
        { headers: { 'Content-Type': 'application/json' } }
      );

      const raw = res.data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(raw);
      const image = await getImage(region);
      const now = new Date();

      await supabase.from('articles').insert({
        title: parsed.title,
        region: parsed.region,
        excerpt: parsed.excerpt,
        body: parsed.body + '\n\n' + affiliate,
        image: image,
        date: now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        time: now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0'),
        sources: JSON.stringify(newsItems.slice(0, 3).map(a => ({ title: a.title, url: a.url })))
      });
      console.log('Saved: ' + parsed.title);
    }
    console.log('Done.');
  } catch(e) {
    console.error('Error:', e.message);
  }
}

app.get('/get-articles', async (req, res) => {
  try {
    const { data, error } = await supabase.from('articles').select('*').order('id', { ascending: false }).limit(20);
    if (error) throw error;
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

setInterval(generateArticles, 3 * 60 * 60 * 1000);

app.listen(3000, async () => {
  console.log('POTUS Watch running at http://localhost:3000');
  await generateArticles();
});
