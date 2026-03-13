// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — Paper Trading Simulator
// Tracks recommendations, simulates P&L, measures accuracy
// ═══════════════════════════════════════════════════════════

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');
const PAPER_FILE = join(DATA_DIR, 'paper-trades.json');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadTrades() {
  ensureDir();
  try {
    if (existsSync(PAPER_FILE)) {
      return JSON.parse(readFileSync(PAPER_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { trades: [], balance: 1000, startBalance: 1000, startedAt: new Date().toISOString() };
}

function saveTrades(data) {
  ensureDir();
  writeFileSync(PAPER_FILE, JSON.stringify(data, null, 2));
}

// ─── Record Paper Trade ───
export function recordPaperTrade(analysis, executionResult) {
  const data = loadTrades();

  const trade = {
    id: analysis.analysis_id,
    market_name: analysis.market_name,
    market_id: analysis.market_id,
    mode: analysis.mode,
    action: executionResult.action,
    entry_price: analysis.market_price,
    predicted_prob: analysis.internal_probability,
    edge: analysis.market_edge,
    confidence: analysis.confidence_score,
    bet_size: executionResult.betSize,
    bet_pct: executionResult.betPct,
    tier: executionResult.tier,
    gates_passed: executionResult.gates?.filter(g => g.pass).length || 0,
    gates_total: executionResult.gates?.length || 5,
    killed_at: executionResult.killedAt,
    key_signal: analysis.key_signal,
    opened_at: new Date().toISOString(),
    status: executionResult.execute ? 'OPEN' : 'KILLED',
    result: null,
    pnl: null
  };

  if (executionResult.execute) {
    data.balance -= executionResult.betSize;
  }

  data.trades.push(trade);
  saveTrades(data);

  return trade;
}

// ─── Get Paper Trading Report ───
export function getPaperReport() {
  const data = loadTrades();

  const executed = data.trades.filter(t => t.status !== 'KILLED');
  const killed = data.trades.filter(t => t.status === 'KILLED');
  const open = data.trades.filter(t => t.status === 'OPEN');
  const closed = data.trades.filter(t => t.status === 'CLOSED');
  const wins = closed.filter(t => t.pnl > 0);
  const losses = closed.filter(t => t.pnl < 0);

  const totalPnL = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const killRate = data.trades.length > 0
    ? (killed.length / data.trades.length * 100).toFixed(1)
    : '0';

  // Per-mode breakdown
  const sprint = closed.filter(t => t.mode === 'SPRINT');
  const marathon = closed.filter(t => t.mode === 'MARATHON');

  return {
    summary: {
      total_signals: data.trades.length,
      executed: executed.length,
      killed: killed.length,
      kill_rate: `${killRate}%`,
      open_trades: open.length,
      closed_trades: closed.length,
      wins: wins.length,
      losses: losses.length,
      win_rate: closed.length > 0 ? `${(wins.length / closed.length * 100).toFixed(1)}%` : 'N/A',
      total_pnl: `$${totalPnL.toFixed(2)}`,
      current_balance: `$${data.balance.toFixed(2)}`,
      starting_balance: `$${data.startBalance.toFixed(2)}`,
      roi: `${((data.balance - data.startBalance) / data.startBalance * 100).toFixed(2)}%`
    },
    by_mode: {
      sprint: {
        trades: sprint.length,
        wins: sprint.filter(t => t.pnl > 0).length,
        pnl: `$${sprint.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(2)}`
      },
      marathon: {
        trades: marathon.length,
        wins: marathon.filter(t => t.pnl > 0).length,
        pnl: `$${marathon.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(2)}`
      }
    },
    recent_trades: data.trades.slice(-10).reverse(),
    started_at: data.startedAt
  };
}

// ─── Reset Paper Trading ───
export function resetPaperTrading(startBalance = 1000) {
  saveTrades({
    trades: [],
    balance: startBalance,
    startBalance,
    startedAt: new Date().toISOString()
  });
}
