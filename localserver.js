const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
app.use(express.static('.'));
app.use(express.json());

const regions = ['Iran','China','NATO','Americas','Mideast','Russia','Trade'];
const imageQueries = {
  Iran:'iran diplomacy politics',China:'china beijing diplomacy',
  NATO:'nato military alliance europe',Americas:'washington dc capitol',
  Mideast:'middle east diplomacy',Russia:'moscow kremlin russia',
  Trade:'global trade economy shipping'
};
const affiliate = 'SPONSORED: With global instability rising, thousands of Americans are preparing. Get the #1 rated emergency survival kit on Amazon: https://amzn.to/4cgkdM3';

function slugify(t){return t.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80);}

async function getImage(region,size){
  try{
    const r=await axios.get('https://api.unsplash.com/photos/random',{
      params:{query:imageQueries[region]||'politics world',orientation:'landscape',content_filter:'high'},
      headers:{Authorization:'Client-ID '+process.env.UNSPLASH_ACCESS_KEY},timeout:10000
    });
    const raw=r.data.urls.raw;
    if(size==='thumb') return raw+'&w=600&q=75&fit=crop';
    if(size==='hero') return raw+'&w=1200&q=85&fit=crop';
    return r.data.urls.regular;
  }catch(e){return '';}
}

async function fetchNews(){
  for(let i=0;i<3;i++){
    try{
      const r=await axios.get('https://newsapi.org/v2/everything',{
        params:{q:'Trump foreign policy OR diplomacy OR tariffs OR NATO OR China OR Iran',language:'en',sortBy:'publishedAt',pageSize:10,apiKey:process.env.NEWS_API_KEY},
        timeout:15000
      });
      return r.data.articles.filter(a=>a.title&&a.description&&a.title!=='[Removed]');
    }catch(e){console.log('News attempt '+(i+1)+' failed:',e.message);await new Promise(r=>setTimeout(r,5000));}
  }
  return null;
}

async function generateArticles(){
  try{
    const newsItems=await fetchNews();
    if(!newsItems||!newsItems.length){console.log('No news. Skipping.');return;}
    const region=regions[Math.floor(Math.random()*regions.length)];
    const keywords={Iran:['iran','tehran','nuclear'],China:['china','beijing','xi','taiwan'],NATO:['nato','europe','ukraine'],Americas:['trump','white house','congress'],Mideast:['israel','gaza','saudi','yemen'],Russia:['russia','putin','moscow','ukraine'],Trade:['tariff','trade','economy','sanctions']};
    const kw=keywords[region]||[];
    const relevant=newsItems.filter(a=>kw.some(k=>(a.title+' '+(a.description||'')).toLowerCase().includes(k)));
    const pool=relevant.length>=3?relevant:newsItems;
    const top5=pool.slice(0,5);
    const newsContext=top5.map((a,i)=>(i+1)+'. '+a.title+(a.description?'\n   '+a.description:'')).join('\n\n');
    const types=['breaking news analysis','strategic intelligence briefing','diplomatic developments report','policy implications analysis','geopolitical situation report'];
    const articleType=types[Math.floor(Math.random()*types.length)];

    const prompt='You are a senior foreign policy correspondent at POTUS Watch Daily, a Washington-based intelligence briefing. Your writing is authoritative, precise, and analytical.\n\nToday assignment: Write a '+articleType+' focused on the '+region+' portfolio.\n\nUse these recent headlines:\n'+newsContext+'\n\nArticle structure:\n- Paragraph 1 (Lede): One powerful sentence.\n- Paragraph 2 (Context): Brief background.\n- Paragraph 3 (Analysis): Strategic meaning.\n- Paragraph 4 (Wider implications): Effects on allies and markets.\n- Paragraph 5 (Washington angle): How Trump administration responded.\n- Paragraph 6 (Outlook): What to watch in 48-72 hours.\n\nRespond ONLY with valid JSON, no markdown:\n{"title":"headline under 12 words","region":"'+region+'","excerpt":"one sentence max 25 words","meta_description":"max 155 chars","slug":"url-friendly-slug","body":"para1\\n\\npara2\\n\\npara3\\n\\npara4\\n\\npara5\\n\\npara6"}';

    const res=await axios.post('https://api.anthropic.com/v1/messages',{
      model:'claude-haiku-4-5-20251001',
      max_tokens:1500,
      messages:[{role:'user',content:prompt}]
    },{
      headers:{'x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','Content-Type':'application/json'},
      timeout:30000
    });

    let raw=res.data.content[0].text;
    raw=raw.replace(/[\x00-\x1F\x7F]/g,' ').replace(/```json|```/g,'').trim();
    const js=raw.indexOf('{'),je=raw.lastIndexOf('}')+1;
    const parsed=JSON.parse(raw.slice(js,je));
    const slug=(parsed.slug&&parsed.slug.length>3)?slugify(parsed.slug):slugify(parsed.title);
    const {data:existing}=await supabase.from('articles').select('slug').eq('slug',slug).limit(1);
    const finalSlug=(existing&&existing.length)?slug+'-'+Date.now():slug;
    const heroImage=await getImage(region,'hero');
    const cardImage=await getImage(region,'thumb');
    const now=new Date();
    await supabase.from('articles').insert({
      title:parsed.title,region:parsed.region||region,excerpt:parsed.excerpt,
      meta_description:parsed.meta_description||parsed.excerpt,slug:finalSlug,
      body:parsed.body+'\n\n'+affiliate,image:cardImage||heroImage,hero_image:heroImage||cardImage,
      date:now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}),
      time:now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false}),
      sources:JSON.stringify(top5.slice(0,3).map(a=>({title:a.title,url:a.url})))
    });
    console.log('Saved:',parsed.title,'| Slug:',finalSlug);
  }catch(e){console.error('Error:',e.message);if(e.response)console.error('API:',JSON.stringify(e.response.data));}
}

app.get('/get-articles',async(req,res)=>{
  try{
    const{data,error}=await supabase.from('articles').select('*').order('id',{ascending:false}).limit(24);
    if(error)throw error;
    res.setHeader('Cache-Control','public, s-maxage=180, stale-while-revalidate=600');
    res.json(data);
  }catch(e){res.status(500).json({error:e.message});}
});

setInterval(generateArticles,30*60*1000);
app.listen(3000,async()=>{
  console.log('POTUS Watch running at http://localhost:3000');
  await generateArticles();
});
