// ═══════════════════════════════════════════════════════════
// PolyAlpha v5.1 FORTRESS — Central Configuration
// 6-Layer Triple-Mode | Profit-Taking Scalper | Max 10% Loss
// ═══════════════════════════════════════════════════════════

export const CONFIG = {

  // ⚡ SPRINT MODE — Markets resolving < 24 hours
  SPRINT: {
    DECAY_LAMBDA: 0.5,
    NEWS_MAX_AGE_MIN: 30,
    EDGE_THRESHOLD: 0.06,
    KELLY_FRACTION: 0.25,
    WEIGHTS: { news: 0.65, volume: 0.25, momentum: 0.10 },
    MAX_BET_PCT: 0.03,
    // Profit-Taking (spread-adjusted)
    TAKE_PROFIT: 0.10,    // +10¢ net
    STOP_LOSS: 0.07,      // -7¢ net
    TRAILING_STOP: 0.03,  // 3¢ behind peak
    MAX_HOLD_HOURS: 6     // Auto-exit after 6 hours
  },

  // 🔥 SWING MODE — Markets resolving 1–7 days
  SWING: {
    DECAY_LAMBDA: 0.1,
    NEWS_MAX_AGE_MIN: 360,       // 6 hours of news
    EDGE_THRESHOLD: 0.08,
    KELLY_FRACTION: 0.20,
    WEIGHTS: { news: 0.50, volume: 0.25, momentum: 0.25 },
    MAX_BET_PCT: 0.025,
    // Profit-Taking (spread-adjusted)
    TAKE_PROFIT: 0.15,    // +15¢ net
    STOP_LOSS: 0.07,      // -7¢ net
    TRAILING_STOP: 0.04,  // 4¢ behind peak
    MAX_HOLD_HOURS: 72    // Auto-exit after 3 days
  },

  // 🏔️ MARATHON MODE — Markets resolving > 7 days
  MARATHON: {
    DECAY_LAMBDA: 0.02,
    NEWS_MAX_AGE_MIN: 4320,      // 72 hours of news
    EDGE_THRESHOLD: 0.12,
    KELLY_FRACTION: 0.15,
    WEIGHTS: { news: 0.40, volume: 0.20, momentum: 0.40 },
    MAX_BET_PCT: 0.02,
    // Profit-Taking (spread-adjusted)
    TAKE_PROFIT: 0.20,    // +20¢ net
    STOP_LOSS: 0.07,      // -7¢ net
    TRAILING_STOP: 0.05,  // 5¢ behind peak
    MAX_HOLD_HOURS: 336   // Auto-exit after 14 days
  },

  // 🔒 HARD LIMITS — Non-overridable
  SHARED: {
    MAX_SPREAD: 0.03,
    MIN_24H_VOLUME: 10000,
    MAX_DAILY_DRAWDOWN: 0.05,
    MAX_TOTAL_DRAWDOWN: 0.10,
    MAX_TRADE_LOSS: 0.02,
    MAX_OPEN_TRADES: 6,
    MAX_TRADES_PER_DAY: 5,
    MIN_CONFIDENCE: 0.70,
    ORDER_TYPE: 'LIMIT'
  },

  // 🎯 Confidence-Tiered Position Sizing
  CONFIDENCE_TIERS: [
    { min: 0.90, max: 1.00, multiplier: 1.0,  label: 'ULTRA'  },
    { min: 0.80, max: 0.89, multiplier: 0.7,  label: 'HIGH'   },
    { min: 0.70, max: 0.79, multiplier: 0.4,  label: 'MEDIUM' },
    { min: 0.00, max: 0.69, multiplier: 0.0,  label: 'KILLED' }
  ],

  // 📰 Source Credibility
  CREDIBILITY: {
    'reuters.com': 0.95, 'bloomberg.com': 0.95, 'apnews.com': 0.90,
    'bbc.com': 0.85, 'bbc.co.uk': 0.85, 'cnbc.com': 0.80,
    'nytimes.com': 0.85, 'wsj.com': 0.90, 'ft.com': 0.90,
    'theguardian.com': 0.80, 'politico.com': 0.85, 'axios.com': 0.80,
    'coindesk.com': 0.75, 'cointelegraph.com': 0.70, 'decrypt.co': 0.70,
    'theblock.co': 0.75, 'defiant.io': 0.65,
    'cnn.com': 0.75, 'foxnews.com': 0.65, 'aljazeera.com': 0.80,
    'default': 0.50
  },

  // 💰 Financial Sentiment Dictionary (fixes VADER blindness)
  FINANCE_SENTIMENT: {
    'etf approved': 0.85, 'etf approval': 0.85, 'rate cut': 0.70,
    'rate cuts': 0.70, 'bull run': 0.75, 'all-time high': 0.80,
    'ath': 0.75, 'breakout': 0.65, 'inflows': 0.60,
    'institutional adoption': 0.70, 'whale accumulation': 0.65,
    'bipartisan support': 0.60, 'landslide': 0.70,
    'peace deal': 0.70, 'ceasefire': 0.65, 'stimulus': 0.60,
    'deal reached': 0.60, 'passed senate': 0.65, 'signed into law': 0.75,
    'surging': 0.60, 'rally': 0.55, 'moon': 0.50, 'bullish': 0.55,
    'winning': 0.50, 'victory': 0.60, 'unanimous': 0.55,
    'rate hike': -0.70, 'rate hikes': -0.70, 'sanctions': -0.65,
    'ban': -0.70, 'banned': -0.70, 'crash': -0.80, 'plunge': -0.75,
    'outflows': -0.60, 'liquidation': -0.70, 'liquidated': -0.70,
    'hack': -0.80, 'hacked': -0.80, 'exploit': -0.75,
    'rug pull': -0.90, 'indictment': -0.70, 'indicted': -0.70,
    'impeachment': -0.65, 'default': -0.75, 'defaulted': -0.75,
    'recession': -0.70, 'war': -0.75, 'invasion': -0.80,
    'shutdown': -0.55, 'veto': -0.50, 'rejected': -0.60,
    'dumping': -0.65, 'sell-off': -0.60, 'bearish': -0.55,
    'losing': -0.50, 'defeated': -0.60, 'collapsed': -0.75,
    'fraud': -0.80, 'scam': -0.85, 'bankrupt': -0.85
  },

  // 🌐 API Endpoints
  APIS: {
    GAMMA: 'https://gamma-api.polymarket.com',
    CLOB: 'https://clob.polymarket.com',
    CLOB_WS: 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
    GDELT: 'https://api.gdeltproject.org/api/v2/doc/doc'
  }
};
