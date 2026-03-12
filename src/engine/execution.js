// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — L4: Execution Layer (5-Gate Kill Chain)
// Every trade must survive ALL 5 gates or it dies
// ═══════════════════════════════════════════════════════════

import { CONFIG } from '../config.js';

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

// ─── GATE 2: Edge Threshold ───
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

// ─── GATE 3: Confidence Check ───
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

// ─── GATE 4: Risk Budget ───
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

// ─── GATE 5: Position Size (Fractional Kelly) ───
export function gatePositionSize(analysis, balance, riskState) {
  const mode = analysis.mode || 'SPRINT';
  const modeConfig = CONFIG[mode];
  const edge = Math.abs(analysis.market_edge || 0);
  const confidence = analysis.confidence_score || 0;

  // Kelly Criterion: f* = edge / odds
  // Fractional Kelly: f = f* × fraction
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

// ─── MASTER: Run All 5 Gates ───
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

  const gates = [
    gateLiquidity(analysis),
    gateEdge(analysis),
    gateConfidence(analysis),
    gateRiskBudget(analysis, riskState),
    gatePositionSize(analysis, balance, riskState)
  ];

  const allPassed = gates.every(g => g.pass);
  const firstFail = gates.find(g => !g.pass);

  return {
    execute: allPassed,
    action: allPassed ? analysis.recommended_action : 'KILLED',
    reason: allPassed
      ? `All 5 gates passed — execute ${analysis.recommended_action}`
      : `KILLED at ${firstFail.gate}: ${firstFail.reason}`,
    gates,
    betSize: allPassed ? gates[4].details.betSizeUSD : 0,
    betPct: allPassed ? gates[4].details.betPct : 0,
    tier: allPassed ? gates[4].details.tier : 'KILLED',
    killedAt: firstFail?.gate || null
  };
}

function round(n) {
  return Math.round((n || 0) * 10000) / 10000;
}
