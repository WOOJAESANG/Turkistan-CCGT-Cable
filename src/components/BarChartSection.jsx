import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

function formatNumber(n) {
  return n.toLocaleString('ko-KR')
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e3e8ee',
      borderRadius: 8,
      padding: '12px 16px',
      boxShadow: '0 8px 24px rgba(0,55,112,0.08)',
      fontSize: 14,
      fontFeatureSettings: '"tnum"',
    }}>
      <div style={{ fontWeight: 500, marginBottom: 8, color: '#0d253d' }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#64748d' }}>{p.name}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 500, color: '#0d253d' }}>{p.value.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

export default function BarChartSection({ categories }) {
  const data = categories.map((c) => ({
    name: c.label,
    Pulling: c.pullPct,
    Termination: c.termPct,
    color: c.color,
  }))

  const allZero = data.every((d) => d.Pulling === 0 && d.Termination === 0)

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-title">Category Progress</span>
        <span className="chart-subtitle">Pulling vs Termination</span>
      </div>
      <div style={{ position: 'relative' }}>
        {allZero && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            pointerEvents: 'none',
          }}>
            <span style={{
              fontSize: 14,
              color: '#64748d',
              background: 'rgba(246,249,252,0.9)',
              padding: '8px 20px',
              borderRadius: 9999,
              border: '1px solid #e3e8ee',
            }}>
              실적 데이터가 입력되면 그래프가 표시됩니다
            </span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} barGap={4} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e3e8ee" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#64748d', fontSize: 14, fontWeight: 400 }}
              axisLine={{ stroke: '#e3e8ee' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748d', fontSize: 13, fontFeatureSettings: '"tnum"' }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(83,58,253,0.04)' }} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 14, color: '#64748d', paddingTop: 8 }}
            />
            <Bar dataKey="Pulling" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
            <Bar dataKey="Termination" radius={[4, 4, 0, 0]} maxBarSize={36} opacity={0.45}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
