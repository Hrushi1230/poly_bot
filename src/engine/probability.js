// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — L2: Probability Math Utilities
// Time-decay, momentum, smart money scoring
// ═══════════════════════════════════════════════════════════

// ─── Exponential Time Decay ───
// S_weighted = S × C × e^(-λ × t)
// Older signals lose weight exponentially
export function exponentialDecay(sentimentScore, credibility, lambda, hoursAgo) {
  const decayFactor = Math.exp(-lambda * hoursAgo);
  return sentimentScore * credibility * decayFactor;
}

// ─── Calculate Time-Decayed Signal Strength ───
export function calculateDecayedSignals(signals, lambda) {
  if (!signals || signals.length === 0) return 0;

  let weightedSum = 0;
  let weightTotal = 0;

  for (const signal of signals) {
    const hoursAgo = (signal.ageMinutes || 0) / 60;
    const credibility = signal.credibility || 0.5;
    const sentiment = signal.sentiment || 0;

    const weight = credibility * Math.exp(-lambda * hoursAgo);
    weightedSum += sentiment * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

// ─── Price Momentum ───
// Analyzes recent price trend direction and magnitude
export function calculateMomentum(priceHistory) {
  if (!priceHistory || priceHistory.length < 3) {
    return { momentum: 0, trend: 'FLAT', strength: 0, volatility: 0 };
  }

  const prices = priceHistory.map(p => p.price);
  const n = prices.length;

  // Simple linear regression slope
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += prices[i];
    sumXY += i * prices[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const avgPrice = sumY / n;
  const normalizedSlope = avgPrice > 0 ? slope / avgPrice : 0;

  // Volatility (std dev of returns)
  const returns = [];
  for (let i = 1; i < n; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  const avgReturn = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
  const volatility = Math.sqrt(
    returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (returns.length || 1)
  );

  // Recent vs old comparison
  const recentAvg = prices.slice(-3).reduce((s, p) => s + p, 0) / 3;
  const oldAvg = prices.slice(0, 3).reduce((s, p) => s + p, 0) / 3;
  const momentum = oldAvg > 0 ? (recentAvg - oldAvg) / oldAvg : 0;

  let trend = 'FLAT';
  if (momentum > 0.03) trend = 'UP';
  if (momentum > 0.10) trend = 'STRONG_UP';
  if (momentum < -0.03) trend = 'DOWN';
  if (momentum < -0.10) trend = 'STRONG_DOWN';

  return {
    momentum: Math.max(-1, Math.min(1, momentum)),
    trend,
    strength: Math.abs(momentum),
    slope: normalizedSlope,
    volatility,
    currentPrice: prices[n - 1],
    priceChange: prices[n - 1] - prices[0]
  };
}

// ─── Smart Money Detection ───
// Large volume with minimal price impact = smart money
export function detectSmartMoney(orderBook, volume24hr) {
  if (!orderBook || !volume24hr) return { detected: false, signal: 0 };

  const depthToVolume = orderBook.totalDepth / Math.max(volume24hr, 1);
  const ofiMagnitude = Math.abs(orderBook.ofi || 0);

  // High depth relative to volume + strong OFI = smart money positioning
  const smartSignal = depthToVolume > 0.1 && ofiMagnitude > 0.2;

  return {
    detected: smartSignal,
    depthToVolume,
    ofiDirection: (orderBook.ofi || 0) > 0 ? 'BUYING' : 'SELLING',
    signal: smartSignal ? (orderBook.ofi > 0 ? 0.3 : -0.3) : 0
  };
}

// ─── Combine All Probability Factors ───
export function combineFactors(newsScore, volumeScore, momentumScore, weights) {
  const combined =
    newsScore * weights.news +
    volumeScore * weights.volume +
    momentumScore * weights.momentum;

  return Math.max(-1, Math.min(1, combined));
}
