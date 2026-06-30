import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

function formatNumber(n) {
  return n.toLocaleString('ko-KR')
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e3e8ee',
      borderRadius: 8,
      padding: '12px 16px',
      boxShadow: '0 8px 24px rgba(0,55,112,0.08)',
      fontSize: 13,
      fontFeatureSettings: '"tnum"',
    }}>
      <div style={{ fontWeight: 500, color: '#0d253d', marginBottom: 4 }}>{d.name}</div>
      <div style={{ color: '#64748d' }}>{formatNumber(d.value)}m</div>
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
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={13}
      fontWeight={500}
      style={{ fontFeatureSettings: '"tnum"' }}
    >
      {(percent * 100).toFixed(1)}%
    </text>
  )
}

export default function PieChartSection({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const totalLines = data.reduce((s, d) => s + (d.lineCount || 0), 0)

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-title">Priority Distribution</span>
        <span className="chart-subtitle">전체 (ELEC + I&C + PKG)</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={CustomLabel}
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="pie-legend">
        {data.map((d) => (
          <div className="pie-legend-item" key={d.name}>
            <span className="pie-legend-dot" style={{ background: d.color }} />
            <span className="pie-legend-name">{d.name}</span>
            <span className="pie-legend-value">{formatNumber(d.value)}m ({formatNumber(d.lineCount)} Line)</span>
          </div>
        ))}
        <div className="pie-legend-item" style={{ borderTop: '1px solid var(--hairline)', paddingTop: 8 }}>
          <span className="pie-legend-dot" style={{ background: 'transparent' }} />
          <span className="pie-legend-name" style={{ fontWeight: 500 }}>Total</span>
          <span className="pie-legend-value">{formatNumber(total)}m ({formatNumber(totalLines)} Line)</span>
        </div>
      </div>
    </div>
  )
}
