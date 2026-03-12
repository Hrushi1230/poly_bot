// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — Dashboard Server
// Express + SSE real-time updates
// ═══════════════════════════════════════════════════════════

import express from 'express';
import cron from 'node-cron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getTopMarkets, testConnection as testPoly } from '../data/polymarket.js';
import { testConnection as testGdelt } from '../data/news.js';
import { analyzeMarket } from '../engine/analyzer.js';
import { runKillChain } from '../engine/execution.js';
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
    if (mode === 'marathon') markets = allMarkets.filter(m => m.mode === 'MARATHON');
    markets = markets.slice(0, top);

    const results = [];
    for (const market of markets) {
      try {
        const analysis = await analyzeMarket(market, allMarkets, balance);
        const riskState = risk.getRiskState();
        const execution = runKillChain(analysis, balance, riskState);

        logPrediction(analysis, execution);
        if (execution.execute) recordPaperTrade(analysis, execution);

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

// ─── API: Config ───
app.get('/api/config', (req, res) => {
  res.json({
    sprint: CONFIG.SPRINT,
    marathon: CONFIG.MARATHON,
    shared: CONFIG.SHARED,
    confidence_tiers: CONFIG.CONFIDENCE_TIERS
  });
});

// ─── Background Worker (Cron) ───
// Runs every hour on the hour (0 * * * *)
cron.schedule('0 * * * *', async () => {
  console.log('\n[CRON] ⏰ Running hourly background market scan...');
  try {
    const allMarkets = await getTopMarkets(40); // Need enough pool to get 10 of each
    
    // Sprint (< 24h)
    const sprintMarkets = allMarkets.filter(m => m.mode === 'SPRINT').slice(0, 10);
    for (const market of sprintMarkets) {
      const analysis = await analyzeMarket(market, allMarkets, 1000);
      const execution = runKillChain(analysis, 1000, risk.getRiskState());
      logPrediction(analysis, execution);
      if (execution.execute) recordPaperTrade(analysis, execution);
      await new Promise(r => setTimeout(r, 500));
    }

    // Marathon (> 24h)
    const marathonMarkets = allMarkets.filter(m => m.mode === 'MARATHON').slice(0, 10);
    for (const market of marathonMarkets) {
      const analysis = await analyzeMarket(market, allMarkets, 1000);
      const execution = runKillChain(analysis, 1000, risk.getRiskState());
      logPrediction(analysis, execution);
      if (execution.execute) recordPaperTrade(analysis, execution);
      await new Promise(r => setTimeout(r, 500));
    }

    console.log('[CRON] ✅ Hourly scan complete. Predictions and paper trades saved.');
  } catch (err) {
    console.error('[CRON] ❌ Hourly scan failed:', err.message);
  }
});

// ─── Start Server ───
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   PolyAlpha v5 FORTRESS — Dashboard      ║
║   http://localhost:${PORT}                  ║
║   ⚡ Sprint  |  🏔️ Marathon               ║
╚═══════════════════════════════════════════╝
  `);
});
