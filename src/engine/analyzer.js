// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — L3: Master Analyzer (6-Step Pipeline)
// Time-decay signals → Bayesian update → Slippage-adj edge
// ═══════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config.js';
import { fetchOrderBook, fetchPriceHistory, calculateSlippage } from '../data/polymarket.js';
import { fetchNewsForMarket, fetchTranslingual, classifySignals, extractTopSignals } from '../data/news.js';
import { batchAnalyze, aggregateSentiment } from './sentiment.js';
import { calculateDecayedSignals, calculateMomentum, detectSmartMoney } from './probability.js';
import { runAlphaScan } from './alpha.js';
import { aggregateSignals, calculatePosterior, calculateConfidence } from './bayesian.js';

// ─── Full 6-Step Analysis Pipeline ───
export async function analyzeMarket(market, allMarkets = [], balance = 1000) {
  const mode = market.mode || 'SPRINT';
  const modeConfig = CONFIG[mode];
  const tokenId = market.clobTokenIds?.[0];

  if (!tokenId) {
    return createSkippedResult(market, 'No token ID available');
  }

  try {
    // ═══ STEP 1: Alpha Scan (L1) ═══
    let orderBook, priceHistory;
    try {
      orderBook = await fetchOrderBook(tokenId);
    } catch {
      orderBook = { bids: [], asks: [], bestBid: 0, bestAsk: 1, spread: 1, spreadPct: 1, midpoint: 0.5, bidDepth: 0, askDepth: 0, totalDepth: 0, ofi: 0 };
    }

    try {
      priceHistory = await fetchPriceHistory(tokenId);
    } catch {
      priceHistory = [];
    }

    const alphaScan = runAlphaScan(market, orderBook, allMarkets);

    // ═══ STEP 2: Evidence Extraction (L2) ═══
    const [newsArticles, transArticles] = await Promise.all([
      fetchNewsForMarket(market.question, mode),
      mode === 'SPRINT' ? fetchTranslingual(market.question) : Promise.resolve([])
    ]);

    const allArticles = [...newsArticles, ...transArticles];
    const analyzedArticles = batchAnalyze(allArticles);
    const sentimentAgg = aggregateSentiment(analyzedArticles);

    // ═══ STEP 3: Time-Decayed Signal Strength ═══
    const decayedNewsScore = calculateDecayedSignals(
      analyzedArticles.map(a => ({
        sentiment: a.sentiment,
        credibility: a.credibility,
        ageMinutes: a.ageMinutes
      })),
      modeConfig.DECAY_LAMBDA
    );

    // ═══ STEP 4: Bayesian Probability Update ═══
    const momentum = calculateMomentum(priceHistory);
    const smartMoney = detectSmartMoney(orderBook, market.volume24hr);

    const signals = aggregateSignals(
      decayedNewsScore,
      smartMoney.signal + (alphaScan.alphaScore * 0.5),
      momentum.momentum,
      alphaScan.alphaScore,
      mode
    );

    // Parse market price
    let marketPrice;
    try {
      const prices = typeof market.outcomePrices === 'string'
        ? JSON.parse(market.outcomePrices)
        : market.outcomePrices;
      marketPrice = parseFloat(prices?.[0] || 0.5);
    } catch {
      marketPrice = 0.5;
    }

    const internalProb = calculatePosterior(marketPrice, signals, mode);

    // ═══ STEP 5: Slippage-Adjusted Edge ═══
    const betSize = balance * modeConfig.MAX_BET_PCT;
    const slippageResult = calculateSlippage(orderBook, betSize, internalProb > marketPrice ? 'buy' : 'sell');

    const rawEdge = internalProb - marketPrice;
    const slippageCost = slippageResult.slippage || 0;
    const adjustedEdge = rawEdge > 0
      ? rawEdge - slippageCost
      : rawEdge + slippageCost;

    // ═══ STEP 6: Classify Signals + Build Output ═══
    const sentimentScores = analyzedArticles.map(a => a.sentiment);
    const classified = classifySignals(allArticles, sentimentScores);
    const topSignals = extractTopSignals(classified);

    const avgCredibility = analyzedArticles.length > 0
      ? analyzedArticles.reduce((s, a) => s + a.credibility, 0) / analyzedArticles.length
      : 0.5;

    const confidence = calculateConfidence(signals, allArticles.length, avgCredibility);

    // ═══ DETERMINE ACTION ═══
    let action = 'HOLD';
    if (adjustedEdge > modeConfig.EDGE_THRESHOLD && confidence >= CONFIG.SHARED.MIN_CONFIDENCE) {
      action = 'BUY_YES';
    } else if (adjustedEdge < -modeConfig.EDGE_THRESHOLD && confidence >= CONFIG.SHARED.MIN_CONFIDENCE) {
      action = 'BUY_NO';
    }

    // Key signal summary
    const keySignal = topSignals.topPro.length > 0
      ? topSignals.topPro[0].title
      : topSignals.topAnti.length > 0
        ? topSignals.topAnti[0].title
        : 'No strong signals detected';

    // Reasoning
    const reasoning = buildReasoning(mode, internalProb, marketPrice, adjustedEdge, confidence, action, sentimentAgg);

    return {
      analysis_id: uuidv4(),
      market_name: market.question,
      market_id: market.id,
      mode,
      internal_probability: round(internalProb),
      market_price: round(marketPrice),
      raw_edge: round(rawEdge),
      slippage_cost: round(slippageCost),
      market_edge: round(adjustedEdge),
      confidence_score: round(confidence),
      key_signal: keySignal.slice(0, 120),
      reasoning_brief: reasoning,
      recommended_action: action,
      signals: {
        news: round(decayedNewsScore),
        volume: round(smartMoney.signal + alphaScan.alphaScore * 0.5),
        momentum: round(momentum.momentum),
        alpha: round(alphaScan.alphaScore)
      },
      market_health: {
        spread_pct: round(orderBook.spreadPct),
        volume_24h: round(market.volume24hr),
        ofi: round(orderBook.ofi),
        volatility: round(momentum.volatility),
        liquidity: round(orderBook.totalDepth)
      },
      top_signals: topSignals,
      articles_analyzed: allArticles.length,
      hours_to_resolution: round(market.hoursLeft),
      timestamp: new Date().toISOString()
    };

  } catch (err) {
    return createSkippedResult(market, `Analysis error: ${err.message}`);
  }
}

// ─── Batch Analyze Multiple Markets ───
export async function analyzeMarkets(markets, allMarkets = [], balance = 1000) {
  const results = [];

  for (const market of markets) {
    const result = await analyzeMarket(market, allMarkets, balance);
    results.push(result);

    // Rate limiting — 200ms between markets
    await new Promise(r => setTimeout(r, 200));
  }

  return results;
}

// ─── Helpers ───

function round(n) {
  return Math.round((n || 0) * 10000) / 10000;
}

function createSkippedResult(market, reason) {
  return {
    analysis_id: uuidv4(),
    market_name: market.question || 'Unknown',
    market_id: market.id,
    mode: market.mode || 'UNKNOWN',
    internal_probability: 0,
    market_price: 0,
    market_edge: 0,
    confidence_score: 0,
    key_signal: reason,
    reasoning_brief: reason,
    recommended_action: 'HOLD',
    skipped: true,
    timestamp: new Date().toISOString()
  };
}

function buildReasoning(mode, internalProb, marketPrice, edge, confidence, action, sentiment) {
  const dir = edge > 0 ? 'undervalued' : edge < 0 ? 'overvalued' : 'fair';
  const conf = confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low';
  return `${mode} ${dir} by ${Math.abs(edge * 100).toFixed(1)}%, ${conf} confidence, ${sentiment.direction} news, ${action}`;
}
