// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — GDELT News Signal Layer
// Translingual feed + mode-aware recency + credibility
// ═══════════════════════════════════════════════════════════

import { CONFIG } from '../config.js';

const { GDELT } = CONFIG.APIS;

// ─── Extract search keywords from market question ───
function extractKeywords(question) {
  const stopWords = new Set([
    'will', 'the', 'be', 'is', 'are', 'was', 'were', 'has', 'have', 'had',
    'do', 'does', 'did', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at',
    'to', 'for', 'of', 'with', 'by', 'from', 'as', 'into', 'through',
    'before', 'after', 'above', 'below', 'between', 'this', 'that', 'it',
    'not', 'no', 'yes', 'than', 'if', 'then', 'so', 'what', 'which',
    'who', 'whom', 'how', 'when', 'where', 'why', 'can', 'could',
    'would', 'should', 'may', 'might', 'shall'
  ]);

  const words = question
    .replace(/[?!.,;:'"()]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()))
    .map(w => w.toLowerCase());

  // Take top 5 most meaningful words
  return [...new Set(words)].slice(0, 5);
}

// ─── Fetch news from GDELT DOC 2.0 ───
export async function fetchNewsForMarket(marketQuestion, mode = 'SPRINT') {
  const maxAge = CONFIG[mode]?.NEWS_MAX_AGE_MIN || 30;
  const keywords = extractKeywords(marketQuestion);

  if (keywords.length === 0) return [];

  const query = keywords.join(' ');
  const startDate = new Date(Date.now() - maxAge * 60 * 1000);
  const startStr = startDate.toISOString().replace(/[-:T]/g, '').slice(0, 14);

  const url = `${GDELT}?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=50&format=json&startdatetime=${startStr}&trans=googtrans&sourcelang=english`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return [];

    const data = await res.json();
    const articles = (data.articles || []).map(article => ({
      title: article.title || '',
      url: article.url || '',
      source: article.domain || article.source || '',
      language: article.language || 'English',
      seendate: article.seendate || '',
      socialimage: article.socialimage || '',
      domain: extractDomain(article.url || article.domain || ''),
      ageMinutes: calculateAgeMinutes(article.seendate),
      credibility: getCredibility(article.url || article.domain || '')
    }));

    // Filter by max age and sort by recency
    return articles
      .filter(a => a.ageMinutes <= maxAge)
      .sort((a, b) => a.ageMinutes - b.ageMinutes);
  } catch (err) {
    console.log(`[NEWS] ⚠️ GDELT fetch failed: ${err.message}`);
    return [];
  }
}

// ─── Fetch translingual (non-English) sources ───
export async function fetchTranslingual(marketQuestion) {
  const keywords = extractKeywords(marketQuestion);
  if (keywords.length === 0) return [];

  const query = keywords.join(' ');
  const url = `${GDELT}?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=20&format=json&sourcelang=!english&trans=googtrans`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return [];

    const data = await res.json();
    return (data.articles || []).map(a => ({
      title: a.title || '',
      url: a.url || '',
      source: a.domain || '',
      language: a.language || 'Unknown',
      domain: extractDomain(a.url || a.domain || ''),
      ageMinutes: calculateAgeMinutes(a.seendate),
      credibility: getCredibility(a.url || a.domain || ''),
      translingual: true
    }));
  } catch {
    return [];
  }
}

// ─── Classify articles as PRO / ANTI signals ───
export function classifySignals(articles, sentimentScores = []) {
  const pro = [];
  const anti = [];
  const neutral = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const sentiment = sentimentScores[i] || 0;

    const signal = {
      title: article.title,
      source: article.domain,
      credibility: article.credibility,
      sentiment: sentiment,
      ageMinutes: article.ageMinutes,
      language: article.language
    };

    if (sentiment > 0.1) pro.push(signal);
    else if (sentiment < -0.1) anti.push(signal);
    else neutral.push(signal);
  }

  // Sort by credibility × |sentiment| (strongest signals first)
  const sortFn = (a, b) =>
    (b.credibility * Math.abs(b.sentiment)) - (a.credibility * Math.abs(a.sentiment));

  return {
    pro: pro.sort(sortFn),
    anti: anti.sort(sortFn),
    neutral: neutral.sort(sortFn),
    totalArticles: articles.length
  };
}

// ─── Extract top N signals ───
export function extractTopSignals(classified, count = 3) {
  return {
    topPro: classified.pro.slice(0, count),
    topAnti: classified.anti.slice(0, count),
    proCount: classified.pro.length,
    antiCount: classified.anti.length,
    totalArticles: classified.totalArticles
  };
}

// ─── Helpers ───

function extractDomain(urlOrDomain) {
  try {
    if (urlOrDomain.includes('://')) {
      return new URL(urlOrDomain).hostname.replace('www.', '');
    }
    return urlOrDomain.replace('www.', '');
  } catch {
    return urlOrDomain;
  }
}

function getCredibility(urlOrDomain) {
  const domain = extractDomain(urlOrDomain);
  for (const [key, score] of Object.entries(CONFIG.CREDIBILITY)) {
    if (domain.includes(key)) return score;
  }
  return CONFIG.CREDIBILITY.default;
}

function calculateAgeMinutes(seendate) {
  if (!seendate) return 9999;
  try {
    // GDELT format: YYYYMMDDTHHMMSSZ
    const year = seendate.slice(0, 4);
    const month = seendate.slice(4, 6);
    const day = seendate.slice(6, 8);
    const hour = seendate.slice(9, 11);
    const min = seendate.slice(11, 13);
    const sec = seendate.slice(13, 15);
    const dateStr = `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
    const published = new Date(dateStr);
    return (Date.now() - published.getTime()) / 60000;
  } catch {
    return 9999;
  }
}

// ─── Connection Test ───
export async function testConnection() {
  try {
    const url = `${GDELT}?query=test&mode=ArtList&maxrecords=1&format=json`;
    const res = await fetch(url);
    if (res.ok) return { success: true, message: 'GDELT OK' };
    return { success: false, message: `GDELT HTTP ${res.status}` };
  } catch (err) {
    return { success: false, message: `GDELT FAIL: ${err.message}` };
  }
}
