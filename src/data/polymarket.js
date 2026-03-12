// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — Polymarket REST API Client
// Gamma API (market discovery) + CLOB API (prices/books)
// ═══════════════════════════════════════════════════════════

import { CONFIG } from '../config.js';

const { GAMMA, CLOB } = CONFIG.APIS;

// ─── Fetch with timeout + error handling ───
async function safeFetch(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`TIMEOUT: ${url}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── GAMMA API: Market Discovery ───

export async function fetchActiveMarkets(limit = 20, offset = 0) {
  const url = `${GAMMA}/events?limit=${limit}&offset=${offset}&active=true&closed=false`;
  const events = await safeFetch(url);
  const markets = [];
  for (const event of events) {
    if (!event.markets || event.markets.length === 0) continue;
    for (const mkt of event.markets) {
      const endDate = mkt.end_date_iso || mkt.endDate;
      const hoursLeft = endDate
        ? (new Date(endDate) - Date.now()) / 3600000
        : 9999;
      markets.push({
        id: mkt.id,
        conditionId: mkt.condition_id || mkt.conditionId,
        question: mkt.question || event.title,
        slug: mkt.slug || event.slug,
        outcomePrices: mkt.outcomePrices || mkt.outcome_prices,
        outcomes: mkt.outcomes,
        volume: parseFloat(mkt.volume || mkt.volumeNum || 0),
        volume24hr: parseFloat(mkt.volume24hr || 0),
        liquidity: parseFloat(mkt.liquidity || 0),
        endDate: endDate,
        hoursLeft: hoursLeft,
        mode: hoursLeft <= 24 ? 'SPRINT' : 'MARATHON',
        clobTokenIds: mkt.clobTokenIds || [],
        active: mkt.active,
        closed: mkt.closed
      });
    }
  }
  return markets;
}

export async function fetchMarketById(marketId) {
  const url = `${GAMMA}/markets/${marketId}`;
  return safeFetch(url);
}

// ─── CLOB API: Prices ───

export async function fetchPrice(tokenId) {
  const url = `${CLOB}/price?token_id=${tokenId}&side=buy`;
  const data = await safeFetch(url);
  return parseFloat(data.price || 0);
}

export async function fetchPrices(tokenIds) {
  if (!tokenIds || tokenIds.length === 0) return {};
  const results = {};
  for (const tokenId of tokenIds) {
    try {
      results[tokenId] = await fetchPrice(tokenId);
    } catch {
      results[tokenId] = null;
    }
  }
  return results;
}

export async function fetchMidpoint(tokenId) {
  const url = `${CLOB}/midpoint?token_id=${tokenId}`;
  const data = await safeFetch(url);
  return parseFloat(data.mid || 0);
}

// ─── CLOB API: Order Book (for slippage + liquidity) ───

export async function fetchOrderBook(tokenId) {
  const url = `${CLOB}/book?token_id=${tokenId}`;
  const data = await safeFetch(url);

  const bids = (data.bids || []).map(o => ({
    price: parseFloat(o.price),
    size: parseFloat(o.size)
  })).sort((a, b) => b.price - a.price);

  const asks = (data.asks || []).map(o => ({
    price: parseFloat(o.price),
    size: parseFloat(o.size)
  })).sort((a, b) => a.price - b.price);

  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 1;
  const spread = bestAsk - bestBid;
  const spreadPct = bestAsk > 0 ? spread / bestAsk : 1;
  const midpoint = (bestBid + bestAsk) / 2;

  const bidDepth = bids.reduce((s, o) => s + o.price * o.size, 0);
  const askDepth = asks.reduce((s, o) => s + o.price * o.size, 0);

  return {
    bids, asks, bestBid, bestAsk,
    spread, spreadPct, midpoint,
    bidDepth, askDepth,
    totalDepth: bidDepth + askDepth,
    ofi: bidDepth - askDepth // Order Flow Imbalance
  };
}

// ─── CLOB API: Price History ───

export async function fetchPriceHistory(tokenId, fidelity = 60) {
  const url = `${CLOB}/prices-history?market=${tokenId}&interval=max&fidelity=${fidelity}`;
  try {
    const data = await safeFetch(url);
    const history = (data.history || []).map(p => ({
      timestamp: p.t,
      price: parseFloat(p.p)
    }));
    return history;
  } catch {
    return [];
  }
}

// ─── Slippage Calculator ───

export function calculateSlippage(orderBook, betSizeUSD, side = 'buy') {
  const orders = side === 'buy' ? orderBook.asks : orderBook.bids;
  let remaining = betSizeUSD;
  let totalCost = 0;
  let filled = 0;

  for (const order of orders) {
    const orderValue = order.price * order.size;
    if (remaining <= 0) break;

    if (orderValue <= remaining) {
      totalCost += orderValue;
      filled += order.size;
      remaining -= orderValue;
    } else {
      const partialSize = remaining / order.price;
      totalCost += remaining;
      filled += partialSize;
      remaining = 0;
    }
  }

  if (filled === 0) return { slippage: 1, avgPrice: 0, filled: 0, unfilled: betSizeUSD };

  const avgPrice = totalCost / filled;
  const idealPrice = side === 'buy' ? orderBook.bestAsk : orderBook.bestBid;
  const slippage = Math.abs(avgPrice - idealPrice);

  return { slippage, avgPrice, filled, unfilled: remaining };
}

// ─── Top Markets by Volume ───

export async function getTopMarkets(count = 20) {
  const markets = await fetchActiveMarkets(Math.max(count * 2, 50));
  return markets
    .filter(m => m.active && !m.closed && m.volume24hr > 0)
    .sort((a, b) => b.volume24hr - a.volume24hr)
    .slice(0, count);
}

// ─── Connection Test ───

export async function testConnection() {
  try {
    const markets = await fetchActiveMarkets(1);
    return { success: true, message: `Polymarket OK — ${markets.length} markets found` };
  } catch (err) {
    return { success: false, message: `Polymarket FAIL: ${err.message}` };
  }
}
