// ═══════════════════════════════════════════════════════════
// PolyAlpha v5.1 — Advanced Spread Efficiency Engine
// 3-Zone Execution | 30% Rule | Depth Guard | Kyle's Lambda
// ═══════════════════════════════════════════════════════════

import { CONFIG } from '../config.js';
import { fetchOrderBook, fetchMidpoint } from '../data/polymarket.js';

// ═══════════════════════════════════════════
// ZONE THRESHOLDS
// ═══════════════════════════════════════════
const ZONES = {
  EFFICIENCY:  0.01,    // < 1% = green zone (aggressive limit)
  MIDPOINT:    0.025,   // 1% - 2.5% = yellow zone (passive pegging)
  // > 2.5% = red zone (auto-kill)
};

const SPREAD_TO_EDGE_RATIO = 0.30;   // 30% Rule: spread must be < 30% of edge
const MAX_LIQUIDITY_USAGE = 0.10;    // Depth Guard: never use > 10% of book depth

// ═══════════════════════════════════════════
// 1. SPREAD ZONE CLASSIFIER
// Determines execution style based on spread width
// ═══════════════════════════════════════════
export function classifySpreadZone(spreadPct) {
  if (spreadPct < ZONES.EFFICIENCY) {
    return {
      zone: 'GREEN',
      label: '🟢 Efficiency Zone',
      strategy: 'AGGRESSIVE_LIMIT',
      description: 'Tight spread — place limit at best ask/bid for instant fill'
    };
  }
  if (spreadPct <= ZONES.MIDPOINT) {
    return {
      zone: 'YELLOW',
      label: '🟡 Mid-Point Zone',
      strategy: 'PASSIVE_MIDPOINT',
      description: 'Medium spread — place limit at midpoint, wait for fill'
    };
  }
  return {
    zone: 'RED',
    label: '🔴 Danger Zone',
    strategy: 'AUTO_KILL',
    description: `Spread ${(spreadPct * 100).toFixed(2)}% > 2.5% — too wide, abort`
  };
}

// ═══════════════════════════════════════════
// 2. SPREAD-TO-EDGE GATE (30% Rule)
// The spread must never exceed 30% of the edge
// ═══════════════════════════════════════════
export function spreadToEdgeGate(spreadValue, edgeValue) {
  const maxAcceptableSpread = edgeValue * SPREAD_TO_EDGE_RATIO;
  const ratio = edgeValue > 0 ? spreadValue / edgeValue : 1;
  const pass = spreadValue <= maxAcceptableSpread;

  return {
    pass,
    ratio: parseFloat(ratio.toFixed(4)),
    maxAcceptableSpread: parseFloat(maxAcceptableSpread.toFixed(4)),
    actualSpread: parseFloat(spreadValue.toFixed(4)),
    reason: pass
      ? `Spread ${(spreadValue * 100).toFixed(1)}¢ is ${(ratio * 100).toFixed(0)}% of edge (< 30% max)`
      : `KILLED: Spread ${(spreadValue * 100).toFixed(1)}¢ devours ${(ratio * 100).toFixed(0)}% of edge (max 30%)`
  };
}

// ═══════════════════════════════════════════
// 3. DEPTH GUARD (Kyle's Lambda)
// Prevent orders that would cause slippage
// ═══════════════════════════════════════════
export function depthGuard(orderBook, betSizeUSD, side = 'buy') {
  if (!orderBook) {
    return { pass: false, reason: 'No order book data', maxSafeSize: 0 };
  }

  const relevantSide = side === 'buy' ? orderBook.asks : orderBook.bids;
  if (!relevantSide || relevantSide.length === 0) {
    return { pass: false, reason: 'Empty order book', maxSafeSize: 0 };
  }

  // Calculate depth for top 3 price levels
  const top3 = relevantSide.slice(0, 3);
  const top3Depth = top3.reduce((sum, o) => sum + (o.price * o.size), 0);
  const totalDepth = relevantSide.reduce((sum, o) => sum + (o.price * o.size), 0);

  // Max safe size = 10% of available depth at top 3 levels
  const maxSafeSize = top3Depth * MAX_LIQUIDITY_USAGE;
  const usagePct = top3Depth > 0 ? betSizeUSD / top3Depth : 1;
  const pass = betSizeUSD <= maxSafeSize;

  // Kyle's Lambda estimate (price impact per dollar)
  // λ = ΔPrice / ΔVolume, approximated from book structure
  const kyleLambda = top3Depth > 0
    ? (relevantSide[relevantSide.length > 1 ? 1 : 0]?.price - relevantSide[0]?.price) / top3Depth
    : 0;
  const estimatedImpact = Math.abs(kyleLambda) * betSizeUSD;

  return {
    pass,
    maxSafeSize: parseFloat(maxSafeSize.toFixed(2)),
    top3Depth: parseFloat(top3Depth.toFixed(2)),
    totalDepth: parseFloat(totalDepth.toFixed(2)),
    usagePct: parseFloat((usagePct * 100).toFixed(1)),
    kyleLambda: parseFloat(Math.abs(kyleLambda).toFixed(6)),
    estimatedImpact: parseFloat((estimatedImpact * 100).toFixed(2)),
    reason: pass
      ? `Order uses ${(usagePct * 100).toFixed(1)}% of top-3 depth ($${top3Depth.toFixed(0)}) — safe`
      : `KILLED: Order $${betSizeUSD.toFixed(0)} would use ${(usagePct * 100).toFixed(1)}% of depth (max 10%). Reduce to $${maxSafeSize.toFixed(0)}`
  };
}

// ═══════════════════════════════════════════
// 4. OPTIMAL EXECUTION PRICE CALCULATOR
// Returns the exact price to place the order at
// ═══════════════════════════════════════════
export function calculateExecutionPrice(orderBook, zone, side = 'buy') {
  if (!orderBook) return null;

  const bestBid = orderBook.bestBid || 0;
  const bestAsk = orderBook.bestAsk || 1;
  const midpoint = orderBook.midpoint || (bestBid + bestAsk) / 2;

  switch (zone.strategy) {
    case 'AGGRESSIVE_LIMIT':
      // Place at best ask (buy) or best bid (sell) for instant fill
      return {
        price: side === 'buy' ? bestAsk : bestBid,
        type: 'AGGRESSIVE_LIMIT',
        label: `${side === 'buy' ? 'Ask' : 'Bid'} ${(side === 'buy' ? bestAsk : bestBid).toFixed(4)}`
      };

    case 'PASSIVE_MIDPOINT':
      // Place at midpoint — save on spread, wait for fill
      return {
        price: midpoint,
        type: 'PASSIVE_MIDPOINT',
        label: `Midpoint ${midpoint.toFixed(4)}`,
        savedVsAggressive: side === 'buy'
          ? parseFloat(((bestAsk - midpoint) * 100).toFixed(2))
          : parseFloat(((midpoint - bestBid) * 100).toFixed(2))
      };

    case 'AUTO_KILL':
    default:
      return null;
  }
}

// ═══════════════════════════════════════════
// 5. MASTER VALIDATION (runs all checks)
// ═══════════════════════════════════════════
export async function validateSpreadEfficiency(tokenId, edge, betSizeUSD, side = 'buy') {
  const result = {
    pass: false,
    zone: null,
    spreadToEdge: null,
    depthCheck: null,
    executionPrice: null,
    adjustedBetSize: betSizeUSD,
    reason: ''
  };

  try {
    // 1. Fetch order book
    let orderBook;
    try {
      orderBook = await fetchOrderBook(tokenId);
    } catch {
      result.reason = 'Could not fetch order book — spread check skipped';
      result.pass = true; // Don't kill trade just because book fetch failed
      return result;
    }

    const spreadPct = orderBook.spreadPct || 0;
    const spreadValue = orderBook.spread || 0;

    // 2. Zone classification
    result.zone = classifySpreadZone(spreadPct);

    // Auto-kill in red zone
    if (result.zone.strategy === 'AUTO_KILL') {
      result.reason = result.zone.description;
      return result;
    }

    // 3. Spread-to-Edge 30% Rule
    result.spreadToEdge = spreadToEdgeGate(spreadValue, Math.abs(edge));
    if (!result.spreadToEdge.pass) {
      result.reason = result.spreadToEdge.reason;
      return result;
    }

    // 4. Depth Guard
    result.depthCheck = depthGuard(orderBook, betSizeUSD, side);
    if (!result.depthCheck.pass) {
      // Don't kill — reduce bet size to safe level
      result.adjustedBetSize = result.depthCheck.maxSafeSize;
      result.reason = `Bet reduced from $${betSizeUSD.toFixed(0)} to $${result.depthCheck.maxSafeSize.toFixed(0)} (depth guard)`;
    }

    // 5. Calculate execution price
    result.executionPrice = calculateExecutionPrice(orderBook, result.zone, side);

    result.pass = true;
    result.reason = `${result.zone.label} | ${result.spreadToEdge.reason}`;

    return result;

  } catch (err) {
    result.pass = true; // Don't kill on error
    result.reason = `Spread check error: ${err.message} — proceeding cautiously`;
    return result;
  }
}
