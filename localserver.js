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
      headers: { Authorization: 'Client-ID ' + process.env.UNSPLASH_ACCESS_KEY },
      timeout: 10000
    });
    return r.data.urls.regular;
  } catch(e) {
    return '';
  }
}

async function fetchNews() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await axios.get('https://newsapi.org/v2/everything', {
        params: { q: 'Trump foreign policy', language: 'en', sortBy: 'publishedAt', pageSize: 10, apiKey: process.env.NEWS_API_KEY },
        timeout: 15000
      });
      return r.data.articles.filter(a => a.title && a.description);
    } catch(e) {
      console.log('News fetch attempt ' + (attempt+1) + ' failed. Retrying...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  return null;
}

async function generateArticles() {
  try {
    const newsItems = await fetchNews();
    if (!newsItems) { console.log('Could not fetch news. Skipping.'); return; }

    const newsContext = newsItems.slice(0,5).map((a, i) => (i+1) + '. ' + a.title).join('\n');
    const region = regions[Math.floor(Math.random() * regions.length)];
    const prompt = 'You are a foreign policy journalist for POTUS Watch. Write a news analysis about ' + region + ' based on these headlines:\n\n' + newsContext + '\n\nRespond with ONLY a JSON object. No other text. No markdown. Just JSON:\n{"title":"headline here","region":"' + region + '","excerpt":"two sentences here","body":"write six paragraphs here"}';

    const res = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    let raw = res.data.content[0].text;
    raw = raw.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/```json|```/g, '').trim();
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}') + 1;
    raw = raw.slice(jsonStart, jsonEnd);
    const parsed = JSON.parse(raw);
    const image = await getImage(region);
    const now = new Date();

    await supabase.from('articles').insert({
      title: parsed.title,
      region: parsed.region || region,
      excerpt: parsed.excerpt,
      body: parsed.body + '\n\n' + affiliate,
      image: image,
      date: now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0'),
      sources: JSON.stringify(newsItems.slice(0, 3).map(a => ({ title: a.title, url: a.url })))
    });
    console.log('Saved: ' + parsed.title);
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

setInterval(generateArticles, 60 * 60 * 1000);

app.listen(3000, async () => {
  console.log('POTUS Watch running at http://localhost:3000');
  await generateArticles();
});