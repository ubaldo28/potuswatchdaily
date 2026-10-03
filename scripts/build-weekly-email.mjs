#!/usr/bin/env node
/**
 * Builds the weekly briefing email as an HTML file you can preview or paste into a
 * Resend Broadcast by hand. The real Sunday send is automated in the generator
 * Worker (see worker/email.js); this script uses the same layout so what you
 * preview is what goes out. Nothing is sent from here.
 *
 *   node scripts/build-weekly-email.mjs              # this week
 *   node scripts/build-weekly-email.mjs --days 7     # window length
 *
 * Output: email/out/weekly-YYYY-MM-DD.html and a matching .txt
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { buildWeeklyEmail, pickStories, presidentialDocs } from '../worker/email.js';

const cfg = JSON.parse(readFileSync(new URL('../project.config.json', import.meta.url), 'utf8'));
const SB_URL = process.env.SUPABASE_URL || cfg.supabase.url;
const SB_KEY = process.env.SUPABASE_KEY || cfg.supabase.publishableKey;
const days = Number(process.argv[process.argv.indexOf('--days') + 1]) || 7;

const since = new Date(Date.now() - days * 864e5).toISOString();
const r = await fetch(`${SB_URL}/rest/v1/articles?select=title,slug,excerpt,region,published_at,body,sources&removed_at=is.null&published_at=gte.${encodeURIComponent(since)}&order=published_at.desc&limit=80`,
  { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
if (!r.ok) throw new Error(`Supabase ${r.status}`);
const rows = await r.json();

const review = rows.find(a => a.slug.startsWith('week-in-'));
const stories = pickStories(rows);
const docs = await presidentialDocs(days);
const email = buildWeeklyEmail({ stories, docs, review, address: process.env.MAILING_ADDRESS || '' });

mkdirSync(new URL('../email/out/', import.meta.url), { recursive: true });
const base = new URL(`../email/out/weekly-${email.stamp}`, import.meta.url).pathname;
writeFileSync(base + '.html', email.html);
writeFileSync(base + '.txt', email.text);
console.log(`Subject:   ${email.subject}`);
console.log(`Stories:   ${stories.length}   Presidential docs: ${docs.length}   Weekly review: ${review ? 'yes' : 'not yet published'}`);
console.log(`Written:   email/out/weekly-${email.stamp}.html (+ .txt)`);
