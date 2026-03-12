// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — L5: Risk Engine
// 3 Circuit Breakers + Fractional Kelly + State Tracking
// ═══════════════════════════════════════════════════════════

import { CONFIG } from '../config.js';

export class RiskManager {
  constructor(startingBalance = 1000) {
    this.startingBalance = startingBalance;
    this.currentBalance = startingBalance;
    this.peakBalance = startingBalance;
    this.tradesToday = 0;
    this.openTrades = [];
    this.tradeHistory = [];
    this.dailyStartBalance = startingBalance;
    this.lastResetDate = new Date().toDateString();
    this.halted = false;
    this.haltReason = '';
  }

  // ─── Reset Daily Counters ───
  resetIfNewDay() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.tradesToday = 0;
      this.dailyStartBalance = this.currentBalance;
      this.lastResetDate = today;
      // Only un-halt if it was a daily halt (not portfolio halt)
      if (this.haltReason === 'DAILY_DRAWDOWN') {
        this.halted = false;
        this.haltReason = '';
      }
    }
  }

  // ─── Get Current Risk State ───
  getRiskState() {
    this.resetIfNewDay();

    const dailyPnL = this.currentBalance - this.dailyStartBalance;
    const dailyPnLPct = this.dailyStartBalance > 0
      ? dailyPnL / this.dailyStartBalance : 0;

    const totalPnL = this.currentBalance - this.startingBalance;
    const totalPnLPct = this.startingBalance > 0
      ? totalPnL / this.startingBalance : 0;

    return {
      tradesToday: this.tradesToday,
      openTrades: this.openTrades.length,
      dailyPnL,
      dailyPnLPct,
      totalPnL,
      totalPnLPct,
      currentBalance: this.currentBalance,
      startingBalance: this.startingBalance,
      halted: this.halted,
      haltReason: this.haltReason
    };
  }

  // ─── Record a New Trade ───
  openTrade(trade) {
    this.resetIfNewDay();

    if (this.halted) {
      return { success: false, reason: `HALTED: ${this.haltReason}` };
    }

    this.openTrades.push({
      ...trade,
      openedAt: new Date().toISOString(),
      entryPrice: trade.betSize
    });

    this.tradesToday++;
    this.currentBalance -= trade.betSize;

    return { success: true, tradesRemaining: CONFIG.SHARED.MAX_TRADES_PER_DAY - this.tradesToday };
  }

  // ─── Close a Trade (win or loss) ───
  closeTrade(tradeId, payout) {
    const tradeIdx = this.openTrades.findIndex(t => t.id === tradeId);
    if (tradeIdx === -1) return { success: false, reason: 'Trade not found' };

    const trade = this.openTrades[tradeIdx];
    const pnl = payout - trade.entryPrice;

    this.currentBalance += payout;
    if (this.currentBalance > this.peakBalance) {
      this.peakBalance = this.currentBalance;
    }

    this.tradeHistory.push({
      ...trade,
      closedAt: new Date().toISOString(),
      payout,
      pnl,
      result: pnl >= 0 ? 'WIN' : 'LOSS'
    });

    this.openTrades.splice(tradeIdx, 1);

    // ─── CHECK CIRCUIT BREAKERS ───
    this._checkCircuitBreakers(trade, pnl);

    return { success: true, pnl, newBalance: this.currentBalance };
  }

  // ─── Circuit Breakers (NON-OVERRIDABLE) ───
  _checkCircuitBreakers(trade, pnl) {
    // 🟡 Level 1: Single trade loss > 2%
    const tradeLossPct = Math.abs(pnl) / this.startingBalance;
    if (pnl < 0 && tradeLossPct > CONFIG.SHARED.MAX_TRADE_LOSS) {
      console.log(`\n🟡 CIRCUIT BREAKER L1: Trade lost ${(tradeLossPct * 100).toFixed(1)}% > ${CONFIG.SHARED.MAX_TRADE_LOSS * 100}% limit`);
    }

    // 🟠 Level 2: Daily drawdown > 5%
    const dailyPnLPct = (this.currentBalance - this.dailyStartBalance) / this.dailyStartBalance;
    if (dailyPnLPct < -CONFIG.SHARED.MAX_DAILY_DRAWDOWN) {
      this.halted = true;
      this.haltReason = 'DAILY_DRAWDOWN';
      console.log(`\n🟠 CIRCUIT BREAKER L2: Daily loss ${(dailyPnLPct * 100).toFixed(1)}% — HALTED for 24 hours`);
    }

    // 🔴 Level 3: Total drawdown > 10%
    const totalPnLPct = (this.currentBalance - this.startingBalance) / this.startingBalance;
    if (totalPnLPct < -CONFIG.SHARED.MAX_TOTAL_DRAWDOWN) {
      this.halted = true;
      this.haltReason = 'PORTFOLIO_BREAKER';
      console.log(`\n🔴 CIRCUIT BREAKER L3: Total loss ${(totalPnLPct * 100).toFixed(1)}% — BOT SHUTDOWN`);
    }
  }

  // ─── Performance Stats ───
  getPerformance() {
    const wins = this.tradeHistory.filter(t => t.result === 'WIN');
    const losses = this.tradeHistory.filter(t => t.result === 'LOSS');
    const totalPnL = this.tradeHistory.reduce((s, t) => s + t.pnl, 0);

    const winRate = this.tradeHistory.length > 0
      ? wins.length / this.tradeHistory.length : 0;

    const avgWin = wins.length > 0
      ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;

    const avgLoss = losses.length > 0
      ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;

    // Profit factor
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    return {
      totalTrades: this.tradeHistory.length,
      wins: wins.length,
      losses: losses.length,
      winRate: Math.round(winRate * 1000) / 10,
      totalPnL: Math.round(totalPnL * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      currentBalance: Math.round(this.currentBalance * 100) / 100,
      maxDrawdown: Math.round(((this.peakBalance - this.currentBalance) / this.peakBalance) * 10000) / 100,
      halted: this.halted,
      haltReason: this.haltReason
    };
  }

  // ─── Serialize State ───
  toJSON() {
    return {
      startingBalance: this.startingBalance,
      currentBalance: this.currentBalance,
      peakBalance: this.peakBalance,
      tradesToday: this.tradesToday,
      openTrades: this.openTrades,
      tradeHistory: this.tradeHistory,
      dailyStartBalance: this.dailyStartBalance,
      lastResetDate: this.lastResetDate,
      halted: this.halted,
      haltReason: this.haltReason
    };
  }

  // ─── Load State ───
  static fromJSON(data) {
    const rm = new RiskManager(data.startingBalance);
    Object.assign(rm, data);
    return rm;
  }
}
