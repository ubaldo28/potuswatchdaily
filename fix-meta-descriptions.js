/**
 * fix-articles.js
 * 1. Deletes placeholder/empty articles
 * 2. Expands thin articles (<300 words) to 450+ words using Claude
 * Run: node fix-meta-descriptions.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// Slugs that are clearly placeholder/garbage — no real content
const PLACEHOLDER_PATTERNS = [
  'no-mideast-developments',
  'no-developments-identified',
  'limited-developments',
  'portfolio-limited',
  'no-news-identified',
  'no-updates-identified',
];

function isPlaceholder(slug) {
  return PLACEHOLDER_PATTERNS.some(p => slug.includes(p));
}

async function expandArticle(title, region, body, attempt = 1) {
  const prompt = `Foreign policy analyst. Write 3 short sections to append to a news article. Plain text, no markdown. Each section: label in caps then colon, then 2 sentences. Sections: BACKGROUND, ANALYSIS, WHAT TO WATCH. ~120 words total. Region: ${region}. Article: ${title}`;

  try {
    const res = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 250,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 30000
      }
    );
    return body + '\n\n' + res.data.content[0].text.trim();
  } catch (err) {
    if (attempt < 4) {
      const wait = attempt * 3000;
      await new Promise(r => setTimeout(r, wait));
      return expandArticle(title, region, body, attempt + 1);
    }
    throw err;
  }
}

async function run() {
  console.log('Fetching articles from Supabase...\n');

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, slug, title, region, body')
    .order('id', { ascending: false });

  if (error) { console.error('Supabase error:', error.message); process.exit(1); }

  // Step 1: Delete placeholders
  const placeholders = articles.filter(a => isPlaceholder(a.slug));
  if (placeholders.length > 0) {
    console.log(`Deleting ${placeholders.length} placeholder articles...`);
    for (const a of placeholders) {
      const { error: delError } = await supabase.from('articles').delete().eq('id', a.id);
      console.log(delError ? `  ✗ ${a.slug}` : `  ✓ deleted: ${a.slug}`);
    }
  }

  // Step 2: Expand thin articles
  const thin = articles.filter(a =>
    !isPlaceholder(a.slug) &&
    (a.body || '').split(/\s+/).filter(Boolean).length < 500
  );

  console.log(`\nThin articles to expand: ${thin.length}`);
  if (thin.length === 0) { console.log('Nothing to expand.'); return; }

  let expanded = 0;
  let failed = 0;

  for (const article of thin) {
    const words = (article.body || '').split(/\s+/).filter(Boolean).length;
    process.stdout.write(`[${expanded + failed + 1}/${thin.length}] ${article.slug} (${words}w) ... `);

    try {
      const newBody = await expandArticle(article.title, article.region, article.body);
      const newWords = newBody.split(/\s+/).filter(Boolean).length;

      const { error: updateError } = await supabase
        .from('articles')
        .update({ body: newBody })
        .eq('id', article.id);

      if (updateError) throw new Error(updateError.message);
      console.log(`✓ ${words}w → ${newWords}w`);
      expanded++;
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      const detail = err.response ? JSON.stringify(err.response.data) : err.message;
      console.log(`✗ ${detail}`);
      failed++;
    }
  }

  console.log(`\nDone. Expanded: ${expanded}  Failed: ${failed}`);
}

run();
