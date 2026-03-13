// ═══════════════════════════════════════════════════════════
// PolyAlpha v5.1 — L4: Execution Layer (6-Gate Kill Chain)
// Every trade must survive ALL 6 gates or it dies
// Gate 1: Liquidity | Gate 2: Spread Efficiency (30% Rule)
// Gate 3: Edge | Gate 4: Confidence | Gate 5: Risk Budget
// Gate 6: Position Size (Fractional Kelly)
// ═══════════════════════════════════════════════════════════

import { CONFIG } from '../config.js';
import { classifySpreadZone, spreadToEdgeGate, depthGuard, calculateExecutionPrice } from './spread-efficiency.js';

// ─── GATE 1: Liquidity Check ───
// Spread must be < 3%, 24h volume must be > $10,000
export function gateLiquidity(analysis) {
  const spread = analysis.market_health?.spread_pct || 1;
  const volume = analysis.market_health?.volume_24h || 0;

  const spreadOk = spread < CONFIG.SHARED.MAX_SPREAD;
  const volumeOk = volume > CONFIG.SHARED.MIN_24H_VOLUME;

  return {
    gate: 'LIQUIDITY',
    pass: spreadOk && volumeOk,
    reason: !spreadOk
      ? `Spread ${(spread * 100).toFixed(1)}% > ${CONFIG.SHARED.MAX_SPREAD * 100}% max`
      : !volumeOk
        ? `Volume $${volume.toFixed(0)} < $${CONFIG.SHARED.MIN_24H_VOLUME} min`
        : 'Liquidity OK',
    details: { spread, volume, spreadOk, volumeOk }
  };
}

// ─── GATE 2: Spread Efficiency (3-Zone + 30% Rule) ───
// Determines execution strategy and validates spread cost
export function gateSpreadEfficiency(analysis) {
  const spreadPct = analysis.market_health?.spread_pct || 0;
  const spreadValue = analysis.market_health?.spread || 0;
  const edge = Math.abs(analysis.market_edge || 0);

  // 1. Zone classification
  const zone = classifySpreadZone(spreadPct);

  // Auto-kill in red zone (> 2.5%)
  if (zone.strategy === 'AUTO_KILL') {
    return {
      gate: 'SPREAD_EFFICIENCY',
      pass: false,
      reason: `${zone.label}: Spread ${(spreadPct * 100).toFixed(2)}% > 2.5% — too wide`,
      details: { zone, spreadPct, spreadValue, edge }
    };
  }

  // 2. Spread-to-Edge 30% Rule
  const edgeGate = spreadToEdgeGate(spreadValue, edge);
  if (!edgeGate.pass) {
    return {
      gate: 'SPREAD_EFFICIENCY',
      pass: false,
      reason: edgeGate.reason,
      details: { zone, spreadToEdge: edgeGate, spreadPct, spreadValue, edge }
    };
  }

  return {
    gate: 'SPREAD_EFFICIENCY',
    pass: true,
    reason: `${zone.label} | ${edgeGate.reason}`,
    details: {
      zone,
      strategy: zone.strategy,
      spreadToEdge: edgeGate,
      spreadPct,
      spreadValue,
      edge
    }
  };
}

// ─── GATE 3: Edge Threshold ───
// Edge must exceed mode-specific threshold
export function gateEdge(analysis) {
  const edge = Math.abs(analysis.market_edge || 0);
  const threshold = CONFIG[analysis.mode]?.EDGE_THRESHOLD || 0.08;

  return {
    gate: 'EDGE',
    pass: edge > threshold,
    reason: edge > threshold
      ? `Edge ${(edge * 100).toFixed(1)}% > ${(threshold * 100)}% threshold`
      : `Edge ${(edge * 100).toFixed(1)}% < ${(threshold * 100)}% threshold — too weak`,
    details: { edge, threshold }
  };
}

// ─── GATE 4: Confidence Check ───
// Must be above minimum confidence (0.70)
export function gateConfidence(analysis) {
  const confidence = analysis.confidence_score || 0;
  const minConfidence = CONFIG.SHARED.MIN_CONFIDENCE;

  return {
    gate: 'CONFIDENCE',
    pass: confidence >= minConfidence,
    reason: confidence >= minConfidence
      ? `Confidence ${(confidence * 100).toFixed(0)}% ≥ ${(minConfidence * 100)}% min`
      : `Confidence ${(confidence * 100).toFixed(0)}% < ${(minConfidence * 100)}% — signal too weak`,
    details: { confidence, minConfidence }
  };
}

// ─── GATE 5: Risk Budget ───
// Daily trade limit, open trades cap, drawdown checks
export function gateRiskBudget(analysis, riskState) {
  const tradesToday = riskState.tradesToday || 0;
  const openTrades = riskState.openTrades || 0;
  const dailyPnL = riskState.dailyPnLPct || 0;
  const totalPnL = riskState.totalPnLPct || 0;

  const checks = [
    {
      name: 'daily_trade_limit',
      pass: tradesToday < CONFIG.SHARED.MAX_TRADES_PER_DAY,
      reason: `${tradesToday}/${CONFIG.SHARED.MAX_TRADES_PER_DAY} trades today`
    },
    {
      name: 'open_trades_cap',
      pass: openTrades < CONFIG.SHARED.MAX_OPEN_TRADES,
      reason: `${openTrades}/${CONFIG.SHARED.MAX_OPEN_TRADES} open trades`
    },
    {
      name: 'daily_drawdown',
      pass: dailyPnL > -CONFIG.SHARED.MAX_DAILY_DRAWDOWN,
      reason: `Daily P&L: ${(dailyPnL * 100).toFixed(1)}% (limit: -${CONFIG.SHARED.MAX_DAILY_DRAWDOWN * 100}%)`
    },
    {
      name: 'total_drawdown',
      pass: totalPnL > -CONFIG.SHARED.MAX_TOTAL_DRAWDOWN,
      reason: `Total P&L: ${(totalPnL * 100).toFixed(1)}% (limit: -${CONFIG.SHARED.MAX_TOTAL_DRAWDOWN * 100}%)`
    }
  ];

  const failedCheck = checks.find(c => !c.pass);

  return {
    gate: 'RISK_BUDGET',
    pass: !failedCheck,
    reason: failedCheck
      ? `BLOCKED: ${failedCheck.reason}`
      : 'Risk budget OK',
    details: { checks, tradesToday, openTrades, dailyPnL, totalPnL }
  };
}

// ─── GATE 6: Position Size (Fractional Kelly) ───
export function gatePositionSize(analysis, balance, riskState) {
  const mode = analysis.mode || 'SPRINT';
  const modeConfig = CONFIG[mode] || CONFIG.SPRINT;
  const edge = Math.abs(analysis.market_edge || 0);
  const confidence = analysis.confidence_score || 0;

  // Kelly Criterion: f* = edge / odds
  const odds = analysis.recommended_action === 'BUY_YES'
    ? (1 / analysis.market_price) - 1
    : (1 / (1 - analysis.market_price)) - 1;

  const kellyFull = odds > 0 ? edge / odds : 0;
  const kellyFractional = kellyFull * modeConfig.KELLY_FRACTION;

  // Confidence-tiered multiplier
  const tier = CONFIG.CONFIDENCE_TIERS.find(
    t => confidence >= t.min && confidence <= t.max
  ) || CONFIG.CONFIDENCE_TIERS[CONFIG.CONFIDENCE_TIERS.length - 1];

  const tieredSize = kellyFractional * tier.multiplier;

  // Final bet size (capped at mode max)
  const maxBet = balance * modeConfig.MAX_BET_PCT;
  const betSize = Math.min(tieredSize * balance, maxBet);
  const betPct = betSize / balance;

  // Must be at least $1 to be worth trading
  const pass = betSize >= 1 && tier.multiplier > 0;

  return {
    gate: 'POSITION_SIZE',
    pass,
    reason: pass
      ? `Bet $${betSize.toFixed(2)} (${(betPct * 100).toFixed(1)}% of balance, ${tier.label} tier)`
      : tier.multiplier === 0
        ? `KILLED: Confidence ${(confidence * 100).toFixed(0)}% below ${CONFIG.SHARED.MIN_CONFIDENCE * 100}%`
        : `Bet too small: $${betSize.toFixed(2)}`,
    details: {
      kellyFull: round(kellyFull),
      kellyFractional: round(kellyFractional),
      tier: tier.label,
      tierMultiplier: tier.multiplier,
      betSizeUSD: round(betSize),
      betPct: round(betPct),
      maxBetUSD: round(maxBet)
    }
  };
}

// ─── GATE 6.5: Depth Guard (post-sizing) ───
// Checks if the calculated bet size is safe given order book depth
export function gateDepthGuard(analysis, betSizeUSD) {
  // Use order book data from analysis if available
  const orderBookData = analysis.orderBook || analysis.market_health?.orderBook;
  if (!orderBookData) {
    return {
      gate: 'DEPTH_GUARD',
      pass: true,  // Skip if no book data (don't kill)
      reason: 'No book data — depth guard skipped',
      details: { betSizeUSD },
      adjustedBetSize: betSizeUSD
    };
  }

  const side = analysis.recommended_action === 'BUY_YES' ? 'buy' : 'sell';
  const check = depthGuard(orderBookData, betSizeUSD, side);

  return {
    gate: 'DEPTH_GUARD',
    pass: true,  // Never kill, just reduce size
    reason: check.reason,
    details: {
      ...check,
      betSizeUSD,
      originalBet: betSizeUSD,
    },
    adjustedBetSize: check.pass ? betSizeUSD : check.maxSafeSize
  };
}

// ─── MASTER: Run All 6 Gates + Depth Guard ───
export function runKillChain(analysis, balance, riskState) {
  if (analysis.recommended_action === 'HOLD' || analysis.skipped) {
    return {
      execute: false,
      action: 'HOLD',
      reason: analysis.skipped ? analysis.key_signal : 'No edge detected',
      gates: [],
      betSize: 0
    };
  }

  // Run gates 1-6
  const gate1 = gateLiquidity(analysis);
  const gate2 = gateSpreadEfficiency(analysis);
  const gate3 = gateEdge(analysis);
  const gate4 = gateConfidence(analysis);
  const gate5 = gateRiskBudget(analysis, riskState);
  const gate6 = gatePositionSize(analysis, balance, riskState);

  const gates = [gate1, gate2, gate3, gate4, gate5, gate6];
  const allPassed = gates.every(g => g.pass);
  const firstFail = gates.find(g => !g.pass);

  if (!allPassed) {
    return {
      execute: false,
      action: 'KILLED',
      reason: `KILLED at ${firstFail.gate}: ${firstFail.reason}`,
      gates,
      betSize: 0,
      betPct: 0,
      tier: 'KILLED',
      killedAt: firstFail.gate
    };
  }

  // Post-sizing: Depth Guard (adjusts bet size if needed, never kills)
  let finalBetSize = gate6.details.betSizeUSD;
  const depthCheck = gateDepthGuard(analysis, finalBetSize);
  finalBetSize = depthCheck.adjustedBetSize || finalBetSize;
  gates.push(depthCheck);

  // Determine execution strategy from spread zone
  const execStrategy = gate2.details?.strategy || 'AGGRESSIVE_LIMIT';

  return {
    execute: true,
    action: analysis.recommended_action,
    reason: `All 6 gates passed — ${execStrategy} execution`,
    gates,
    betSize: finalBetSize,
    betPct: finalBetSize / balance,
    tier: gate6.details.tier,
    killedAt: null,
    executionStrategy: execStrategy,
    spreadZone: gate2.details?.zone?.zone || 'UNKNOWN'
  };
}

function round(n) {
  return Math.round((n || 0) * 10000) / 10000;
}
