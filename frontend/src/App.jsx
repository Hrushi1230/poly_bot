import { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { MarketCard } from './components/MarketCard';
import { SignalRadar } from './components/SignalRadar';
import { RiskPanel } from './components/RiskPanel';
import { Newspaper } from 'lucide-react';

// Mock data — will be replaced with /api/scan fetch
const MOCK_MARKETS = [
  { market_name: 'Will Bitcoin hit $100k by July 2026?', mode: 'SPRINT', edge: 0.082, confidence: 0.74, smart_money: true, execution: { action: 'BUY_YES', gatesPassed: 6 }, market_health: { liquidity: 85000, spread: 0.015 }, signals: { sentiment: { score: 0.72, magnitude: 0.8 }, alpha: { ofi: 0.45 }, momentum: { strength: 0.6 } } },
  { market_name: 'Fed cuts interest rates 50+ bps in 2026?', mode: 'SWING', edge: 0.054, confidence: 0.61, smart_money: false, execution: { action: 'BUY_NO', gatesPassed: 5 }, market_health: { liquidity: 120000, spread: 0.012 }, signals: { sentiment: { score: 0.4, magnitude: 0.5 }, alpha: { ofi: 0.3 }, momentum: { strength: 0.35 } } },
  { market_name: 'Chelsea win 2025-26 EPL?', mode: 'MARATHON', edge: 0.021, confidence: 0.42, smart_money: false, execution: { action: 'KILLED', gatesPassed: 2 }, market_health: { liquidity: 45000, spread: 0.035 }, signals: { sentiment: { score: 0.3, magnitude: 0.3 }, alpha: { ofi: 0.1 }, momentum: { strength: 0.2 } } },
  { market_name: 'ETH flips BTC market cap by Dec 2026?', mode: 'SPRINT', edge: 0.11, confidence: 0.68, smart_money: true, execution: { action: 'BUY_YES', gatesPassed: 6 }, market_health: { liquidity: 200000, spread: 0.008 }, signals: { sentiment: { score: 0.85, magnitude: 0.9 }, alpha: { ofi: 0.7 }, momentum: { strength: 0.75 } } },
  { market_name: 'US recession declared in 2026?', mode: 'SWING', edge: 0.035, confidence: 0.55, smart_money: false, execution: { action: 'HOLD', gatesPassed: 3 }, market_health: { liquidity: 95000, spread: 0.022 }, signals: { sentiment: { score: 0.5, magnitude: 0.45 }, alpha: { ofi: 0.2 }, momentum: { strength: 0.4 } } },
];

export default function App() {
  const [markets, setMarkets] = useState(MOCK_MARKETS);
  const [selected, setSelected] = useState(MOCK_MARKETS[0]);
  const [riskState, setRiskState] = useState({ halted: false, pnl: 0, activeTrades: 0, dailyLoss: 0, maxLoss: 100, tradesToday: 0, maxTrades: 5, breakers: [false, false, false] });
  const [recentExits, setRecentExits] = useState([]);

  useEffect(() => {
    // Initial fetch
    const fetchData = async () => {
      try {
        const [scanRes, riskRes, exitsRes] = await Promise.all([
          fetch('/api/scan?mode=all&top=10'),
          fetch('/api/risk'),
          fetch('/api/exits')
        ]);
        
        if (scanRes.ok) {
          const scanData = await scanRes.json();
          if (scanData.results && scanData.results.length > 0) {
            setMarkets(scanData.results);
            setSelected(scanData.results[0]); // Select first by default
          }
        }
        
        if (riskRes.ok) {
          const riskData = await riskRes.json();
          if (riskData.state && riskData.performance) {
            setRiskState({
              halted: riskData.state.isHalted,
              pnl: riskData.performance.totalPnL,
              activeTrades: riskData.performance.totalTrades - riskData.performance.winningTrades - riskData.performance.losingTrades, // Approximation if active isn't exposed directly
              dailyLoss: riskData.state.dailyLoss,
              maxLoss: 1000 * 0.10, // 10% of 1000
              tradesToday: riskData.state.tradeCountDaily,
              maxTrades: 5,
              breakers: riskData.state.circuitBreakers ? Object.values(riskData.state.circuitBreakers) : [false, false, false]
            });
          }
        }

        if (exitsRes.ok) {
          const exitsData = await exitsRes.json();
          if (exitsData.closed) {
            setRecentExits(exitsData.closed.slice(0, 5)); // Keep top 5
          }
        }
      } catch (err) {
        console.error("Failed to fetch backend data:", err);
      }
    };

    fetchData();
    // Poll every 15 seconds to simulate live feed
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-midnight-950">
      
      {/* ─── Background Ambient Glow (Bottom Layer: Sea of Data) ─── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-cyan-500 opacity-[0.03] blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-orange-500 opacity-[0.02] blur-[150px]" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(0,229,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* ─── Top Layer: TopBar ─── */}
      <TopBar riskState={{ 
        halted: riskState.halted, 
        pnl: riskState.pnl, 
        activeTrades: riskState.activeTrades 
      }} />

      {/* ─── Middle Layer: Command Center ─── */}
      <main className="relative z-10 flex-1 w-full max-w-[1440px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-[340px_1fr_320px] gap-6">
        
        {/* Left Column: Market Feed */}
        <section className="flex flex-col gap-4 max-h-[calc(100vh-90px)] overflow-y-auto pr-1">
          <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted flex items-center gap-2 sticky top-0 bg-midnight-950 py-2 z-10">
            <Newspaper size={14} className="text-cyan-500" /> Live Market Feed
          </h2>
          {markets.map((m, i) => (
            <div key={i} onClick={() => setSelected(m)}>
              <MarketCard market={m} />
            </div>
          ))}
        </section>

        {/* Center Column: Signal Analyzer */}
        <section className="flex flex-col gap-5">
          {/* Selected Market Header */}
          <div className="glass-panel rounded-card p-5">
            <span className="text-[9px] text-muted uppercase tracking-widest font-semibold block mb-1">Analyzing</span>
            <h2 className="text-lg font-bold text-white leading-tight">
              {selected?.market_name || 'Select a market'}
            </h2>
          </div>

          {/* Signal Radar */}
          <SignalRadar market={selected} />

          {/* Mini Orderbook Placeholder */}
          <div className="glass-panel rounded-card p-4">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-muted mb-3">Order Book Depth</h3>
            <div className="flex items-end gap-0.5 h-[100px] justify-center">
              {/* Bid bars (green, left) */}
              {[65,80,45,90,70,55].map((h, i) => (
                <div key={`bid-${i}`} className="w-4 rounded-t bg-green-500/30 border border-green-500/20 transition-all hover:bg-green-500/50" style={{ height: `${h}%` }} />
              ))}
              {/* Midpoint */}
              <div className="w-px h-full bg-cyan-500 mx-1 shadow-[0_0_4px_rgba(0,229,255,0.5)]" />
              {/* Ask bars (red, right) */}
              {[75,60,85,40,70,50].map((h, i) => (
                <div key={`ask-${i}`} className="w-4 rounded-t bg-red-500/30 border border-red-500/20 transition-all hover:bg-red-500/50" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-mono text-muted">
              <span className="text-green-400">Bids</span>
              <span className="text-cyan-400 font-bold">50.2¢</span>
              <span className="text-red-400">Asks</span>
            </div>
          </div>
        </section>

        {/* Right Column: Risk Panel */}
        <section className="flex flex-col gap-5">
          <RiskPanel riskState={{
            dailyLoss: riskState.dailyLoss,
            maxLoss: riskState.maxLoss,
            tradesToday: riskState.tradesToday,
            maxTrades: riskState.maxTrades,
            breakers: riskState.breakers
          }} />
          
          {/* Recent Exits */}
          <div className="glass-panel rounded-card p-5 flex-1 max-h-[300px] overflow-y-auto custom-scrollbar">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-muted mb-3">Recent Exits</h3>
            <div className="space-y-3">
              {recentExits.length > 0 ? recentExits.map((exit, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                  <span className="text-xs text-white truncate max-w-[180px]">{exit.market_name || exit.id}</span>
                  <span className={`font-mono text-xs font-bold ${exit.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {exit.pnl >= 0 ? '+' : ''}{(exit.pnl * 100).toFixed(1)}¢
                  </span>
                </div>
              )) : (
                <span className="text-xs text-muted italic">No recent exits available...</span>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
