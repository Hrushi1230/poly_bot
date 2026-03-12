// ═══════════════════════════════════════════════════════════
// PolyAlpha v5.1 — Exit Manager (Profit-Taking Scalper)
// Monitors open trades for take-profit, stop-loss, trailing
// ═══════════════════════════════════════════════════════════

import { CONFIG } from '../config.js';
import { fetchMidpoint } from '../data/polymarket.js';

// ─── In-memory open positions ───
const openPositions = [];
const closedPositions = [];

// ─── Add a new position to monitor ───
export function addPosition(trade) {
  const mode = trade.mode || 'SPRINT';
  const modeConfig = CONFIG[mode] || CONFIG.SPRINT;
  const spread = trade.spread || 0.02;

  openPositions.push({
    id: trade.id,
    market_name: trade.market_name,
    tokenId: trade.tokenId,
    mode: mode,
    side: trade.side,           // 'YES' or 'NO'
    entryPrice: trade.entryPrice,
    shares: trade.shares || 0,
    betSize: trade.betSize || 0,
    spread: spread,
    // Spread-adjusted targets
    takeProfitPrice: trade.side === 'YES'
      ? trade.entryPrice + modeConfig.TAKE_PROFIT + spread
      : trade.entryPrice - modeConfig.TAKE_PROFIT - spread,
    stopLossPrice: trade.side === 'YES'
      ? trade.entryPrice - modeConfig.STOP_LOSS + spread
      : trade.entryPrice + modeConfig.STOP_LOSS - spread,
    trailingDist: modeConfig.TRAILING_STOP,
    maxHoldHours: modeConfig.MAX_HOLD_HOURS,
    // Tracking
    peakPrice: trade.entryPrice,
    trailingStopPrice: null,
    entryTime: Date.now(),
    lastChecked: Date.now()
  });
}

// ─── Check all open positions for exit signals ───
export async function checkExits() {
  const toClose = [];

  for (let i = openPositions.length - 1; i >= 0; i--) {
    const pos = openPositions[i];
    let currentPrice;

    try {
      if (pos.tokenId) {
        currentPrice = await fetchMidpoint(pos.tokenId);
      } else {
        // No token ID — skip live price check, use time-based exit only
        currentPrice = pos.entryPrice;
      }
    } catch {
      continue; // Skip if price fetch fails
    }

    const hoursHeld = (Date.now() - pos.entryTime) / 3600000;
    const isYes = pos.side === 'YES';
    const priceDelta = isYes
      ? currentPrice - pos.entryPrice
      : pos.entryPrice - currentPrice;
    const netPnL = priceDelta - pos.spread;

    // Update peak price for trailing stop
    if (isYes && currentPrice > pos.peakPrice) {
      pos.peakPrice = currentPrice;
      pos.trailingStopPrice = currentPrice - pos.trailingDist;
    } else if (!isYes && currentPrice < pos.peakPrice) {
      pos.peakPrice = currentPrice;
      pos.trailingStopPrice = currentPrice + pos.trailingDist;
    }

    let exitReason = null;

    // ─── Take Profit ───
    if (isYes && currentPrice >= pos.takeProfitPrice) {
      exitReason = 'TAKE_PROFIT';
    } else if (!isYes && currentPrice <= pos.takeProfitPrice) {
      exitReason = 'TAKE_PROFIT';
    }

    // ─── Stop Loss ───
    if (!exitReason) {
      if (isYes && currentPrice <= pos.stopLossPrice) {
        exitReason = 'STOP_LOSS';
      } else if (!isYes && currentPrice >= pos.stopLossPrice) {
        exitReason = 'STOP_LOSS';
      }
    }

    // ─── Trailing Stop ───
    if (!exitReason && pos.trailingStopPrice !== null) {
      if (isYes && currentPrice <= pos.trailingStopPrice && priceDelta > 0) {
        exitReason = 'TRAILING_STOP';
      } else if (!isYes && currentPrice >= pos.trailingStopPrice && priceDelta > 0) {
        exitReason = 'TRAILING_STOP';
      }
    }

    // ─── Max Hold Time ───
    if (!exitReason && hoursHeld >= pos.maxHoldHours) {
      exitReason = 'MAX_HOLD_TIME';
    }

    if (exitReason) {
      const exitRecord = {
        ...pos,
        exitPrice: currentPrice,
        exitReason,
        exitTime: Date.now(),
        hoursHeld: parseFloat(hoursHeld.toFixed(2)),
        grossPnL: parseFloat((priceDelta * (pos.shares || 1)).toFixed(4)),
        netPnL: parseFloat((netPnL * (pos.shares || 1)).toFixed(4)),
        pnlPerShare: parseFloat(netPnL.toFixed(4)),
        pnlPct: parseFloat(((netPnL / pos.entryPrice) * 100).toFixed(2))
      };

      closedPositions.push(exitRecord);
      openPositions.splice(i, 1);
      toClose.push(exitRecord);

      const emoji = exitReason === 'TAKE_PROFIT' ? '💰'
        : exitReason === 'TRAILING_STOP' ? '📈'
        : exitReason === 'STOP_LOSS' ? '🛑'
        : '⏰';
      console.log(`[EXIT] ${emoji} ${exitReason}: ${pos.market_name.slice(0, 40)} | ${netPnL > 0 ? '+' : ''}${(netPnL * 100).toFixed(1)}¢/share | Held ${hoursHeld.toFixed(1)}h`);
    }

    pos.lastChecked = Date.now();
    await new Promise(r => setTimeout(r, 300));
  }

  return toClose;
}

// ─── Get current state ───
export function getOpenPositions() {
  return openPositions.map(p => ({
    ...p,
    hoursHeld: parseFloat(((Date.now() - p.entryTime) / 3600000).toFixed(2)),
    currentPnL: null // Will be populated by live price check
  }));
}

export function getClosedPositions(limit = 50) {
  return closedPositions.slice(-limit).reverse();
}

export function getExitStats() {
  if (closedPositions.length === 0) {
    return { totalExits: 0, wins: 0, losses: 0, winRate: '0%', totalPnL: 0, avgPnL: 0 };
  }

  const wins = closedPositions.filter(p => p.netPnL > 0);
  const losses = closedPositions.filter(p => p.netPnL <= 0);
  const totalPnL = closedPositions.reduce((s, p) => s + p.netPnL, 0);

  const byReason = {};
  for (const p of closedPositions) {
    byReason[p.exitReason] = (byReason[p.exitReason] || 0) + 1;
  }

  return {
    totalExits: closedPositions.length,
    wins: wins.length,
    losses: losses.length,
    winRate: `${(wins.length / closedPositions.length * 100).toFixed(1)}%`,
    totalPnL: parseFloat(totalPnL.toFixed(4)),
    avgPnL: parseFloat((totalPnL / closedPositions.length).toFixed(4)),
    byReason,
    openCount: openPositions.length
  };
}
