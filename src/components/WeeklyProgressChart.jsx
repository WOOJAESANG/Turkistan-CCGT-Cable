import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { CHART_START as START, CHART_END as END } from '../data/constants'

const TOTAL_WEEKS = 78

function isoWeekKey(dateStr) {
  if (!dateStr || dateStr.length < 10) return null
  const d = new Date(dateStr)
  if (isNaN(d)) return null
  const day = d.getDay() || 7
  d.setDate(d.getDate() + 4 - day)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function buildWeeks() {
  const weeks = []
  const d = new Date(START.y, START.m - 1, 1)
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1)
  const end = new Date(END.y, END.m, 0)
  while (d <= end) {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const label = `${mm}.${dd}`
    const key = isoWeekKey(d.toISOString().slice(0, 10))
    weeks.push({ key, label })
    d.setDate(d.getDate() + 7)
  }
  return weeks
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const pull = payload.find(p => p.dataKey === 'pull')?.value || 0
  const term = payload.find(p => p.dataKey === 'term')?.value || 0
  return (
    <div style={{
      background: '#fff', border: '1px solid #e3e8ee', borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,55,112,0.08)',
      fontSize: 12, fontFeatureSettings: '"tnum"', minWidth: 160,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#0d253d' }}>Week of {label}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#533afd', flexShrink: 0 }} />
        <span style={{ color: '#64748d' }}>Pulling</span>
        <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#0d253d' }}>{Math.round(pull).toLocaleString()} m</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#06b6d4', flexShrink: 0 }} />
        <span style={{ color: '#64748d' }}>Termination</span>
        <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#0d253d' }}>{Math.round(term).toLocaleString()} P</span>
      </div>
    </div>
  )
}

export default function WeeklyProgressChart({ fieldData, master, totalDesignedLength }) {
  const weeklyTarget = Math.round(totalDesignedLength / TOTAL_WEEKS)

  const data = useMemo(() => {
    const weeks = buildWeeks()
    const buckets = new Map(weeks.map(w => [w.key, { name: w.label, pull: 0, term: 0 }]))
    const mmap = new Map((master || []).map(c => [c.n, c]))

    for (const [cno, e] of Object.entries(fieldData || {})) {
      const cab = mmap.get(cno)
      if (!cab) continue
      if (e?.pullingDate) {
        const wk = isoWeekKey(e.pullingDate)
        if (buckets.has(wk)) buckets.get(wk).pull += cab.l || 0
      }
      if (e?.termDateFrom) {
        const wk = isoWeekKey(e.termDateFrom)
        if (buckets.has(wk)) buckets.get(wk).term += 1
      }
      if (e?.termDateTo) {
        const wk = isoWeekKey(e.termDateTo)
        if (buckets.has(wk)) buckets.get(wk).term += 1
      }
    }
    return Array.from(buckets.values())
  }, [fieldData, master])

  const maxPull = Math.max(...data.map(d => d.pull), weeklyTarget * 1.2)
  const allZero = data.every(d => !d.pull && !d.term)

  return (
    <div className="chart-card wpc-card">
      <div className="chart-card-header">
        <span className="chart-title">Weekly Construction Progress</span>
        <span className="chart-subtitle">Target: {weeklyTarget.toLocaleString()} m/wk ({TOTAL_WEEKS}wk)</span>
      </div>
      <div className="wpc-legend-row">
        <span className="wpc-legend-item"><span className="wpc-dot" style={{ background: '#533afd' }} />Pulling (m)</span>
        <span className="wpc-legend-item"><span className="wpc-dot" style={{ background: '#06b6d4' }} />Termination (P)</span>
        <span className="wpc-legend-item"><span className="wpc-line" />Weekly Target</span>
      </div>
      <div style={{ position: 'relative' }}>
        {allZero && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2, pointerEvents: 'none',
          }}>
            <span style={{
              fontSize: 13, color: '#64748d', background: 'rgba(246,249,252,0.92)',
              padding: '8px 20px', borderRadius: 9999, border: '1px solid #e3e8ee',
            }}>
              실적 데이터가 입력되면 차트가 표시됩니다
            </span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} barGap={1} barSize={10}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#64748d', fontSize: 10, fontFeatureSettings: '"tnum"' }}
              axisLine={{ stroke: '#e3e8ee' }}
              tickLine={false}
              interval="preserveStartEnd"
              angle={-35}
              textAnchor="end"
              height={45}
            />
            <YAxis
              tick={{ fill: '#64748d', fontSize: 11, fontFeatureSettings: '"tnum"' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
              domain={[0, Math.ceil(maxPull / 10000) * 10000]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(83,58,253,0.04)' }} />
            <ReferenceLine
              y={weeklyTarget}
              stroke="#16a34a"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `Target ${weeklyTarget.toLocaleString()}`,
                position: 'right',
                fill: '#16a34a',
                fontSize: 10,
                fontWeight: 600,
              }}
            />
            <Bar dataKey="pull" name="Pulling" fill="#533afd" radius={[3, 3, 0, 0]} />
            <Bar dataKey="term" name="Termination" fill="#06b6d4" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
