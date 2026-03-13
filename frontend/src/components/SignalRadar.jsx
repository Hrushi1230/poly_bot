import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip } from 'recharts';

export function SignalRadar({ market }) {
  const signals = market?.signals || {};
  const data = [
    { axis: 'News',       v: Math.max(0, Math.min(100, (signals.sentiment?.score || 0.5) * 100)) },
    { axis: 'Alpha',      v: Math.max(0, Math.min(100, Math.abs(signals.alpha?.ofi || 0.3) * 100)) },
    { axis: 'Momentum',   v: Math.max(0, Math.min(100, (signals.momentum?.strength || 0.4) * 100)) },
    { axis: 'SmartMoney', v: market?.smart_money ? 85 : 25 },
    { axis: 'Sentiment',  v: Math.max(0, Math.min(100, (signals.sentiment?.magnitude || 0.6) * 100)) },
  ];

  const action = market?.execution?.action || 'HOLD';
  const stroke = action === 'BUY_YES' ? '#2ECC71' : action === 'BUY_NO' ? '#FF4D4F' : '#00E5FF';
  const fill   = action === 'BUY_YES' ? 'rgba(46,204,113,0.25)' : action === 'BUY_NO' ? 'rgba(255,77,79,0.25)' : 'rgba(0,229,255,0.2)';

  return (
    <div className="glass-panel rounded-card p-4 relative">
      <h3 className="text-[10px] font-bold tracking-widest uppercase text-muted mb-2">
        5-Axis Signal Radar
      </h3>
      
      {/* Pulsing center dot */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
        <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(0,229,255,0.6)] animate-pulse" />
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis 
            dataKey="axis" 
            tick={{ fill: '#9AA6B2', fontSize: 10, fontWeight: 600 }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Signal"
            dataKey="v"
            stroke={stroke}
            fill={fill}
            fillOpacity={0.8}
            strokeWidth={2}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#101620', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
            itemStyle={{ color: '#00E5FF', fontWeight: 600 }}
            formatter={(val) => [`${val.toFixed(0)}/100`, 'Strength']}
            labelStyle={{ color: '#9AA6B2' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
