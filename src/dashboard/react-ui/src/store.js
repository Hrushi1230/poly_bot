import { create } from 'zustand';

// Store manages the UI state, mode, and holds the current market feed
export const useStore = create((set, get) => ({
  mode: 'sprint',               // sprint, swing, marathon
  markets: [],                  // market feed (scan results)
  openPositions: [],            // currently held trades
  closedPositions: [],          // recent exits
  riskState: {
    dailyPnl: 0,
    totalPnl: 0,
    halted: false,
    openTradesCount: 0,
    tradesToday: 0
  },
  
  // Modals
  activeModal: null,            // 'TRADE', 'RISK', 'NONE'
  selectedMarket: null,         // The market currently being viewed in TradeModal

  // Actions
  setMode: (mode) => set({ mode }),
  setMarkets: (markets) => set({ markets }),
  setRiskState: (riskState) => set({ riskState }),
  
  openTradeModal: (market) => set({ activeModal: 'TRADE', selectedMarket: market }),
  closeModal: () => set({ activeModal: null, selectedMarket: null }),
  
  setExits: (open, closed) => set({ openPositions: open, closedPositions: closed }),
}));
