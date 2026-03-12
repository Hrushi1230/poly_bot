import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip } from 'recharts';
import { useStore } from '../store';
import clsx from 'clsx';

export function SignalRadar({ market }) {
  if (!market) return null;

  // Map the internal quant signals to a 0-100 radar scale
  const signals = market.signals || {};
  const data = [
    { subject: 'News Sentiment', A: Math.max(0, Math.min(100, (signals.sentiment?.score || 0) * 100)) },
    { subject: 'Alpha (OFI)', A: Math.max(0, Math.min(100, Math.abs(signals.alpha?.ofi || 0) * 100)) },
    { subject: 'Momentum', A: Math.max(0, Math.min(100, (signals.momentum?.strength || 0) * 100)) },
    { subject: 'Smart Money', A: market.smart_money ? 90 : 20 },
    { subject: 'Liquidity', A: Math.max(0, Math.min(100, (market.market_health?.liquidity || 0) / 100000 * 100)) } // Cap scale at 100k
  ];

  /* Format actions for color theme */
  const action = market?.execution?.action || 'HOLD';
  const isKilled = action === 'KILLED';
  const isBuyYes = action === 'BUY_YES';
  const isBuyNo = action === 'BUY_NO';
  
  const strokeColor = isBuyYes ? '#2ECC71' : isBuyNo ? '#FF4D4F' : isKilled ? '#9AA6B2' : '#00E5FF';
  const fillColor = isBuyYes ? 'rgba(46,204,113,0.3)' : isBuyNo ? 'rgba(255,77,79,0.3)' : isKilled ? 'rgba(154,166,178,0.1)' : 'rgba(0,229,255,0.3)';

  return (
    <div className={clsx(
      "w-full h-full bg-surface-700/30 rounded-xl border border-white/5 relative flex items-center justify-center p-2",
      isKilled && "opacity-60 grayscale"
    )}>
      
      {/* Background Grid */}
      <h3 className="absolute top-3 left-4 text-[10px] font-bold tracking-widest uppercase text-muted">
        5-Axis Signal Vector
      </h3>

      <ResponsiveContainer width="100%" height={240}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#9AA6B2', fontSize: 10, fontWeight: 600, textAnchor: 'middle' }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Alpha Signal"
            dataKey="A"
            stroke={strokeColor}
            fill={fillColor}
            fillOpacity={0.8}
            strokeWidth={2}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#141A22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
            itemStyle={{ color: '#00E5FF', fontWeight: 600 }}
            formatter={(value) => [`${value.toFixed(0)}/100`, "Strength"]}
            labelStyle={{ color: '#9AA6B2', fontSize: '12px' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
