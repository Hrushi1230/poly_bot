// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — L1: Alpha Detection Layer
// OFI (Order Flow Imbalance) + Correlated Market Divergence
// ═══════════════════════════════════════════════════════════

// ─── Order Flow Imbalance (OFI) ───
// Positive OFI = more buy pressure (bullish)
// Negative OFI = more sell pressure (bearish)
export function calculateOFI(orderBook) {
  const { bidDepth, askDepth } = orderBook;
  const total = bidDepth + askDepth;
  if (total === 0) return { ofi: 0, signal: 'NEUTRAL', strength: 0 };

  const ofi = (bidDepth - askDepth) / total; // Normalized -1 to +1

  let signal = 'NEUTRAL';
  if (ofi > 0.15) signal = 'BULLISH';
  if (ofi > 0.35) signal = 'STRONG_BULLISH';
  if (ofi < -0.15) signal = 'BEARISH';
  if (ofi < -0.35) signal = 'STRONG_BEARISH';

  return { ofi, signal, strength: Math.abs(ofi) };
}

// ─── Whale Detection ───
// Flag orders > 3σ above average size
export function detectWhaleOrders(orderBook) {
  const allOrders = [...(orderBook.bids || []), ...(orderBook.asks || [])];
  if (allOrders.length < 5) return { detected: false, whaleOrders: [] };

  const sizes = allOrders.map(o => parseFloat(o.size || 0));
  const mean = sizes.reduce((s, v) => s + v, 0) / sizes.length;
  const stdDev = Math.sqrt(sizes.reduce((s, v) => s + (v - mean) ** 2, 0) / sizes.length);
  const threshold = mean + 3 * stdDev;

  const whaleOrders = allOrders
    .filter(o => parseFloat(o.size || 0) > threshold)
    .map(o => ({
      price: parseFloat(o.price),
      size: parseFloat(o.size),
      side: orderBook.bids?.includes(o) ? 'BUY' : 'SELL',
      sizeVsAvg: parseFloat(o.size) / mean
    }));

  return {
    detected: whaleOrders.length > 0,
    whaleOrders,
    avgSize: mean,
    threshold
  };
}

// ─── Correlated Market Divergence ───
// Find markets with similar questions but different prices
export function findDivergence(targetMarket, allMarkets) {
  const targetWords = new Set(
    targetMarket.question.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  );

  const divergences = [];

  for (const market of allMarkets) {
    if (market.id === targetMarket.id) continue;

    const marketWords = new Set(
      market.question.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    // Calculate word overlap
    const overlap = [...targetWords].filter(w => marketWords.has(w)).length;
    const similarity = overlap / Math.max(targetWords.size, marketWords.size);

    if (similarity > 0.3) {
      // Related market found — check price consistency
      const targetPrice = parseFloat(targetMarket.outcomePrices?.[0] || 0.5);
      const relatedPrice = parseFloat(market.outcomePrices?.[0] || 0.5);
      const priceDiff = Math.abs(targetPrice - relatedPrice);

      divergences.push({
        relatedMarketId: market.id,
        relatedQuestion: market.question,
        similarity,
        targetPrice,
        relatedPrice,
        priceDifference: priceDiff,
        isDivergent: priceDiff > 0.15 // >15% diff between related markets
      });
    }
  }

  return divergences.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}

// ─── Full Alpha Scan ───
export function runAlphaScan(market, orderBook, allMarkets) {
  const ofi = calculateOFI(orderBook);
  const whales = detectWhaleOrders(orderBook);
  const divergences = findDivergence(market, allMarkets);

  // Compute alpha signal strength
  let alphaScore = 0;

  // OFI contributes
  if (ofi.signal.includes('STRONG')) alphaScore += ofi.ofi * 0.4;
  else alphaScore += ofi.ofi * 0.2;

  // Whale detection
  if (whales.detected) {
    const whaleSide = whales.whaleOrders[0]?.side;
    alphaScore += whaleSide === 'BUY' ? 0.15 : -0.15;
  }

  // Divergence
  const bigDivergence = divergences.find(d => d.isDivergent);
  if (bigDivergence) {
    alphaScore += 0.1; // Flag for attention
  }

  return {
    ofi,
    whales,
    divergences,
    alphaScore: Math.max(-1, Math.min(1, alphaScore)),
    hasAlpha: Math.abs(alphaScore) > 0.1
  };
}
