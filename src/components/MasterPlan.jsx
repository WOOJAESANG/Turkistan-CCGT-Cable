import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  ComposedChart, Bar, Area,
} from 'recharts'
import { loadMilestoneTargets, saveMilestoneTarget, resetMilestoneTarget, loadFieldData } from '../lib/dataStore'

const UNIT1 = [
  { name: 'Power Receiving',         cust: '2026-10-30', custCable: '2026-08-01', l3: '2027-02-05', l3Cable: '2026-11-07', gap: '~3.2 mo' },
  { name: 'GTG #11 Initial Firing',  cust: '2026-11-23', custCable: '2026-08-25', l3: '2027-04-06', l3Cable: '2027-01-06', gap: '~4.4 mo' },
  { name: 'GTG #11 Synchronization', cust: '2026-12-22', custCable: '2026-09-23', l3: '2027-05-05', l3Cable: '2027-02-04', gap: '~4.4 mo' },
  { name: 'GTG #12 Synchronization', cust: '2027-01-20', custCable: '2026-10-22', l3: '2027-06-03', l3Cable: '2027-03-05', gap: '~4.4 mo' },
  { name: 'STG #10 Synchronization', cust: '2027-07-11', custCable: '2027-04-12', l3: '2027-11-22', l3Cable: '2027-08-24', gap: '~4.4 mo', finish: true },
]
const UNIT2 = [
  { name: 'GTG #21 Initial Firing',  cust: '2027-01-15', custCable: '2026-10-17', l3: '2027-05-29', l3Cable: '2027-02-28', gap: '~4.4 mo' },
  { name: 'GTG #21 Synchronization', cust: '2027-02-12', custCable: '2026-11-14', l3: '2027-06-26', l3Cable: '2027-03-28', gap: '~4.4 mo' },
  { name: 'GTG #22 Synchronization', cust: '2027-03-14', custCable: '2026-12-14', l3: '2027-07-26', l3Cable: '2027-04-27', gap: '~4.4 mo' },
  { name: 'STG #20 Synchronization', cust: '2027-09-19', custCable: '2027-06-21', l3: '2028-01-31', l3Cable: '2027-11-02', gap: '~4.4 mo', finish: true },
]

const MONTHS = ['2026-07','2026-08','2026-09','2026-10','2026-11','2026-12','2027-01','2027-02','2027-03','2027-04','2027-05','2027-06','2027-07','2027-08','2027-09','2027-10','2027-11','2027-12']
const OWNER_MONTHLY = [56380,210585,397950,429915,233757,72846,3795,0,0,0,0,0,0,0,0,0,0,0]
const OWNER_CUM = [4.0,19.0,47.3,77.9,94.5,99.7,100.0,100.0,100.0,100.0,100.0,100.0,100.0,100.0,100.0,100.0,100.0,100.0]
const TOTAL_M = 1405228

const label = m => { const [y,mm] = m.split('-'); return `'${y.slice(2)}.${mm}` }

const TODAY_KEY = new Date().toISOString().slice(0, 7)
const TODAY_LABEL = label(TODAY_KEY)

const T0 = new Date('2026-07-01')
const day = s => Math.round((new Date(s) - T0) / 86400000)
const ALL_MILESTONES = [...UNIT1, ...UNIT2]
const TIMELINE_DATA = ALL_MILESTONES.map(r => ({
  name: r.name.replace(' Synchronization', ' Sync').replace(' Initial Firing', ' IF'),
  custDue: r.custCable, custEvent: r.cust, l3Due: r.l3Cable, l3Event: r.l3,
  custOffset: day(r.custCable), custSpan: day(r.cust) - day(r.custCable),
  l3Offset: day(r.l3Cable), l3Span: day(r.l3) - day(r.l3Cable),
}))
const TL_END = day('2028-03-01')
const TL_TICKS = []
{
  let d = new Date(T0)
  while (d <= new Date('2028-03-01')) {
    TL_TICKS.push(day(d.toISOString().slice(0, 10)))
    d = new Date(d.getFullYear(), d.getMonth() + 3, 1)
  }
}
const tlLabel = v => {
  const d = new Date(T0.getTime() + v * 86400000)
  return `'${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

const C_OWNER = '#94a3b8'
const C_ACTUAL = '#ef4444'
const C_CABLE_OWNER = '#f59e0b'
const C_L3 = '#533afd'

function TimelineTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div style={{
      background: '#fff', border: '1px solid #e3e8ee', borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,55,112,0.08)', fontSize: 12.5,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#0d253d' }}>{d.name}</div>
      <div style={{ color: '#b45309', marginBottom: 2 }}>
        Cust. Req — cable due <b>{d.custDue}</b> → event <b>{d.custEvent}</b>
      </div>
      <div style={{ color: '#533afd' }}>
        L3 — cable due <b>{d.l3Due}</b> → event <b>{d.l3Event}</b>
      </div>
    </div>
  )
}

function MonthlyTooltip({ active, payload, label: lb }) {
  if (!active || !payload?.length) return null
  const plan = payload.find(p => p.dataKey === 'Customer Required')?.value
  const actual = payload.find(p => p.dataKey === 'Actual')?.value
  return (
    <div style={{
      background: '#fff', border: '1px solid #e3e8ee', borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,55,112,0.08)', fontSize: 13,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#0d253d' }}>{lb}</div>
      {plan != null && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C_OWNER, flexShrink: 0 }} />
          <span style={{ color: '#64748d' }}>Customer Required</span>
          <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#0d253d', paddingLeft: 12 }}>{Math.round(plan).toLocaleString()} m</span>
        </div>
      )}
      {actual != null && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C_ACTUAL, flexShrink: 0 }} />
          <span style={{ color: '#64748d' }}>Actual</span>
          <span style={{ marginLeft: 'auto', fontWeight: 600, color: C_ACTUAL, paddingLeft: 12 }}>{Math.round(actual).toLocaleString()} m</span>
        </div>
      )}
      {plan != null && actual != null && (
        <div style={{ borderTop: '1px solid #eef0f6', marginTop: 6, paddingTop: 6, display: 'flex', gap: 8 }}>
          <span style={{ color: '#64748d' }}>Gap</span>
          <span style={{ marginLeft: 'auto', fontWeight: 700, color: actual < plan ? '#ef4444' : '#22c55e' }}>
            {actual < plan ? '▼' : '▲'} {Math.abs(Math.round(plan - actual)).toLocaleString()} m
          </span>
        </div>
      )}
    </div>
  )
}

function SCurveTooltip({ active, payload, label: lb }) {
  if (!active || !payload?.length) return null
  const plan = payload.find(p => p.dataKey === 'Customer Required')?.value
  const actual = payload.find(p => p.dataKey === 'Actual')?.value
  const gap = (plan != null && actual != null) ? plan - actual : null
  return (
    <div style={{
      background: '#fff', border: '1px solid #e3e8ee', borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,55,112,0.08)', fontSize: 13,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#0d253d' }}>{lb}</div>
      {plan != null && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C_OWNER, flexShrink: 0 }} />
          <span style={{ color: '#64748d' }}>Customer Required</span>
          <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#0d253d', paddingLeft: 12 }}>{plan}%</span>
        </div>
      )}
      {actual != null && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C_ACTUAL, flexShrink: 0 }} />
          <span style={{ color: '#64748d' }}>Actual</span>
          <span style={{ marginLeft: 'auto', fontWeight: 600, color: C_ACTUAL, paddingLeft: 12 }}>{actual.toFixed(1)}%</span>
        </div>
      )}
      {gap != null && gap > 0 && (
        <div style={{ borderTop: '1px solid #eef0f6', marginTop: 6, paddingTop: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: '#64748d' }}>지연</span>
            <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#ef4444' }}>▼ {gap.toFixed(1)}%p</span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 3 }}>
            ≈ {Math.round(gap / 100 * TOTAL_M).toLocaleString()} m 미달
          </div>
        </div>
      )}
    </div>
  )
}

function MilestoneRows({ rows, targets, onTarget, admin, viewer }) {
  return rows.map(r => {
    const override = targets[r.name]
    const isDefault = !override
    return (
      <tr key={r.name} className={r.finish ? 'mpl-finish-row' : ''}>
        <td className="mpl-metric">{r.name}</td>
        <td className="mpl-owner">{r.cust}</td>
        <td className="mpl-cable-owner">{r.custCable}</td>
        <td className="mpl-l3">{r.l3}</td>
        <td className="mpl-cable-l3">{r.l3Cable}</td>
        <td className="mpl-target-cell">
          <input
            type="date"
            disabled={viewer}
            className={`mpl-target-input${isDefault ? ' is-default' : ''}`}
            value={override || r.l3Cable}
            onChange={e => e.target.value && onTarget(r.name, e.target.value)}
            title={isDefault ? 'Default: L3 cable due (L3 event − 90 days)' : 'Edited target date'}
          />
          {!isDefault && admin && (
            <button
              type="button"
              className="mpl-target-reset"
              title="Reset to default (L3 cable due) — admin only"
              onClick={() => onTarget(r.name, null)}
            >↺</button>
          )}
        </td>
        <td className="mpl-gap">{r.gap}</td>
      </tr>
    )
  })
}

export default function MasterPlan({ session }) {
  const admin = session?.user?.user_metadata?.role === 'admin'
  const viewer = session?.user?.user_metadata?.role === 'viewer'
  const [targets, setTargets] = useState(() => ({ ...loadMilestoneTargets() }))
  const [fieldData, setFieldData] = useState({})
  const [master, setMaster] = useState([])

  useEffect(() => {
    fetch('/cable-data.json').then(r => r.json()).then(setMaster).catch(() => {})
    const refresh = () => setFieldData({ ...loadFieldData() })
    refresh()
    window.addEventListener('field-data-update', refresh)
    window.addEventListener('milestone-targets-update', () => setTargets({ ...loadMilestoneTargets() }))
    return () => {
      window.removeEventListener('field-data-update', refresh)
    }
  }, [])

  // Monthly actual pulling volumes
  const actualMonthly = useMemo(() => {
    const buckets = Object.fromEntries(MONTHS.map(m => [m, 0]))
    const mmap = new Map((master || []).map(c => [c.n, c]))
    for (const [cno, e] of Object.entries(fieldData || {})) {
      if (!e?.pullingDate) continue
      const key = e.pullingDate.slice(0, 7)
      if (key in buckets) buckets[key] += mmap.get(cno)?.l || 0
    }
    return MONTHS.map(m => buckets[m])
  }, [fieldData, master])

  // Cumulative actual %
  const actualCum = useMemo(() => {
    let sum = 0
    return actualMonthly.map(v => { sum += v; return Math.round(sum / TOTAL_M * 1000) / 10 })
  }, [actualMonthly])

  const hasActual = actualMonthly.some(v => v > 0)

  // Current month index
  const todayIdx = MONTHS.indexOf(TODAY_KEY)

  // Gap: plan - actual at current month (for KPI)
  const planAtToday = todayIdx >= 0 ? OWNER_CUM[todayIdx] : null
  const actualAtToday = todayIdx >= 0 ? actualCum[todayIdx] : null
  const gapPct = (planAtToday != null && actualAtToday != null) ? planAtToday - actualAtToday : null
  const gapM = gapPct != null ? Math.round(gapPct / 100 * TOTAL_M) : null

  const MONTHLY_DATA = useMemo(() => MONTHS.map((m, i) => {
    const entry = { name: label(m), 'Customer Required': OWNER_MONTHLY[i] }
    if (actualMonthly[i] > 0) entry['Actual'] = actualMonthly[i]
    return entry
  }), [actualMonthly])

  const CUM_DATA = useMemo(() => MONTHS.map((m, i) => {
    const entry = { name: label(m), 'Customer Required': OWNER_CUM[i] }
    if (actualCum[i] > 0) entry['Actual'] = actualCum[i]
    return entry
  }), [actualCum])

  const handleTarget = (name, date) => {
    if (viewer) return
    if (date) saveMilestoneTarget(name, date)
    else resetMilestoneTarget(name)
  }

  return (
    <div className="content-body">
      <div className="page-header">
        <h2>Cable Master Plan</h2>
        <span className="cs-total">Customer Required Schedule</span>
      </div>

      <div className="mpl-callout">
        ⚠️ <div>
          <b>Power Receiving 케이블 완료 기한 2026-08-01</b> — Customer Required 기준. GTG #11 Synchronization 케이블
          완료 기한은 <b>2026-09-23</b>, 이벤트 일자 <b>2026-12-22</b>.
          {hasActual && gapM != null && gapM > 0 && (
            <> 현재 실적 기준 계획 대비 <b style={{ color: '#ef4444' }}>{gapM.toLocaleString()} m ({gapPct?.toFixed(1)}%p) 지연</b> 상태.</>
          )}
        </div>
      </div>

      <div className="mpl-kpi-row">
        <div className="mpl-kpi">
          <div className="mpl-kpi-label">⚡ Power Receiving 케이블 기한</div>
          <div className="mpl-kpi-value" style={{ color: '#b45309' }}>2026-08-01</div>
          <div className="mpl-kpi-sub">Customer Required — PR 이벤트 2026-10-30</div>
        </div>
        <div className="mpl-kpi">
          <div className="mpl-kpi-label">GTG #11 Sync 케이블 기한</div>
          <div className="mpl-kpi-value" style={{ color: '#7c3aed' }}>2026-09-23</div>
          <div className="mpl-kpi-sub">Customer Required — 이벤트 2026-12-22</div>
        </div>
        <div className="mpl-kpi">
          <div className="mpl-kpi-label">계획 누적 (이번달)</div>
          <div className="mpl-kpi-value" style={{ color: C_OWNER }}>
            {planAtToday != null ? `${planAtToday}%` : '—'}
          </div>
          <div className="mpl-kpi-sub">Customer Required 기준</div>
        </div>
        <div className="mpl-kpi">
          <div className="mpl-kpi-label">실적 지연</div>
          <div className="mpl-kpi-value" style={{ color: gapM != null && gapM > 0 ? '#ef4444' : '#22c55e' }}>
            {gapM != null ? (gapM > 0 ? `▼ ${gapM.toLocaleString()} m` : '계획 충족') : '—'}
          </div>
          <div className="mpl-kpi-sub">
            {gapPct != null ? `${gapPct.toFixed(1)}%p 미달` : '실적 데이터 집계 중'}
          </div>
        </div>
      </div>

      {/* Milestone Table */}
      <div className="chart-card">
        <div className="chart-card-header">
          <span className="chart-title">Milestone Schedule — with Cable Completion Deadlines</span>
          <span className="chart-subtitle">Cable Due ≈ 3 months lead before each event</span>
        </div>
        <div className="mpl-table-wrap">
          <table className="mpl-table">
            <thead>
              <tr>
                <th>Milestone</th>
                <th>Customer Required</th>
                <th>Cable Due <span className="mpl-th-owner">(Cust. Req)</span></th>
                <th>L3 Schedule</th>
                <th>Cable Due <span className="mpl-th-l3">(L3)</span></th>
                <th>Target Date <span className="mpl-th-target">(editable)</span></th>
                <th>Gap (Cust→L3)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="mpl-section"><td colSpan={7}>Simple Cycle — Unit 1 (GT#11 / GT#12 / ST#10)</td></tr>
              <MilestoneRows rows={UNIT1} targets={targets} onTarget={handleTarget} admin={admin} viewer={viewer} />
              <tr className="mpl-section"><td colSpan={7}>Simple Cycle — Unit 2 (GT#21 / GT#22 / ST#20)</td></tr>
              <MilestoneRows rows={UNIT2} targets={targets} onTarget={handleTarget} admin={admin} viewer={viewer} />
            </tbody>
          </table>
        </div>
        <p className="mpl-note">
          <b>Cable Due</b> = 해당 마일스톤 케이블 작업 완료 기한 (이벤트 90일 전). Source: completion schedule file · 2026-07-04.
        </p>
      </div>

      {/* Timeline Gantt */}
      <div className="chart-card">
        <div className="chart-card-header">
          <span className="chart-title">Milestone Timeline — Cable Due → Event Date</span>
          <span className="chart-subtitle">each bar runs from the cable completion deadline to the milestone event</span>
        </div>
        <ResponsiveContainer width="100%" height={420}>
          <ComposedChart data={TIMELINE_DATA} layout="vertical" margin={{ top: 10, right: 24, left: 8, bottom: 8 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" horizontal={false} />
            <XAxis type="number" domain={[0, TL_END]} ticks={TL_TICKS} tickFormatter={tlLabel}
              tick={{ fill: '#64748d', fontSize: 11 }} axisLine={{ stroke: '#e3e8ee' }} tickLine={false} />
            <YAxis type="category" dataKey="name" width={120}
              tick={{ fill: '#5b5f77', fontSize: 11.5 }} axisLine={false} tickLine={false} />
            <Tooltip content={<TimelineTooltip />} cursor={{ fill: 'rgba(83,58,253,0.04)' }} />
            <ReferenceLine x={day(new Date().toISOString().slice(0,10))} stroke="#dc2626" strokeWidth={2}
              label={{ value: 'TODAY', fill: '#dc2626', fontSize: 10, fontWeight: 700, position: 'top' }} />
            <Bar dataKey="custOffset" stackId="cust" fill="transparent" barSize={9} isAnimationActive={false} />
            <Bar dataKey="custSpan" stackId="cust" fill={C_CABLE_OWNER} barSize={9} radius={[4,4,4,4]} isAnimationActive={false} />
            <Bar dataKey="l3Offset" stackId="l3" fill="transparent" barSize={9} isAnimationActive={false} />
            <Bar dataKey="l3Span" stackId="l3" fill={C_L3} barSize={9} radius={[4,4,4,4]} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mpl-legend">
          <span><i className="mpl-sw" style={{ background: C_CABLE_OWNER }} />Customer Required (cable due → event)</span>
          <span><i className="mpl-sw" style={{ background: C_L3 }} />L3 Schedule (cable due → event)</span>
          <span><i className="mpl-sw" style={{ background: '#dc2626' }} />TODAY</span>
        </div>
      </div>

      {/* Monthly Pulling Plan */}
      <div className="chart-card">
        <div className="chart-card-header">
          <span className="chart-title">Monthly Pulling Plan — Customer Required vs 실적</span>
          <span className="chart-subtitle">m / month · Customer Required 기준</span>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={MONTHLY_DATA} margin={{ top: 20, right: 24, left: 0, bottom: 8 }}>
            <defs>
              <linearGradient id="grad-actual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C_ACTUAL} stopOpacity={0.18} />
                <stop offset="100%" stopColor={C_ACTUAL} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#64748d', fontSize: 11 }} axisLine={{ stroke: '#e3e8ee' }}
              tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
            <YAxis tick={{ fill: '#64748d', fontSize: 12 }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip content={<MonthlyTooltip />} cursor={{ stroke: '#c5c9d9', strokeWidth: 1, strokeDasharray: '4 3' }} />
            {/* PR 마커 */}
            <ReferenceLine x="'26.10" stroke="#b45309" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: 'PR', fill: '#b45309', fontSize: 10, fontWeight: 700, position: 'top' }} />
            {/* GTG #11 Sync 마커 */}
            <ReferenceLine x="'26.12" stroke="#7c3aed" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: 'GTG#11 Sync', fill: '#7c3aed', fontSize: 10, fontWeight: 700, position: 'top' }} />
            {/* TODAY */}
            <ReferenceLine x={TODAY_LABEL} stroke="#dc2626" strokeWidth={1.5}
              label={{ value: 'TODAY', fill: '#dc2626', fontSize: 9, fontWeight: 700, position: 'insideTopLeft' }} />
            <Line type="monotone" dataKey="Customer Required" stroke={C_OWNER} strokeWidth={2.4}
              strokeDasharray="6 4" dot={false} />
            {hasActual && (
              <Line type="monotone" dataKey="Actual" stroke={C_ACTUAL} strokeWidth={2.4}
                dot={{ r: 3.5, fill: C_ACTUAL, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: C_ACTUAL, stroke: '#fff', strokeWidth: 2 }}
                connectNulls={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
        <div className="mpl-legend">
          <span><i className="mpl-sw" style={{ background: C_OWNER }} />Customer Required (계획)</span>
          {hasActual && <span><i className="mpl-sw" style={{ background: C_ACTUAL }} />Actual (실적)</span>}
          <span><i className="mpl-sw" style={{ background: '#b45309' }} />PR (2026-10-30)</span>
          <span><i className="mpl-sw" style={{ background: '#7c3aed' }} />GTG #11 Sync (2026-12-22)</span>
        </div>
      </div>

      {/* Cumulative S-Curve */}
      <div className="chart-card">
        <div className="chart-card-header">
          <span className="chart-title">누적 S-Curve — 계획 vs 실적</span>
          <span className="chart-subtitle">% of total {TOTAL_M.toLocaleString()} m · 빨간 영역 = 지연</span>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={CUM_DATA} margin={{ top: 20, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#64748d', fontSize: 11 }} axisLine={{ stroke: '#e3e8ee' }}
              tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
            <YAxis domain={[0, 100]} tick={{ fill: '#64748d', fontSize: 12 }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`} />
            <Tooltip content={<SCurveTooltip />} cursor={{ stroke: '#c5c9d9', strokeWidth: 1, strokeDasharray: '4 3' }} />
            <ReferenceLine x={TODAY_LABEL} stroke="#dc2626" strokeWidth={2}
              label={{ value: 'TODAY', fill: '#dc2626', fontSize: 9, fontWeight: 700, position: 'insideBottomLeft' }} />
            <ReferenceLine x="'26.10" stroke="#b45309" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: 'PR', fill: '#b45309', fontSize: 10, fontWeight: 700, position: 'top' }} />
            <ReferenceLine x="'26.12" stroke="#7c3aed" strokeDasharray="4 3" strokeWidth={1.5}
              label={{ value: 'GTG#11', fill: '#7c3aed', fontSize: 10, fontWeight: 700, position: 'top' }} />
            <Line type="monotone" dataKey="Customer Required" stroke={C_OWNER} strokeWidth={2.4}
              strokeDasharray="6 4" dot={false} />
            {hasActual && (
              <Line type="monotone" dataKey="Actual" stroke={C_ACTUAL} strokeWidth={2.8}
                dot={{ r: 3.5, fill: C_ACTUAL, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: C_ACTUAL, stroke: '#fff', strokeWidth: 2 }}
                connectNulls={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
        <div className="mpl-legend">
          <span><i className="mpl-sw" style={{ background: C_OWNER }} />Customer Required (계획)</span>
          {hasActual && <span><i className="mpl-sw" style={{ background: C_ACTUAL }} />Actual (실적)</span>}
          <span><i className="mpl-sw" style={{ background: '#dc2626' }} />TODAY</span>
          {hasActual && gapM != null && gapM > 0 && (
            <span style={{ marginLeft: 'auto', color: '#ef4444', fontWeight: 600, fontSize: 12 }}>
              현재 지연: {gapM.toLocaleString()} m ({gapPct?.toFixed(1)}%p)
            </span>
          )}
        </div>
        {hasActual && gapM != null && gapM > 0 && (
          <p className="mpl-note" style={{ color: '#ef4444' }}>
            Customer Required 대비 <b>{gapPct?.toFixed(1)}%p ({gapM.toLocaleString()} m)</b> 지연.
            Customer Required 달성을 위해 잔여 기간 내 만회 필요.
          </p>
        )}
      </div>
    </div>
  )
}
