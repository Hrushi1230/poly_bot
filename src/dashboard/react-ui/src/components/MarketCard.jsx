import { useStore } from '../store';
import { Activity, Zap, TrendingUp, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

export function MarketCard({ market }) {
  const { openTradeModal } = useStore();
  
  const edge = (market.edge || 0) * 100;
  const confidence = (market.confidence || 0) * 100;
  
  // Format actions
  const action = market?.execution?.action || 'HOLD';
  const isKilled = action === 'KILLED';
  const isBuyYes = action === 'BUY_YES';
  const isBuyNo = action === 'BUY_NO';
  
  const modeLabels = { SPRINT: '⚡ Sprint', SWING: '🔥 Swing', MARATHON: '🏔️ Marathon' };
  const modeColors = {
    SPRINT: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20',
    SWING: 'bg-[#ff6b35]/10 text-[#ff6b35] border-[#ff6b35]/20',
    MARATHON: 'bg-[#bf5af2]/10 text-[#bf5af2] border-[#bf5af2]/20'
  };

  return (
    <div 
      onClick={() => openTradeModal(market)}
      className={clsx(
        "glass-card p-4 flex flex-col cursor-pointer group hover:-translate-y-1",
        isBuyYes && "hover:border-success/40",
        isBuyNo && "hover:border-danger/40",
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-start gap-3 mb-4">
        <h3 className="text-sm font-semibold text-white leading-tight flex-1">
          {market.market_name || "Unknown Market"}
        </h3>
        <span className={clsx(
          "text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap uppercase tracking-wider",
          modeColors[market.mode || 'SPRINT']
        )}>
          {modeLabels[market.mode || 'SPRINT']}
        </span>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center">
          <div className={clsx("text-lg font-bold font-mono", edge > 5 ? "text-success" : "text-white")}>
            {Math.abs(edge).toFixed(1)}%
          </div>
          <div className="text-[9px] text-muted tracking-widest uppercase">Edge</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold font-mono text-white">
            {confidence.toFixed(0)}%
          </div>
          <div className="text-[9px] text-muted tracking-widest uppercase">Confidence</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold font-mono text-white">
            {Math.round((market.current_price || 0) * 100)}¢
          </div>
          <div className="text-[9px] text-muted tracking-widest uppercase">Price</div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex justify-between items-center pt-3 border-t border-white/5 mt-auto">
        <div className={clsx(
          "text-[11px] font-extrabold px-3 py-1.5 rounded-md tracking-wider uppercase border",
          isBuyYes && "bg-success/10 text-success border-success/20 shadow-[0_0_15px_rgba(46,204,113,0.2)]",
          isBuyNo && "bg-danger/10 text-danger border-danger/20 shadow-[0_0_15px_rgba(255,77,79,0.2)]",
          isKilled && "bg-danger/5 text-[#ff6b7f] border-danger/10",
          (!isBuyYes && !isBuyNo && !isKilled) && "bg-white/5 text-muted border-white/5"
        )}>
          {action.replace('_', ' ')}
        </div>
        
        {/* Smart Money / Warning Icons */}
        <div className="flex items-center gap-2 text-muted">
          {market.smart_money && <Zap size={14} className="text-warning" />}
          {isKilled && <AlertTriangle size={14} className="text-danger/70" />}
        </div>
      </div>
    </div>
  );
}
