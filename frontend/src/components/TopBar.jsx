import { Shield, Zap, Activity, OctagonX } from 'lucide-react';

export function TopBar({ riskState = {} }) {
  const isHalted = riskState.halted || false;
  const pnl = riskState.pnl || 0;
  const activeTrades = riskState.activeTrades || 0;

  return (
    <header className="w-full h-14 glass-panel px-6 flex items-center justify-between sticky top-0 z-50">
      
      {/* Left: Brand */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Zap size={16} className="text-cyan-500" />
          </div>
          <div>
            <span className="font-bold text-sm text-white tracking-wider">POLYALPHA</span>
            <span className="text-[10px] text-muted ml-2 font-mono">v6 FORTRESS</span>
          </div>
        </div>

        <div className="h-5 w-px bg-midnight-600 mx-1" />

        <span className="flex items-center gap-1.5 text-xs font-mono">
          <Activity size={13} className={isHalted ? 'text-red-500 animate-pulse' : 'text-green-500'} />
          <span className={isHalted ? 'text-red-400' : 'text-green-400'}>
            {isHalted ? 'HALTED' : 'SCANNING'}
          </span>
        </span>
      </div>

      {/* Center: Quick Stats */}
      <div className="hidden md:flex items-center gap-6 text-xs font-mono">
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-muted uppercase tracking-widest font-sans font-semibold">Session P&L</span>
          <span className={`font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}¢
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-muted uppercase tracking-widest font-sans font-semibold">Active</span>
          <span className="text-white font-bold">{activeTrades}</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-muted uppercase tracking-widest font-sans font-semibold">Mode</span>
          <span className="text-cyan-400 font-bold">SPRINT</span>
        </div>
      </div>

      {/* Right: HALT + Shield */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-mono text-muted">
          <Shield size={14} className="text-cyan-500" />
          <span>6-Gate</span>
        </div>
        <button className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
          isHalted 
            ? 'bg-red-500/20 border border-red-500/40 text-red-400 shadow-glow-red animate-pulse-slow' 
            : 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:shadow-glow-red'
        }`}>
          <OctagonX size={16} />
          {isHalted ? 'HALTED' : 'HALT'}
        </button>
      </div>
    </header>
  );
}
