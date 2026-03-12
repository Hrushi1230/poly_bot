// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — L2: Sentiment Engine
// VADER + Custom Financial Dictionary + natural NLP
// ═══════════════════════════════════════════════════════════

import vader from 'vader-sentiment';
import natural from 'natural';
import { CONFIG } from '../config.js';

const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;

// ─── Financial-Aware Sentiment Scoring ───
export function analyzeSentiment(text) {
  if (!text || text.trim().length === 0) {
    return { compound: 0, financeSentiment: 0, combined: 0, tokens: [] };
  }

  const lowerText = text.toLowerCase();

  // 1. VADER base sentiment
  const vaderResult = vader.SentimentIntensityAnalyzer.polarity_scores(text);
  const vaderCompound = vaderResult.compound; // -1 to +1

  // 2. Financial dictionary overlay (fixes VADER's finance blindness)
  let financeScore = 0;
  let financeHits = 0;

  for (const [term, score] of Object.entries(CONFIG.FINANCE_SENTIMENT)) {
    if (lowerText.includes(term)) {
      financeScore += score;
      financeHits++;
    }
  }

  // Average financial hits
  if (financeHits > 0) financeScore = financeScore / financeHits;

  // 3. Combine: finance dictionary gets priority when it fires
  let combined;
  if (financeHits > 0) {
    combined = financeScore * 0.7 + vaderCompound * 0.3;
  } else {
    combined = vaderCompound;
  }

  // Clamp to -1, +1
  combined = Math.max(-1, Math.min(1, combined));

  // 4. Tokenize
  const tokens = tokenizer.tokenize(lowerText) || [];

  return {
    compound: vaderCompound,
    financeSentiment: financeScore,
    financeHits,
    combined,
    tokens
  };
}

// ─── Classify Article as PRO / ANTI / NEUTRAL ───
export function classifyArticle(article) {
  const sentiment = analyzeSentiment(article.title);

  let classification = 'NEUTRAL';
  if (sentiment.combined > 0.15) classification = 'PRO';
  if (sentiment.combined < -0.15) classification = 'ANTI';

  return {
    ...article,
    sentiment: sentiment.combined,
    vaderScore: sentiment.compound,
    financeScore: sentiment.financeSentiment,
    classification,
    tokens: sentiment.tokens
  };
}

// ─── Batch Analyze Articles ───
export function batchAnalyze(articles) {
  return articles.map(article => classifyArticle(article));
}

// ─── Extract Key Topics via TF-IDF ───
export function extractKeyTopics(articles) {
  const tfidf = new TfIdf();

  for (const article of articles) {
    tfidf.addDocument(article.title || '');
  }

  const topics = [];
  if (articles.length > 0) {
    tfidf.listTerms(0).slice(0, 10).forEach(item => {
      topics.push({ term: item.term, tfidf: item.tfidf });
    });
  }

  return topics;
}

// ─── Aggregate Sentiment Score ───
export function aggregateSentiment(analyzedArticles) {
  if (analyzedArticles.length === 0) {
    return { avgSentiment: 0, proCount: 0, antiCount: 0, neutralCount: 0, strength: 0 };
  }

  let total = 0;
  let proCount = 0;
  let antiCount = 0;
  let neutralCount = 0;

  for (const a of analyzedArticles) {
    total += a.sentiment;
    if (a.classification === 'PRO') proCount++;
    else if (a.classification === 'ANTI') antiCount++;
    else neutralCount++;
  }

  const avgSentiment = total / analyzedArticles.length;
  const agreement = Math.max(proCount, antiCount) / analyzedArticles.length;

  return {
    avgSentiment,
    proCount,
    antiCount,
    neutralCount,
    agreement,
    strength: Math.abs(avgSentiment) * agreement,
    direction: avgSentiment > 0 ? 'BULLISH' : avgSentiment < 0 ? 'BEARISH' : 'NEUTRAL'
  };
}
