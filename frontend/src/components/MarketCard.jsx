import { TrendingUp, Zap, BarChart3 } from 'lucide-react';

const MODE_STYLES = {
  SPRINT:   { border: 'border-l-cyan-500',   shadow: 'hover:shadow-glow-cyan',   badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',   icon: '⚡' },
  SWING:    { border: 'border-l-orange-500',  shadow: 'hover:shadow-glow-orange', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: '🔥' },
  MARATHON: { border: 'border-l-white/40',    shadow: 'hover:shadow-float',       badge: 'bg-white/5 text-white/70 border-white/10',           icon: '🏔️' },
};

export function MarketCard({ market }) {
  const mode = market.mode || 'SPRINT';
  const style = MODE_STYLES[mode] || MODE_STYLES.SPRINT;
  const action = market?.execution?.action || market?.recommended_action || 'HOLD';
  const edge = ((market.market_edge || market.edge || 0) * 100).toFixed(1);
  const confidence = ((market.confidence_score || market.confidence || 0) * 100).toFixed(0);
  const isBuy = action === 'BUY_YES' || action === 'BUY_NO';
  const isKilled = action === 'KILLED';

  return (
    <div className={`glass-card rounded-card p-4 border-l-[3px] ${style.border} 
      glass-float cursor-pointer group transition-all duration-300
      ${isKilled ? 'opacity-40 grayscale' : ''}
      ${style.shadow}`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest ${style.badge}`}>
              {style.icon} {mode}
            </span>
            {(market.smart_money || market.signals?.volume > 0.6) && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-orange-500/10 text-orange-400 border-orange-500/20 flex items-center gap-0.5">
                <Zap size={9} /> SM
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-white truncate leading-snug">
            {market.market_name || 'Unknown Market'}
          </h3>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <span className="text-[9px] text-muted uppercase tracking-widest block mb-0.5">Edge</span>
          <span className={`font-mono font-bold text-lg ${
            parseFloat(edge) > 5 ? 'text-green-400' : parseFloat(edge) > 0 ? 'text-cyan-400' : 'text-red-400'
          }`}>
            {edge}%
          </span>
        </div>
        <div>
          <span className="text-[9px] text-muted uppercase tracking-widest block mb-0.5">Conf</span>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-midnight-700 overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all duration-500"
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted">{confidence}%</span>
          </div>
        </div>
        <div>
          <span className="text-[9px] text-muted uppercase tracking-widest block mb-0.5">Action</span>
          <span className={`text-xs font-bold uppercase ${
            isBuy ? 'text-green-400' : isKilled ? 'text-red-400' : 'text-muted'
          }`}>
            {action.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Bottom: Kill Chain Progress */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="flex gap-1">
          {[1,2,3,4,5,6].map(gate => (
            <div key={gate} className={`w-2 h-2 rounded-full ${
              gate <= (market.execution?.gatesPassed || 0) ? 'bg-green-500 shadow-[0_0_4px_rgba(46,204,113,0.5)]' : 'bg-midnight-700'
            }`} />
          ))}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-muted">
          <BarChart3 size={10} />
          {market.market_health?.liquidity ? `$${(market.market_health.liquidity/1000).toFixed(0)}k` : '—'}
        </div>
      </div>
    </div>
  );
}
