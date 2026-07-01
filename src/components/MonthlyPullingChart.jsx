import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area,
} from 'recharts'

const START = { y: 2026, m: 7 }
const END   = { y: 2027, m: 12 }
const CATS = [
  { key: 'power',   label: 'Power',   color: '#8b7dff' },
  { key: 'control', label: 'Control', color: '#65d5ea' },
  { key: 'iac',     label: 'I&C',     color: '#fdbb63' },
  { key: 'pkg',     label: 'PKG',     color: '#63d09b' },
]
const CAT_ID_BY_LABEL = { Power: 'power', Control: 'control', 'I&C': 'iac', PKG: 'pkg' }

function buildMonths() {
  const out = []
  let y = START.y, m = START.m
  while (y < END.y || (y === END.y && m <= END.m)) {
    out.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: `${String(y).slice(2)}.${String(m).padStart(2, '0')}` })
    m++
    if (m > 12) { m = 1; y++ }
  }
  return out
}

function monthKeyOf(dateStr) {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.length < 7) return null
  return dateStr.slice(0, 7)
}

function num(v) {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div style={{
      background: '#fff', border: '1px solid #e3e8ee', borderRadius: 8,
      padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,55,112,0.08)',
      fontSize: 13, fontFeatureSettings: '"tnum"', minWidth: 180,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: '#0d253d' }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#64748d' }}>{p.dataKey}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 500, color: '#0d253d' }}>{Math.round(p.value).toLocaleString()} m</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #eef0f6', marginTop: 7, paddingTop: 6, display: 'flex', gap: 8 }}>
        <span style={{ color: '#64748d', fontWeight: 500 }}>Total</span>
        <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#533afd' }}>{Math.round(total).toLocaleString()} m</span>
      </div>
    </div>
  )
}

export default function MonthlyPullingChart({ fieldData, master }) {
  const data = useMemo(() => {
    const months = buildMonths()
    const buckets = new Map(months.map(m => [m.key, { name: m.label, Power: 0, Control: 0, 'I&C': 0, PKG: 0 }]))
    const mmap = new Map((master || []).map(c => [c.n, c]))

    for (const [cno, e] of Object.entries(fieldData || {})) {
      if (!e?.pullingDate) continue
      const key = monthKeyOf(e.pullingDate)
      if (!buckets.has(key)) continue
      const cab = mmap.get(cno)
      const catLabel = cab?.g
      const catKey = catLabel === 'Power' ? 'Power'
                   : catLabel === 'Control' ? 'Control'
                   : catLabel === 'I&C' ? 'I&C'
                   : catLabel === 'PKG' ? 'PKG' : null
      if (!catKey) continue
      const length = num(e.pulledLength) || (cab?.l || 0)
      buckets.get(key)[catKey] += length
    }
    return Array.from(buckets.values())
  }, [fieldData, master])

  const allZero = data.every(d => !d.Power && !d.Control && !d['I&C'] && !d.PKG)

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-title">Monthly Pulling Trend</span>
        <span className="chart-subtitle">2026.07 – 2027.12 · by Category (m)</span>
      </div>
      <div style={{ position: 'relative' }}>
        {allZero && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2, pointerEvents: 'none',
          }}>
            <span style={{
              fontSize: 14, color: '#64748d', background: 'rgba(246,249,252,0.9)',
              padding: '8px 20px', borderRadius: 9999, border: '1px solid #e3e8ee',
            }}>
              실적 데이터가 입력되면 그래프가 표시됩니다
            </span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 20, right: 24, left: 0, bottom: 8 }}>
            <defs>
              {CATS.map(c => (
                <linearGradient id={`mp-grad-${c.key}`} key={c.key} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={c.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#64748d', fontSize: 11, fontFeatureSettings: '"tnum"' }}
              axisLine={{ stroke: '#e3e8ee' }}
              tickLine={false}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis
              tick={{ fill: '#64748d', fontSize: 12, fontFeatureSettings: '"tnum"' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#c5c9d9', strokeWidth: 1, strokeDasharray: '4 3' }} />
            <Legend iconType="circle" iconSize={8}
              wrapperStyle={{ fontSize: 12, color: '#64748d', paddingTop: 8 }} />
            {CATS.map(c => (
              <Line
                key={c.key}
                type="monotone"
                dataKey={c.label}
                stroke={c.color}
                strokeWidth={2.2}
                dot={{ r: 3, fill: c.color, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: c.color, stroke: '#fff', strokeWidth: 2 }}
                fill={`url(#mp-grad-${c.key})`}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
