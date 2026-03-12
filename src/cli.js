#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 FORTRESS — CLI Scanner
// The command-line interface to the 6-layer quant engine
// ═══════════════════════════════════════════════════════════

import { getTopMarkets, testConnection as testPolymarket } from './data/polymarket.js';
import { testConnection as testGdelt } from './data/news.js';
import { analyzeMarket } from './engine/analyzer.js';
import { runKillChain } from './engine/execution.js';
import { RiskManager } from './risk/manager.js';
import { logPrediction } from './learning/logger.js';
import { recordPaperTrade, getPaperReport, resetPaperTrading } from './paper-trader.js';
import { compareExpectedVsActual, suggestWeightAdjustments } from './learning/logger.js';

// ─── Parse CLI Args ───
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    mode: 'all',
    top: 10,
    balance: 1000,
    paperTrade: false,
    testConnections: false,
    reviewPredictions: false,
    resetPaper: false,
    dryRun: false,
    market: null
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--mode': opts.mode = args[++i]; break;
      case '--top': opts.top = parseInt(args[++i]) || 10; break;
      case '--balance': opts.balance = parseFloat(args[++i]) || 1000; break;
      case '--paper-trade': opts.paperTrade = true; break;
      case '--test-connections': opts.testConnections = true; break;
      case '--review-predictions': opts.reviewPredictions = true; break;
      case '--reset-paper': opts.resetPaper = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--market': opts.market = args[++i]; break;
    }
  }
  return opts;
}

// ─── Banner ───
function printBanner() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║     ██████╗  ██████╗ ██╗  ██╗   ██╗ █████╗              ║
║     ██╔══██╗██╔═══██╗██║  ╚██╗ ██╔╝██╔══██╗             ║
║     ██████╔╝██║   ██║██║   ╚████╔╝ ███████║             ║
║     ██╔═══╝ ██║   ██║██║    ╚██╔╝  ██╔══██║             ║
║     ██║     ╚██████╔╝███████╗██║   ██║  ██║             ║
║     ╚═╝      ╚═════╝ ╚══════╝╚═╝   ╚═╝  ╚═╝             ║
║         v5 FORTRESS — 6-Layer Quant Engine               ║
║     ⚡ Sprint (<24h)  |  🏔️ Marathon (>24h)               ║
║     5-Gate Kill Chain | Max 10% Loss Protection          ║
╚═══════════════════════════════════════════════════════════╝
  `);
}

// ─── Test Connections ───
async function runTestConnections() {
  console.log('\n🔌 Testing API connections...\n');

  const polyResult = await testPolymarket();
  console.log(`  Polymarket: ${polyResult.success ? '✅' : '❌'} ${polyResult.message}`);

  const gdeltResult = await testGdelt();
  console.log(`  GDELT:      ${gdeltResult.success ? '✅' : '❌'} ${gdeltResult.message}`);

  console.log('\n' + (polyResult.success && gdeltResult.success
    ? '✅ All connections OK — ready to scan'
    : '⚠️ Some connections failed'));
}

// ─── Main Scan ───
async function runScan(opts) {
  const risk = new RiskManager(opts.balance);

  console.log(`\n🔍 Scanning top ${opts.top} markets... (mode: ${opts.mode.toUpperCase()})\n`);
  console.log(`   Balance: $${opts.balance} | Max loss: $${opts.balance * 0.1} (10%)`);
  console.log(`   Max trades/day: 5 | Kill chain: 5 gates\n`);

  let allMarkets;
  try {
    allMarkets = await getTopMarkets(opts.top * 2);
  } catch (err) {
    console.error(`❌ Failed to fetch markets: ${err.message}`);
    return;
  }

  // Filter by mode
  let markets = allMarkets;
  if (opts.mode === 'sprint') {
    markets = allMarkets.filter(m => m.mode === 'SPRINT');
  } else if (opts.mode === 'marathon') {
    markets = allMarkets.filter(m => m.mode === 'MARATHON');
  }
  markets = markets.slice(0, opts.top);

  console.log(`📊 Found ${markets.length} markets (${allMarkets.length} total)\n`);

  const results = [];
  let executed = 0, killed = 0, held = 0;

  for (let i = 0; i < markets.length; i++) {
    const market = markets[i];
    const modeIcon = market.mode === 'SPRINT' ? '⚡' : '🏔️';

    process.stdout.write(`  [${i + 1}/${markets.length}] ${modeIcon} Analyzing: ${market.question.slice(0, 60)}...`);

    try {
      const analysis = await analyzeMarket(market, allMarkets, opts.balance);
      const riskState = risk.getRiskState();
      const execution = runKillChain(analysis, opts.balance, riskState);

      // Log to learning layer
      logPrediction(analysis, execution);

      if (opts.paperTrade && execution.execute) {
        recordPaperTrade(analysis, execution);
      }

      if (execution.execute) {
        executed++;
        console.log(` ✅ ${execution.action} ($${execution.betSize.toFixed(2)})`);
      } else if (execution.action === 'KILLED') {
        killed++;
        console.log(` 🛑 KILLED at ${execution.killedAt}`);
      } else {
        held++;
        console.log(` ⏸️ HOLD`);
      }

      results.push({
        ...analysis,
        execution: {
          action: execution.action,
          betSize: execution.betSize,
          killedAt: execution.killedAt,
          gates: execution.gates?.map(g => ({
            gate: g.gate, pass: g.pass, reason: g.reason
          }))
        }
      });

    } catch (err) {
      console.log(` ❌ Error: ${err.message}`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  // ─── Summary ───
  const killRate = results.length > 0
    ? ((killed / results.length) * 100).toFixed(0) : 0;

  console.log('\n' + '═'.repeat(60));
  console.log('📋 SCAN RESULTS SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Total analyzed:  ${results.length}`);
  console.log(`  ✅ Executed:     ${executed}`);
  console.log(`  🛑 Killed:       ${killed} (${killRate}% kill rate)`);
  console.log(`  ⏸️  Hold:         ${held}`);
  console.log('═'.repeat(60));

  // Show actionable trades
  const actionable = results.filter(r => r.execution.action !== 'HOLD' && r.execution.action !== 'KILLED');
  if (actionable.length > 0) {
    console.log('\n🎯 ACTIONABLE TRADES:\n');
    for (const trade of actionable) {
      console.log(`  ${trade.mode === 'SPRINT' ? '⚡' : '🏔️'} ${trade.market_name.slice(0, 55)}`);
      console.log(`     Action: ${trade.execution.action} | Edge: ${(trade.market_edge * 100).toFixed(1)}% | Confidence: ${(trade.confidence_score * 100).toFixed(0)}%`);
      console.log(`     Bet: $${trade.execution.betSize.toFixed(2)} | Signal: ${trade.key_signal.slice(0, 70)}`);
      console.log();
    }
  } else {
    console.log('\n⏸️  No actionable trades found — all signals killed or held.');
    console.log('   This is the FORTRESS doing its job. Only strong signals pass.\n');
  }

  // Output JSON
  if (!opts.dryRun) {
    console.log('\n📄 Full JSON output:\n');
    console.log(JSON.stringify(results, null, 2));
  }
}

// ─── Review Predictions ───
function runReviewPredictions() {
  console.log('\n📊 PREDICTION REVIEW\n');

  const comparison = compareExpectedVsActual();
  console.log(JSON.stringify(comparison, null, 2));

  console.log('\n📈 SIGNAL WEIGHT SUGGESTIONS\n');
  const suggestions = suggestWeightAdjustments();
  console.log(JSON.stringify(suggestions, null, 2));
}

// ─── Main ───
async function main() {
  const opts = parseArgs();
  printBanner();

  if (opts.testConnections) {
    await runTestConnections();
  } else if (opts.reviewPredictions) {
    runReviewPredictions();
  } else if (opts.resetPaper) {
    resetPaperTrading(opts.balance);
    console.log(`✅ Paper trading reset with $${opts.balance} balance`);
  } else {
    await runScan(opts);

    if (opts.paperTrade) {
      console.log('\n📊 PAPER TRADING REPORT:\n');
      const report = getPaperReport();
      console.log(JSON.stringify(report.summary, null, 2));
    }
  }
}

main().catch(err => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
