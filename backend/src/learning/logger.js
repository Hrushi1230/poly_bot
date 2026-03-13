// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — L6: Learning Layer
// Expected vs Actual JSON Logs + Signal Weight Tuning
// ═══════════════════════════════════════════════════════════

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', '..', 'data');
const PREDICTIONS_FILE = join(DATA_DIR, 'predictions.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadPredictions() {
  ensureDataDir();
  try {
    if (existsSync(PREDICTIONS_FILE)) {
      return JSON.parse(readFileSync(PREDICTIONS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return [];
}

function savePredictions(predictions) {
  ensureDataDir();
  writeFileSync(PREDICTIONS_FILE, JSON.stringify(predictions, null, 2));
}

// ─── Log a New Prediction ───
export function logPrediction(analysis, executionResult) {
  const predictions = loadPredictions();

  const prediction = {
    prediction_id: analysis.analysis_id,
    market_id: analysis.market_id,
    market_name: analysis.market_name,
    mode: analysis.mode,
    predicted_probability: analysis.internal_probability,
    market_price_at_entry: analysis.market_price,
    edge: analysis.market_edge,
    confidence: analysis.confidence_score,
    recommended_action: analysis.recommended_action,
    execution: {
      executed: executionResult.execute,
      action: executionResult.action,
      bet_size: executionResult.betSize,
      killed_at: executionResult.killedAt
    },
    signals_snapshot: analysis.signals,
    articles_analyzed: analysis.articles_analyzed,
    key_signal: analysis.key_signal,
    timestamp: analysis.timestamp,
    actual_outcome: null,      // Filled when market resolves
    profit_loss: null,         // Filled when market resolves
    signal_accuracy: null      // Filled when reviewing
  };

  predictions.push(prediction);
  savePredictions(predictions);

  return prediction;
}

// ─── Record Actual Outcome ───
export function logOutcome(predictionId, actualOutcome, payout) {
  const predictions = loadPredictions();
  const pred = predictions.find(p => p.prediction_id === predictionId);

  if (!pred) return null;

  pred.actual_outcome = actualOutcome; // 'YES' or 'NO'
  pred.profit_loss = payout;

  // Was our prediction correct?
  const predictedYes = pred.predicted_probability > 0.5;
  const actualYes = actualOutcome === 'YES';
  pred.prediction_correct = predictedYes === actualYes;

  savePredictions(predictions);
  return pred;
}

// ─── Compare Expected vs Actual ───
export function compareExpectedVsActual() {
  const predictions = loadPredictions();
  const resolved = predictions.filter(p => p.actual_outcome !== null);

  if (resolved.length === 0) {
    return { message: 'No resolved predictions yet', stats: null };
  }

  const correct = resolved.filter(p => p.prediction_correct);
  const executed = resolved.filter(p => p.execution.executed);
  const executedCorrect = executed.filter(p => p.prediction_correct);

  // Per-mode stats
  const modes = {};
  for (const pred of resolved) {
    if (!modes[pred.mode]) {
      modes[pred.mode] = { total: 0, correct: 0, pnl: 0 };
    }
    modes[pred.mode].total++;
    if (pred.prediction_correct) modes[pred.mode].correct++;
    modes[pred.mode].pnl += pred.profit_loss || 0;
  }

  for (const mode of Object.values(modes)) {
    mode.accuracy = mode.total > 0 ? (mode.correct / mode.total * 100).toFixed(1) + '%' : 'N/A';
  }

  return {
    total_predictions: predictions.length,
    resolved: resolved.length,
    unresolved: predictions.length - resolved.length,
    overall_accuracy: `${(correct.length / resolved.length * 100).toFixed(1)}%`,
    executed_accuracy: executed.length > 0
      ? `${(executedCorrect.length / executed.length * 100).toFixed(1)}%`
      : 'N/A',
    total_pnl: resolved.reduce((s, p) => s + (p.profit_loss || 0), 0).toFixed(2),
    by_mode: modes,
    avg_confidence_correct: correct.length > 0
      ? (correct.reduce((s, p) => s + p.confidence, 0) / correct.length).toFixed(3)
      : 'N/A',
    avg_confidence_wrong: (resolved.length - correct.length) > 0
      ? (resolved.filter(p => !p.prediction_correct).reduce((s, p) => s + p.confidence, 0) / (resolved.length - correct.length)).toFixed(3)
      : 'N/A'
  };
}

// ─── Suggest Weight Adjustments ───
export function suggestWeightAdjustments() {
  const predictions = loadPredictions();
  const resolved = predictions.filter(p => p.actual_outcome !== null && p.signals_snapshot);

  if (resolved.length < 10) {
    return { message: `Need ${10 - resolved.length} more resolved trades for analysis`, suggestions: [] };
  }

  // Analyze which signals correlate with correct predictions
  const signalTypes = ['news', 'volume', 'momentum', 'alpha'];
  const analysis = {};

  for (const sig of signalTypes) {
    const withSignal = resolved.filter(p => Math.abs(p.signals_snapshot?.[sig] || 0) > 0.05);
    const correctWithSignal = withSignal.filter(p => p.prediction_correct);

    analysis[sig] = {
      total: withSignal.length,
      correct: correctWithSignal.length,
      accuracy: withSignal.length > 0
        ? (correctWithSignal.length / withSignal.length * 100).toFixed(1)
        : 'N/A',
      avgStrength: withSignal.length > 0
        ? (withSignal.reduce((s, p) => s + Math.abs(p.signals_snapshot[sig] || 0), 0) / withSignal.length).toFixed(3)
        : 0
    };
  }

  // Generate suggestions
  const suggestions = [];
  const accuracies = Object.entries(analysis)
    .filter(([, v]) => v.total >= 3)
    .map(([k, v]) => ({ signal: k, accuracy: parseFloat(v.accuracy) || 0 }))
    .sort((a, b) => b.accuracy - a.accuracy);

  if (accuracies.length >= 2) {
    const best = accuracies[0];
    const worst = accuracies[accuracies.length - 1];
    suggestions.push(`Increase '${best.signal}' weight — ${best.accuracy}% accuracy`);
    suggestions.push(`Decrease '${worst.signal}' weight — ${worst.accuracy}% accuracy`);
  }

  return { analysis, suggestions };
}

// ─── Get All Predictions ───
export function getAllPredictions() {
  return loadPredictions();
}
