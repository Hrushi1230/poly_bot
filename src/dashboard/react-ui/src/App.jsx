import { useEffect, useState } from 'react';
import { useStore } from './store';
import { MarketCard } from './components/MarketCard';
import { TradeModal } from './components/TradeModal';
import { Activity, ShieldAlert, Cpu, ListFilter, AlertTriangle } from 'lucide-react';

function App() {
  const { mode, setMode, markets, setMarkets, riskState, setRiskState } = useStore();
  const [scanning, setScanning] = useState(false);

  // Initial load
  useEffect(() => {
    fetchRisk();
  }, []);

  const fetchRisk = async () => {
    try {
      const res = await fetch('/api/risk');
      const data = await res.json();
      if (data.state) setRiskState(data.state);
    } catch (e) { console.error("Risk fetch failed", e); }
  };

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    
    try {
      // Assuming backend is still running on port 10000 locally
      const res = await fetch(`/api/scan?mode=${mode}&top=50&balance=1000`);
      const data = await res.json();
      if (data.results) setMarkets(data.results);
      fetchRisk();
    } catch (e) {
      console.error("Scan failed", e);
    }
    
    setScanning(false);
  };

  // Filter markets for view
  const displayMarkets = mode === 'all' 
    ? markets 
    : markets.filter(m => m.mode?.toLowerCase() === mode);

  return (
    <div className="min-h-screen bg-bg-900 text-white font-sans overflow-x-hidden selection:bg-accent-cyan/30 flex flex-col relative">
      
      {/* Animated Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle,theme(colors.accent.cyan),transparent_60%)] opacity-5 blur-[100px] -z-10 animate-pulse mix-blend-screen" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle,#bf5af2,transparent_60%)] opacity-[0.03] blur-[100px] -z-10 mix-blend-screen" />

      {/* ─── Top Bar ─── */}
      <TradeModal />
      <header className="h-[70px] border-b border-white/5 bg-surface-700/50 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 flex items-center justify-center border border-accent-cyan/20">
            <Cpu size={18} className="text-accent-cyan" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            PolyAlpha <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-md text-muted font-mono self-end mb-1">v6.0</span>
          </h1>
        </div>

        {/* Global Stats */}
        <div className="flex items-center gap-6 hidden md:flex">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted tracking-widest uppercase font-semibold">Bot Status</span>
            <div className="flex items-center gap-1.5 text-sm font-bold text-success">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_10px_rgba(46,204,113,0.5)]"></span>
              ACTIVE
            </div>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted tracking-widest uppercase font-semibold">Daily P&L</span>
            <span className={`text-sm font-bold font-mono ${riskState.dailyPnl >= 0 ? 'text-success' : 'text-danger'}`}>
              ${riskState.dailyPnl?.toFixed(2) || '0.00'}
            </span>
          </div>
        </div>
      </header>

      {/* ─── Main 3-Column Layout ─── */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        
        {/* Left/Center: Market Feed */}
        <div className="flex flex-col gap-4">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface-700/40 p-2 rounded-xl border border-white/5 backdrop-blur-sm">
            <div className="flex bg-bg-900 p-1 rounded-lg border border-white/5">
              {['all', 'sprint', 'swing', 'marathon'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setMode(tab)}
                  className={`px-4 py-2 rounded-md text-xs font-bold tracking-wide uppercase transition-all ${
                    mode === tab 
                      ? 'bg-surface-700 text-white shadow-md' 
                      : 'text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab === 'sprint' ? '⚡ ' : tab === 'swing' ? '🔥 ' : tab === 'marathon' ? '🏔️ ' : ''}
                  {tab}
                </button>
              ))}
            </div>
            
            <button 
              onClick={handleScan}
              disabled={scanning}
              className="px-6 py-2.5 rounded-lg bg-accent-cyan text-[#0B0F14] font-bold text-sm tracking-wide uppercase hover:bg-white hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {scanning ? (
                <><Activity size={16} className="animate-spin" /> Scanning...</>
              ) : (
                <><ListFilter size={16} /> Scan Markets</>
              )}
            </button>
          </div>

          {/* Grid */}
          {displayMarkets.length === 0 ? (
            <div className="h-[400px] border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-muted gap-3">
              <Activity size={32} className="opacity-50" />
              <p>No markets scanned for {mode.toUpperCase()} mode</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayMarkets.map(m => (
                <MarketCard key={m.market_id || m.id} market={m} />
              ))}
            </div>
          )}
        </div>

        {/* Right: Risk Panel Column */}
        <aside className="flex flex-col gap-4 sticky top-[90px]">
          
          {/* Circuit Breakers Card */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-white font-bold mb-2">
              <ShieldAlert size={18} className="text-warning" /> Risk Center
            </div>
            
            {riskState.halted && (
              <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-danger flex items-center gap-3 animate-pulse">
                <AlertTriangle size={20} />
                <div className="text-sm">
                  <span className="block font-bold">SYSTEM HALTED</span>
                  <span className="opacity-80">Drawdown limit breached</span>
                </div>
              </div>
            )}
            
            <div className="space-y-4">
              {/* Daily Limit Bar */}
              <div>
                <div className="flex justify-between text-[11px] uppercase tracking-wider font-semibold mb-1">
                  <span className="text-muted">Daily Trades</span>
                  <span className="text-white">{riskState.tradesToday || 0} / 5</span>
                </div>
                <div className="h-2 w-full bg-bg-900 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-accent-cyan" 
                    style={{ width: `${Math.min(((riskState.tradesToday || 0) / 5) * 100, 100)}%` }}
                  />
                </div>
              </div>
              
              {/* Exposure Bar */}
              <div>
                <div className="flex justify-between text-[11px] uppercase tracking-wider font-semibold mb-1">
                  <span className="text-muted">Open Positions</span>
                  <span className="text-white">{riskState.openTradesCount || 0} / 3</span>
                </div>
                <div className="h-2 w-full bg-bg-900 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className={`h-full ${riskState.openTradesCount >= 3 ? 'bg-danger' : 'bg-warning'}`} 
                    style={{ width: `${Math.min(((riskState.openTradesCount || 0) / 3) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          
        </aside>

      </main>
    </div>
  );
}

export default App;
