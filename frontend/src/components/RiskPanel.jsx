import { ShieldAlert, CircleDot } from 'lucide-react';

export function RiskPanel({ riskState = {} }) {
  const dailyLoss = Math.abs(riskState.dailyLoss || 0);
  const maxLoss = riskState.maxLoss || 100; // 10% of $1000
  const lossPct = Math.min(100, (dailyLoss / maxLoss) * 100);
  const tradesToday = riskState.tradesToday || 0;
  const maxTrades = riskState.maxTrades || 5;
  const breakers = riskState.breakers || [false, false, false];

  return (
    <div className="glass-panel rounded-card p-5 flex flex-col gap-5">
      <h2 className="text-xs font-bold tracking-widest uppercase text-muted flex items-center gap-2">
        <ShieldAlert size={16} className="text-cyan-500" /> Risk Control
      </h2>

      {/* Daily Drawdown */}
      <div>
        <div className="flex justify-between items-end mb-2">
          <span className="text-[10px] text-muted uppercase tracking-widest font-semibold">Daily Drawdown</span>
          <span className={`font-mono text-sm font-bold ${lossPct > 70 ? 'text-red-400' : lossPct > 40 ? 'text-orange-400' : 'text-green-400'}`}>
            {dailyLoss.toFixed(0)}¢ / {maxLoss}¢
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-midnight-700 overflow-hidden relative">
          <div 
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              lossPct > 70 ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-[0_0_8px_rgba(255,77,79,0.4)]'
              : lossPct > 40 ? 'bg-gradient-to-r from-cyan-500 to-orange-500'
              : 'bg-gradient-to-r from-cyan-500 to-green-500'
            }`}
            style={{ width: `${lossPct}%` }}
          />
          {/* 10% fortress line */}
          <div className="absolute top-0 right-0 h-full w-px bg-red-500/50" />
        </div>
      </div>

      {/* Trade Counter */}
      <div>
        <div className="flex justify-between items-end mb-2">
          <span className="text-[10px] text-muted uppercase tracking-widest font-semibold">Trades Today</span>
          <span className="font-mono text-sm font-bold text-white">{tradesToday}/{maxTrades}</span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: maxTrades }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${
              i < tradesToday ? 'bg-cyan-500 shadow-[0_0_4px_rgba(0,229,255,0.3)]' : 'bg-midnight-700'
            }`} />
          ))}
        </div>
      </div>

      {/* Circuit Breakers */}
      <div>
        <span className="text-[10px] text-muted uppercase tracking-widest font-semibold block mb-2">Circuit Breakers</span>
        <div className="flex items-center gap-3">
          {['Max Loss', 'Correlation', 'Volatility'].map((name, i) => (
            <div key={name} className="flex items-center gap-1.5">
              <CircleDot size={12} className={breakers[i] ? 'text-red-500 animate-pulse' : 'text-green-500'} />
              <span className={`text-[10px] font-mono ${breakers[i] ? 'text-red-400' : 'text-muted'}`}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Exit Stats */}
      <div className="border-t border-white/5 pt-4 grid grid-cols-2 gap-3">
        <div>
          <span className="text-[9px] text-muted uppercase tracking-widest block mb-1">Take Profit</span>
          <span className="font-mono text-green-400 font-bold text-lg">+10¢</span>
        </div>
        <div>
          <span className="text-[9px] text-muted uppercase tracking-widest block mb-1">Stop Loss</span>
          <span className="font-mono text-red-400 font-bold text-lg">-7¢</span>
        </div>
      </div>
    </div>
  );
}
