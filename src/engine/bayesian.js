// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — L2: Bayesian Probability Engine
// Prior (market price) → Evidence (signals) → Posterior
// ═══════════════════════════════════════════════════════════

import { CONFIG } from '../config.js';
import { combineFactors } from './probability.js';

// ─── Core Bayes Theorem ───
// P(A|B) = P(B|A) × P(A) / P(B)
// Simplified for binary prediction markets:
//   Posterior = (Likelihood × Prior) / Evidence
function bayesUpdate(prior, likelihood) {
  // Avoid division by zero and extreme values
  const safePrior = Math.max(0.01, Math.min(0.99, prior));
  const safeLikelihood = Math.max(0.01, Math.min(0.99, likelihood));

  const numerator = safeLikelihood * safePrior;
  const denominator = numerator + (1 - safeLikelihood) * (1 - safePrior);

  return denominator > 0 ? numerator / denominator : safePrior;
}

// ─── Convert sentiment score (-1 to +1) to likelihood (0 to 1) ───
function sentimentToLikelihood(sentimentScore) {
  // Map -1..+1 to 0.1..0.9
  return 0.5 + sentimentScore * 0.4;
}

// ─── Single Bayesian Update with evidence ───
export function updateWithEvidence(prior, evidenceScore, evidenceWeight = 1.0) {
  const likelihood = sentimentToLikelihood(evidenceScore * evidenceWeight);
  return bayesUpdate(prior, likelihood);
}

// ─── Full Bayesian Pipeline ───
// Takes market price as prior, updates with all signal layers
export function calculatePosterior(marketPrice, signals, mode = 'SPRINT') {
  const weights = CONFIG[mode]?.WEIGHTS || CONFIG.SPRINT.WEIGHTS;

  let posterior = Math.max(0.01, Math.min(0.99, marketPrice));

  // Layer 1: News signals (strongest evidence)
  if (signals.newsScore !== undefined && signals.newsScore !== 0) {
    const newsLikelihood = sentimentToLikelihood(signals.newsScore);
    // Apply news weight — in Sprint, news is 65% of the signal
    const adjustedLikelihood = 0.5 + (newsLikelihood - 0.5) * weights.news * 2;
    posterior = bayesUpdate(posterior, adjustedLikelihood);
  }

  // Layer 2: Volume/OFI signal (smart money)
  if (signals.volumeScore !== undefined && signals.volumeScore !== 0) {
    const volLikelihood = sentimentToLikelihood(signals.volumeScore);
    const adjustedLikelihood = 0.5 + (volLikelihood - 0.5) * weights.volume * 2;
    posterior = bayesUpdate(posterior, adjustedLikelihood);
  }

  // Layer 3: Momentum signal
  if (signals.momentumScore !== undefined && signals.momentumScore !== 0) {
    const momLikelihood = sentimentToLikelihood(signals.momentumScore);
    const adjustedLikelihood = 0.5 + (momLikelihood - 0.5) * weights.momentum * 2;
    posterior = bayesUpdate(posterior, adjustedLikelihood);
  }

  // Layer 4: Alpha signal (OFI + divergence bonus)
  if (signals.alphaScore !== undefined && signals.alphaScore !== 0) {
    // Alpha is supplementary — small weight
    const alphaLikelihood = sentimentToLikelihood(signals.alphaScore * 0.3);
    posterior = bayesUpdate(posterior, alphaLikelihood);
  }

  // Clamp final posterior
  return Math.max(0.01, Math.min(0.99, posterior));
}

// ─── Multi-Signal Aggregate ───
export function aggregateSignals(newsSignal, volumeSignal, momentumSignal, alphaSignal, mode) {
  const weights = CONFIG[mode]?.WEIGHTS || CONFIG.SPRINT.WEIGHTS;

  return {
    newsScore: newsSignal || 0,
    volumeScore: volumeSignal || 0,
    momentumScore: momentumSignal || 0,
    alphaScore: alphaSignal || 0,
    weightedCombined: combineFactors(
      newsSignal || 0,
      volumeSignal || 0,
      momentumSignal || 0,
      weights
    )
  };
}

// ─── Confidence from Signal Quality ───
export function calculateConfidence(signals, articleCount, sourceQuality) {
  // Base confidence from signal agreement
  const signalStrength = Math.abs(signals.weightedCombined || 0);

  // Article volume factor (more articles = more confidence)
  const articleFactor = Math.min(1, articleCount / 10);

  // Source quality factor
  const qualityFactor = sourceQuality || 0.5;

  // Signal agreement factor — are all signals pointing same direction?
  const directions = [
    Math.sign(signals.newsScore || 0),
    Math.sign(signals.volumeScore || 0),
    Math.sign(signals.momentumScore || 0)
  ].filter(d => d !== 0);

  const agreementFactor = directions.length > 0
    ? Math.abs(directions.reduce((s, d) => s + d, 0)) / directions.length
    : 0;

  const confidence =
    signalStrength * 0.35 +
    articleFactor * 0.20 +
    qualityFactor * 0.20 +
    agreementFactor * 0.25;

  return Math.max(0, Math.min(1, confidence));
}
