// ═══════════════════════════════════════════════════════════
// PolyAlpha v5.1 — Dashboard Server
// Express + Cron + Triple Mode + Exit Monitor
// ═══════════════════════════════════════════════════════════

import express from 'express';
import cron from 'node-cron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getTopMarkets, testConnection as testPoly } from '../data/polymarket.js';
import { testConnection as testGdelt } from '../data/news.js';
import { analyzeMarket } from '../engine/analyzer.js';
import { runKillChain } from '../engine/execution.js';
import { addPosition, checkExits, getOpenPositions, getClosedPositions, getExitStats } from '../engine/exit-manager.js';
import { RiskManager } from '../risk/manager.js';
import { logPrediction, compareExpectedVsActual, suggestWeightAdjustments } from '../learning/logger.js';
import { getPaperReport, recordPaperTrade } from '../paper-trader.js';
import { CONFIG } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const risk = new RiskManager(1000);

app.use(express.static(join(__dirname, 'public')));
app.use(express.json());

// ─── API: Test Connections ───
app.get('/api/test', async (req, res) => {
  const [poly, gdelt] = await Promise.all([testPoly(), testGdelt()]);
  res.json({ polymarket: poly, gdelt });
});

// ─── API: Scan Markets ───
app.get('/api/scan', async (req, res) => {
  const mode = req.query.mode || 'all';
  const top = parseInt(req.query.top) || 10;
  const balance = parseFloat(req.query.balance) || 1000;

  try {
    let allMarkets = await getTopMarkets(top * 2);
    let markets = allMarkets;

    if (mode === 'sprint') markets = allMarkets.filter(m => m.mode === 'SPRINT');
    if (mode === 'swing') markets = allMarkets.filter(m => m.mode === 'SWING');
    if (mode === 'marathon') markets = allMarkets.filter(m => m.mode === 'MARATHON');
    markets = markets.slice(0, top);

    const results = [];
    for (const market of markets) {
      try {
        const analysis = await analyzeMarket(market, allMarkets, balance);
        const riskState = risk.getRiskState();
        const execution = runKillChain(analysis, balance, riskState);

        logPrediction(analysis, execution);

        if (execution.execute) {
          recordPaperTrade(analysis, execution);
          // Add to exit monitor
          addPosition({
            id: analysis.market_id || market.id,
            market_name: analysis.market_name || market.question,
            tokenId: market.clobTokenIds?.[0] || null,
            mode: analysis.mode || market.mode,
            side: execution.action === 'BUY_YES' ? 'YES' : 'NO',
            entryPrice: analysis.current_price || 0.5,
            shares: execution.betSize ? Math.floor(execution.betSize / (analysis.current_price || 0.5)) : 0,
            betSize: execution.betSize || 0,
            spread: analysis.market_health?.spread || 0.02
          });
        }

        results.push({
          ...analysis,
          execution: {
            action: execution.action,
            betSize: execution.betSize,
            betPct: execution.betPct,
            tier: execution.tier,
            killedAt: execution.killedAt,
            gates: execution.gates?.map(g => ({ gate: g.gate, pass: g.pass, reason: g.reason }))
          }
        });
      } catch (err) {
        results.push({ market_name: market.question, error: err.message });
      }
      await new Promise(r => setTimeout(r, 200));
    }

    const executed = results.filter(r => r.execution?.action && r.execution.action !== 'HOLD' && r.execution.action !== 'KILLED');
    const killed = results.filter(r => r.execution?.action === 'KILLED');

    res.json({
      total: results.length,
      executed: executed.length,
      killed: killed.length,
      kill_rate: results.length > 0 ? `${(killed.length / results.length * 100).toFixed(0)}%` : '0%',
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Risk State ───
app.get('/api/risk', (req, res) => {
  res.json({
    state: risk.getRiskState(),
    performance: risk.getPerformance(),
    config: CONFIG.SHARED
  });
});

// ─── API: Learning ───
app.get('/api/learning', (req, res) => {
  res.json({
    predictions: compareExpectedVsActual(),
    suggestions: suggestWeightAdjustments()
  });
});

// ─── API: Paper Trading ───
app.get('/api/paper', (req, res) => {
  res.json(getPaperReport());
});

// ─── API: Exit Manager ───
app.get('/api/exits', (req, res) => {
  res.json({
    open: getOpenPositions(),
    closed: getClosedPositions(50),
    stats: getExitStats()
  });
});

// ─── API: Config ───
app.get('/api/config', (req, res) => {
  res.json({
    sprint: CONFIG.SPRINT,
    swing: CONFIG.SWING,
    marathon: CONFIG.MARATHON,
    shared: CONFIG.SHARED,
    confidence_tiers: CONFIG.CONFIDENCE_TIERS
  });
});

// ─── Background Worker: Hourly Market Scan ───
cron.schedule('0 * * * *', async () => {
  console.log('\n[CRON] ⏰ Running hourly market scan (all 3 modes)...');
  try {
    const allMarkets = await getTopMarkets(60);

    for (const modeName of ['SPRINT', 'SWING', 'MARATHON']) {
      const modeMarkets = allMarkets.filter(m => m.mode === modeName).slice(0, 10);
      for (const market of modeMarkets) {
        try {
          const analysis = await analyzeMarket(market, allMarkets, 1000);
          const execution = runKillChain(analysis, 1000, risk.getRiskState());
          logPrediction(analysis, execution);

          if (execution.execute) {
            recordPaperTrade(analysis, execution);
            addPosition({
              id: analysis.market_id || market.id,
              market_name: analysis.market_name || market.question,
              tokenId: market.clobTokenIds?.[0] || null,
              mode: modeName,
              side: execution.action === 'BUY_YES' ? 'YES' : 'NO',
              entryPrice: analysis.current_price || 0.5,
              shares: execution.betSize ? Math.floor(execution.betSize / (analysis.current_price || 0.5)) : 0,
              betSize: execution.betSize || 0,
              spread: analysis.market_health?.spread || 0.02
            });
          }
        } catch (err) {
          // Skip failed markets silently
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log('[CRON] ✅ Hourly scan complete (Sprint + Swing + Marathon).');
  } catch (err) {
    console.error('[CRON] ❌ Hourly scan failed:', err.message);
  }
});

// ─── Background Worker: Exit Monitor (every 5 min) ───
cron.schedule('*/5 * * * *', async () => {
  const openCount = getOpenPositions().length;
  if (openCount === 0) return; // Nothing to monitor

  console.log(`[EXIT-MONITOR] 👁️ Checking ${openCount} open position(s)...`);
  try {
    const exits = await checkExits();
    if (exits.length > 0) {
      const stats = getExitStats();
      console.log(`[EXIT-MONITOR] 📊 ${exits.length} position(s) closed | Total P&L: $${stats.totalPnL.toFixed(2)} | Win rate: ${stats.winRate}`);
    }
  } catch (err) {
    console.error('[EXIT-MONITOR] ❌ Check failed:', err.message);
  }
});

// ─── Start Server ───
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║   PolyAlpha v5.1 FORTRESS — Dashboard            ║
║   http://localhost:${PORT}                           ║
║   ⚡ Sprint  |  🔥 Swing  |  🏔️ Marathon          ║
║   💰 Auto Exit: +10¢/+15¢/+20¢ | Stop: -7¢      ║
╚═══════════════════════════════════════════════════╝
  `);
});
