import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

function formatNumber(n) {
  return Math.round(n).toLocaleString('ko-KR')
}

function CustomTooltip({ active, payload, pulled }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const done = pulled?.[d.name] || 0
  const pct = d.value > 0 ? (done / d.value * 100) : 0
  return (
    <div style={{
      background: '#fff', border: '1px solid #e3e8ee', borderRadius: 8,
      padding: '12px 14px', boxShadow: '0 8px 24px rgba(0,55,112,0.08)',
      fontSize: 13, fontFeatureSettings: '"tnum"', minWidth: 190,
    }}>
      <div style={{ fontWeight: 600, color: '#0d253d', marginBottom: 6 }}>{d.name}</div>
      <div style={{ display: 'flex', gap: 8, color: '#64748d', fontSize: 12 }}>
        <span>Pulled</span>
        <span style={{ marginLeft: 'auto', fontWeight: 600, color: d.payload.color }}>
          {formatNumber(done)}m
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, color: '#64748d', fontSize: 12, marginTop: 3 }}>
        <span>Designed</span>
        <span style={{ marginLeft: 'auto', fontWeight: 500, color: '#0d253d' }}>
          {formatNumber(d.value)}m
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6, paddingTop: 6, borderTop: '1px solid #eef0f6' }}>
        <span style={{ color: '#64748d', fontSize: 12 }}>Progress</span>
        <span style={{ marginLeft: 'auto', fontWeight: 700, color: d.payload.color }}>
          {pct.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      fontSize={13} fontWeight={500} style={{ fontFeatureSettings: '"tnum"' }}>
      {(percent * 100).toFixed(1)}%
    </text>
  )
}

export default function PieChartSection({ data, pulled = {} }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const totalPulled = data.reduce((s, d) => s + (pulled[d.name] || 0), 0)
  const overallPct = total > 0 ? (totalPulled / total * 100) : 0

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-title">Priority Distribution</span>
        <span className="chart-subtitle">Progress by Priority</span>
      </div>
      <div className="pie-shell">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data} cx="50%" cy="50%"
              innerRadius={58} outerRadius={92} paddingAngle={2}
              dataKey="value" labelLine={false} label={CustomLabel} stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip pulled={pulled} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pie-center">
          <div className="pie-center-pct">{overallPct.toFixed(1)}<span>%</span></div>
          <div className="pie-center-label">Pulled</div>
        </div>
      </div>

      <div className="pie-legend">
        {data.map((d) => {
          const done = pulled[d.name] || 0
          const pct = d.value > 0 ? Math.min(100, (done / d.value * 100)) : 0
          return (
            <div className="pie-legend-item pri-row" key={d.name}>
              <div className="pri-row-head">
                <span className="pie-legend-dot" style={{ background: d.color }} />
                <span className="pie-legend-name">{d.name}</span>
                <span className="pri-pct" style={{ color: d.color }}>{pct.toFixed(1)}%</span>
              </div>
              <div className="pri-bar-track">
                <div className="pri-bar-fill" style={{ width: `${Math.max(pct, 0.4)}%`, background: d.color }} />
              </div>
              <div className="pri-nums">
                <span className="pri-done">{formatNumber(done)}m</span>
                <span className="pri-slash"> / </span>
                <span className="pri-total">{formatNumber(d.value)}m</span>
                <span className="pri-lines">· {formatNumber(d.lineCount)} Line</span>
              </div>
            </div>
          )
        })}
        <div className="pie-legend-item pri-row pri-total-row">
          <div className="pri-row-head">
            <span className="pie-legend-dot" style={{ background: 'transparent' }} />
            <span className="pie-legend-name" style={{ fontWeight: 600 }}>Total</span>
            <span className="pri-pct" style={{ color: '#533afd' }}>{overallPct.toFixed(1)}%</span>
          </div>
          <div className="pri-nums">
            <span className="pri-done">{formatNumber(totalPulled)}m</span>
            <span className="pri-slash"> / </span>
            <span className="pri-total">{formatNumber(total)}m</span>
          </div>
        </div>
      </div>
    </div>
  )
}
