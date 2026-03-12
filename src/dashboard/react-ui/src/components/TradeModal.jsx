import { useState } from 'react';
import { useStore } from '../store';
import { SignalRadar } from './SignalRadar';
import { X, TrendingUp, TrendingDown, Target, Zap } from 'lucide-react';
import clsx from 'clsx';

export function TradeModal() {
  const { activeModal, selectedMarket, closeModal, riskState } = useStore();
  const [sizePct, setSizePct] = useState(2);
  const [orderType, setOrderType] = useState('LIMIT');

  if (activeModal !== 'TRADE' || !selectedMarket) return null;

  const market = selectedMarket;
  const balance = 1000; // Simulated
  const tradeSizeUsd = (balance * (sizePct / 100)).toFixed(2);
  
  const currentPrice = market.current_price || 0.50;
  const predictedPrice = market.internal_probability || 0.50;
  const edge = (market.edge || 0) * 100;
  const confidence = (market.confidence || 0) * 100;

  const action = market?.execution?.action || 'HOLD';
  const isKilled = action === 'KILLED';
  const isBuyYes = action === 'BUY_YES';
  
  const modeLabels = { SPRINT: '⚡ Sprint', SWING: '🔥 Swing', MARATHON: '🏔️ Marathon' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        onClick={closeModal}
      />
      
      {/* Modal Body */}
      <div className="relative w-full max-w-[900px] glass-panel rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-bg-900 border-white/10 uppercase tracking-wider text-muted">
                {modeLabels[market.mode || 'SPRINT']}
              </span>
              {market.smart_money && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border bg-warning/10 border-warning/20 text-warning uppercase">
                  <Zap size={10} /> Smart Money
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">
              {market.market_name}
            </h2>
          </div>
          <button 
            onClick={closeModal}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-muted hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2-Column Content */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_400px] divide-y md:divide-y-0 md:divide-x divide-white/5">
          
          {/* Left: Signal Analyzer */}
          <div className="p-6 bg-surface-700/30 flex flex-col gap-6">
            <div className="flex items-center gap-2 font-bold tracking-wider uppercase text-sm text-white">
              <Target size={18} className="text-accent-cyan" /> Signal Analyzer
            </div>
            
            <div className="h-[260px]">
              <SignalRadar market={market} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg-900 p-3 rounded-xl border border-white/5">
                <div className="text-[10px] text-muted tracking-wide uppercase mb-1">Market Price</div>
                <div className="text-2xl font-mono font-bold text-white">{(currentPrice * 100).toFixed(1)}¢</div>
              </div>
              <div className="bg-bg-900 p-3 rounded-xl border border-white/5">
                <div className="text-[10px] text-muted tracking-wide uppercase mb-1">True Probability</div>
                <div className="text-2xl font-mono font-bold text-accent-cyan">{(predictedPrice * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {/* Right: Trade Execution Form */}
          <div className="p-6 flex flex-col gap-6">
            
            {/* Status Banner */}
            <div className={clsx(
              "p-3 rounded-xl border flex items-center justify-between",
              isBuyYes ? "bg-success/10 border-success/20 text-success" 
                : isKilled ? "bg-danger/10 border-danger/20 text-danger"
                : "bg-white/5 border-white/10 text-white"
            )}>
              <span className="font-bold tracking-wide uppercase text-sm">{action.replace('_', ' ')}</span>
              <span className="font-mono font-bold">{Math.abs(edge).toFixed(1)}% Edge</span>
            </div>

            {/* Form */}
            <div className="space-y-5 flex-1 disabled:opacity-50">
              
              {/* Order Type Toggle */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted hidden">Order Type</label>
                <div className="flex bg-bg-900 p-1 rounded-lg border border-white/5">
                  {['MARKET', 'LIMIT', 'TWAP'].map(type => (
                    <button
                      key={type}
                      onClick={() => setOrderType(type)}
                      className={clsx(
                        "flex-1 py-1.5 text-xs font-bold tracking-wider rounded-md transition-all",
                        orderType === type ? "bg-surface-700 text-white shadow" : "text-muted hover:text-white"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Position Size</label>
                  <div className="text-xl font-mono font-bold text-white">${tradeSizeUsd}</div>
                </div>
                
                <input 
                  type="range" 
                  min="0.1" max="10" step="0.1" 
                  value={sizePct}
                  onChange={(e) => setSizePct(e.target.value)}
                  className="w-full accent-accent-cyan"
                />
                
                <div className="flex justify-between text-[10px] font-mono text-muted">
                  <span>0.1%</span>
                  <span className="text-white font-bold bg-white/10 px-2 py-0.5 rounded">{sizePct}%</span>
                  <span>10%</span>
                </div>
              </div>

              {/* Slippage & Spread Metrics */}
              <div className="bg-bg-900 rounded-xl p-4 border border-white/5 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Spread Cost</span>
                  <span className="font-mono text-warning">{(market.market_health?.spread * 100 || 2.0).toFixed(1)}¢</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Est. Slippage</span>
                  <span className="font-mono text-white">0.4%</span>
                </div>
                <div className="border-t border-white/5 pt-3 flex justify-between font-bold text-sm">
                  <span className="text-white">Est. Fill Price</span>
                  <span className="font-mono text-accent-cyan">
                    {(isBuyYes ? currentPrice * 100 + 1.2 : currentPrice * 100 - 1.2).toFixed(1)}¢
                  </span>
                </div>
              </div>
            </div>

            {/* Execute Button */}
            <button 
              disabled={isKilled || riskState.halted}
              className={clsx(
                "w-full py-4 text-sm font-bold uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                isBuyYes ? "bg-success hover:bg-success/90 text-bg-900" 
                  : !isKilled ? "bg-danger hover:bg-danger/90 text-white"
                  : "bg-surface-700 text-muted"
              )}
            >
              {isKilled ? 'Trade Disabled' : `Execute ${action}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
