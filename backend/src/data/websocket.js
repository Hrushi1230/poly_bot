// ═══════════════════════════════════════════════════════════
// PolyAlpha v5 — WebSocket Real-Time Feed
// Sprint mode primary data source — millisecond price updates
// ═══════════════════════════════════════════════════════════

import WebSocket from 'ws';
import { CONFIG } from '../config.js';

export class PolyMarketWS {
  constructor() {
    this.ws = null;
    this.subscriptions = new Map();
    this.callbacks = { price: [], book: [], ofi: [] };
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.isConnected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(CONFIG.APIS.CLOB_WS);

        this.ws.on('open', () => {
          console.log('[WS] ✅ Connected to Polymarket');
          this.isConnected = true;
          this.reconnectDelay = 1000;
          // Re-subscribe to all channels
          for (const [tokenId] of this.subscriptions) {
            this._sendSubscribe(tokenId);
          }
          resolve();
        });

        this.ws.on('message', (raw) => {
          try {
            const data = JSON.parse(raw.toString());
            this._handleMessage(data);
          } catch { /* ignore parse errors */ }
        });

        this.ws.on('close', () => {
          console.log('[WS] ⚠️ Disconnected — reconnecting...');
          this.isConnected = false;
          this._reconnect();
        });

        this.ws.on('error', (err) => {
          console.log(`[WS] ❌ Error: ${err.message}`);
          this.isConnected = false;
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  subscribe(tokenId) {
    this.subscriptions.set(tokenId, true);
    if (this.isConnected) {
      this._sendSubscribe(tokenId);
    }
  }

  subscribeBulk(tokenIds) {
    for (const id of tokenIds) {
      this.subscribe(id);
    }
  }

  onPriceUpdate(callback) {
    this.callbacks.price.push(callback);
  }

  onBookUpdate(callback) {
    this.callbacks.book.push(callback);
  }

  onOFIUpdate(callback) {
    this.callbacks.ofi.push(callback);
  }

  _sendSubscribe(tokenId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'market',
        assets_id: tokenId
      }));
    }
  }

  _handleMessage(data) {
    if (data.event_type === 'price_change' || data.price) {
      const update = {
        tokenId: data.asset_id || data.market,
        price: parseFloat(data.price || 0),
        timestamp: Date.now()
      };
      for (const cb of this.callbacks.price) cb(update);
    }

    if (data.event_type === 'book' || data.bids || data.asks) {
      const bidDepth = (data.bids || []).reduce((s, o) =>
        s + parseFloat(o.price || 0) * parseFloat(o.size || 0), 0);
      const askDepth = (data.asks || []).reduce((s, o) =>
        s + parseFloat(o.price || 0) * parseFloat(o.size || 0), 0);
      const ofi = bidDepth - askDepth;

      const update = {
        tokenId: data.asset_id || data.market,
        bids: data.bids,
        asks: data.asks,
        bidDepth, askDepth, ofi,
        timestamp: Date.now()
      };

      for (const cb of this.callbacks.book) cb(update);
      for (const cb of this.callbacks.ofi) cb({ tokenId: update.tokenId, ofi, bidDepth, askDepth });
    }
  }

  _reconnect() {
    setTimeout(() => {
      console.log(`[WS] 🔄 Reconnecting in ${this.reconnectDelay}ms...`);
      this.connect().catch(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this._reconnect();
      });
    }, this.reconnectDelay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
}

export async function testWSConnection() {
  const ws = new PolyMarketWS();
  try {
    await ws.connect();
    ws.disconnect();
    return { success: true, message: 'WebSocket OK' };
  } catch (err) {
    return { success: false, message: `WebSocket FAIL: ${err.message}` };
  }
}
