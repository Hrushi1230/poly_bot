import { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { MarketCard } from './components/MarketCard';
import { SignalRadar } from './components/SignalRadar';
import { RiskPanel } from './components/RiskPanel';
import { Newspaper, Loader2 } from 'lucide-react';

// Backend API base — reads from .env (empty string = use Vite proxy in dev)
const API_BASE = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [markets, setMarkets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [riskState, setRiskState] = useState({
    halted: false, pnl: 0, activeTrades: 0,
    dailyLoss: 0, maxLoss: 100, tradesToday: 0,
    maxTrades: 5, breakers: [false, false, false]
  });
  const [recentExits, setRecentExits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const [scanRes, riskRes, exitsRes] = await Promise.all([
          fetch(`${API_BASE}/api/scan?mode=all&top=10`),
          fetch(`${API_BASE}/api/risk`),
          fetch(`${API_BASE}/api/exits`)
        ]);

        // Markets
        if (scanRes.ok) {
          const scanData = await scanRes.json();
          if (scanData.results && scanData.results.length > 0) {
            // Map backend response to component-friendly shape
            const mapped = scanData.results.map(r => ({
              ...r,
              execution: {
                ...r.execution,
                gatesPassed: r.execution?.gates
                  ? r.execution.gates.filter(g => g.pass).length
                  : 0
              }
            }));
            setMarkets(mapped);
            setSelected(prev => prev || mapped[0]);
          }
        } else {
          setError('Failed to fetch markets');
        }

        // Risk
        if (riskRes.ok) {
          const riskData = await riskRes.json();
          if (riskData.state) {
            setRiskState({
              halted: riskData.state.isHalted || false,
              pnl: riskData.performance?.totalPnL || 0,
              activeTrades: riskData.state.activePositions || 0,
              dailyLoss: riskData.state.dailyLoss || 0,
              maxLoss: (riskData.config?.MAX_LOSS_PCT || 0.1) * 1000,
              tradesToday: riskData.state.tradeCountDaily || 0,
              maxTrades: riskData.config?.MAX_TRADES_PER_DAY || 5,
              breakers: riskData.state.circuitBreakers
                ? Object.values(riskData.state.circuitBreakers)
                : [false, false, false]
            });
          }
        }

        // Exits
        if (exitsRes.ok) {
          const exitsData = await exitsRes.json();
          if (exitsData.closed) {
            setRecentExits(exitsData.closed.slice(0, 5));
          }
        }
      } catch (err) {
        console.error('Failed to fetch backend data:', err);
        setError('Cannot reach backend — is it running?');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-midnight-950">

      {/* ─── Background Ambient Glow (Bottom Layer) ─── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-cyan-500 opacity-[0.03] blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-orange-500 opacity-[0.02] blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(0,229,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
      </div>

      {/* ─── TopBar ─── */}
      <TopBar riskState={{
        halted: riskState.halted,
        pnl: riskState.pnl,
        activeTrades: riskState.activeTrades
      }} />

      {/* ─── Loading state ─── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-cyan-500 animate-spin" />
            <span className="text-sm text-muted font-mono">Scanning markets...</span>
          </div>
        </div>
      )}

      {/* ─── Error state ─── */}
      {!loading && error && markets.length === 0 && (
        <div className="flex-1 flex items-center justify-center z-10">
          <div className="glass-panel rounded-card p-8 text-center max-w-md">
            <span className="text-red-400 font-mono text-sm block mb-2">⚠ Connection Error</span>
            <p className="text-muted text-xs">{error}</p>
            <p className="text-muted text-[10px] mt-2 font-mono">API: {API_BASE || 'localhost (proxy)'}</p>
          </div>
        </div>
      )}

      {/* ─── Command Center (only when data is loaded) ─── */}
      {!loading && markets.length > 0 && (
        <main className="relative z-10 flex-1 w-full max-w-[1440px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-[340px_1fr_320px] gap-6">

          {/* Left Column: Market Feed */}
          <section className="flex flex-col gap-4 max-h-[calc(100vh-90px)] overflow-y-auto pr-1">
            <h2 className="text-[11px] font-bold tracking-widest uppercase text-muted flex items-center gap-2 sticky top-0 bg-midnight-950 py-2 z-10">
              <Newspaper size={14} className="text-cyan-500" /> Live Market Feed
              <span className="ml-auto text-[9px] text-cyan-500/60 font-mono">{markets.length} markets</span>
            </h2>
            {markets.map((m, i) => (
              <div key={m.market_id || i} onClick={() => setSelected(m)}>
                <MarketCard market={m} />
              </div>
            ))}
          </section>

          {/* Center Column: Signal Analyzer */}
          <section className="flex flex-col gap-5">
            <div className="glass-panel rounded-card p-5">
              <span className="text-[9px] text-muted uppercase tracking-widest font-semibold block mb-1">Analyzing</span>
              <h2 className="text-lg font-bold text-white leading-tight">
                {selected?.market_name || 'Select a market'}
              </h2>
            </div>

            <SignalRadar market={selected} />

            {/* Order Book Depth (from live spread data) */}
            <div className="glass-panel rounded-card p-4">
              <h3 className="text-[10px] font-bold tracking-widest uppercase text-muted mb-3">Order Book Depth</h3>
              <div className="flex items-end gap-0.5 h-[100px] justify-center">
                {markets.slice(0, 6).map((m, i) => (
                  <div key={`bid-${i}`} className="w-4 rounded-t bg-green-500/30 border border-green-500/20 transition-all hover:bg-green-500/50"
                    style={{ height: `${Math.min(95, Math.max(20, (m.market_health?.liquidity || 50000) / 2000))}%` }} />
                ))}
                <div className="w-px h-full bg-cyan-500 mx-1 shadow-[0_0_4px_rgba(0,229,255,0.5)]" />
                {markets.slice(0, 6).map((m, i) => (
                  <div key={`ask-${i}`} className="w-4 rounded-t bg-red-500/30 border border-red-500/20 transition-all hover:bg-red-500/50"
                    style={{ height: `${Math.min(95, Math.max(20, (m.market_health?.spread || 0.02) * 3000))}%` }} />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-mono text-muted">
                <span className="text-green-400">Bids</span>
                <span className="text-cyan-400 font-bold">
                  {selected?.current_price ? `${(selected.current_price * 100).toFixed(1)}¢` : '—'}
                </span>
                <span className="text-red-400">Asks</span>
              </div>
            </div>
          </section>

          {/* Right Column: Risk Panel + Exits */}
          <section className="flex flex-col gap-5">
            <RiskPanel riskState={riskState} />

            <div className="glass-panel rounded-card p-5 flex-1 max-h-[300px] overflow-y-auto">
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
                  <span className="text-xs text-muted italic">No closed positions yet...</span>
                )}
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
