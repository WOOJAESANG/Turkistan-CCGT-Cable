import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  ComposedChart, Bar, Area, LabelList,
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
// Even distribution of total scope across all 18 months (bar chart plan baseline)
const BAR_TARGET_BASE = Math.floor(TOTAL_M / MONTHS.length)
const BAR_TARGET_REM = TOTAL_M - BAR_TARGET_BASE * MONTHS.length
const BAR_MONTHLY = MONTHS.map((_, i) => BAR_TARGET_BASE + (i < BAR_TARGET_REM ? 1 : 0))

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
  const plan = (payload.find(p => p.dataKey === 'Monthly Target') ?? payload.find(p => p.dataKey === 'Customer Required'))?.value
  const planLabel = payload.find(p => p.dataKey === 'Monthly Target') ? 'Monthly Target' : 'Customer Required'
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
          <span style={{ color: '#64748d' }}>{planLabel}</span>
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
            <span style={{ color: '#64748d' }}>Delay</span>
            <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#ef4444' }}>▼ {gap.toFixed(1)}%p</span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 3 }}>
            ≈ {Math.round(gap / 100 * TOTAL_M).toLocaleString()} m behind
          </div>
        </div>
      )}
    </div>
  )
}

// Milestone target %: Customer Required cumulative at month of event
const PR_TARGET_PCT   = 77.9  // Oct 2026 → Power Receiving
const GTG11_TARGET_PCT = 94.5  // Dec 2026 → GTG #11 Sync

function projectDate(actualMonthly, targetPct) {
  const totalActual = actualMonthly.reduce((s, v) => s + v, 0)
  const targetM = targetPct / 100 * TOTAL_M
  if (totalActual <= 0) return null
  // days elapsed in project (Jul 1 = day 0)
  const T0date = new Date('2026-07-01')
  const today = new Date()
  const daysElapsed = Math.max(1, Math.round((today - T0date) / 86400000))
  const dailyRate = totalActual / daysElapsed
  const remaining = Math.max(0, targetM - totalActual)
  const daysNeeded = remaining / dailyRate
  const projected = new Date(today.getTime() + daysNeeded * 86400000)
  return projected
}

function fmt(d) {
  if (!d) return '—'
  return d.toISOString().slice(0, 7)
}

function monthsDiff(a, b) {
  return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth())
}

function ProjectionPanel({ actualMonthly, hasActual, gapM, gapPct }) {
  const prProj   = projectDate(actualMonthly, PR_TARGET_PCT)
  const gtg11Proj = projectDate(actualMonthly, GTG11_TARGET_PCT)
  const prCust   = new Date('2026-10-30')
  const gtg11Cust = new Date('2026-12-22')
  const prDelay   = prProj   ? monthsDiff(prProj, prCust)   : null
  const gtg11Delay = gtg11Proj ? monthsDiff(gtg11Proj, gtg11Cust) : null

  const row = (label, custDate, proj, delay) => (
    <div style={{
      padding: '12px 0', borderBottom: '1px solid #eef0f6',
    }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
        Customer Required: <b style={{ color: '#b45309' }}>{custDate}</b>
      </div>
      {hasActual && proj ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: delay > 0 ? '#dc2626' : '#16a34a' }}>
            Projected: {fmt(proj)}
          </div>
          {delay > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 5,
              background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 5,
              padding: '3px 8px', fontSize: 11, fontWeight: 700, color: '#dc2626',
            }}>
              ▲ {delay} month{delay > 1 ? 's' : ''} overrun
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No actual data yet</div>
      )}
    </div>
  )

  return (
    <div style={{
      flexShrink: 0, width: 210,
      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '14px 16px', marginTop: 20,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #e2e8f0' }}>
        Projected at Current Pace
      </div>
      {row('Power Receiving (PR)', '2026-10-30', prProj, prDelay)}
      {row('GTG #11 Sync', '2026-12-22', gtg11Proj, gtg11Delay)}
      {hasActual && gapM != null && gapM > 0 && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fca5a5' }}>
          <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Current Delay</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>{gapM?.toLocaleString()} m</div>
          <div style={{ fontSize: 11, color: '#ef4444' }}>{gapPct?.toFixed(1)}%p behind plan</div>
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
    const entry = { name: label(m), 'Customer Required': OWNER_MONTHLY[i], 'Monthly Target': BAR_MONTHLY[i] }
    if (actualMonthly[i] > 0) entry['Actual'] = actualMonthly[i]
    return entry
  }), [actualMonthly])

  const CUM_DATA = useMemo(() => MONTHS.map((m, i) => {
    const planVal = OWNER_CUM[i]
    const actualVal = actualCum[i]
    const hasData = actualVal > 0
    return {
      name: label(m),
      'Plan': planVal,
      'Actual': hasData ? actualVal : undefined,
      'actualFill': hasData ? actualVal : undefined,
      'gapFill': hasData ? Math.max(0, planVal - actualVal) : undefined,
    }
  }), [actualCum])

  // Weekly pulling actuals (last 12 weeks)
  const WEEKLY_DATA = useMemo(() => {
    const mmap = new Map((master || []).map(c => [c.n, c]))
    const weekBuckets = new Map()
    for (const [cno, e] of Object.entries(fieldData || {})) {
      if (!e?.pullingDate) continue
      const d = new Date(e.pullingDate)
      const dow = d.getUTCDay() || 7
      const mon = new Date(d)
      mon.setUTCDate(d.getUTCDate() - dow + 1)
      const wk = mon.toISOString().slice(0, 10)
      weekBuckets.set(wk, (weekBuckets.get(wk) || 0) + (mmap.get(cno)?.l || 0))
    }
    const sorted = [...weekBuckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    const recent = sorted.slice(-14)
    const rows = recent.map(([weekStart, actual], idx, arr) => {
      const mo = weekStart.slice(0, 7)
      const mi = MONTHS.indexOf(mo)
      const target = mi >= 0 ? Math.round(OWNER_MONTHLY[mi] / 4.33) : 0
      const d2 = new Date(weekStart)
      const lbl = `${d2.getUTCMonth() + 1}/${String(d2.getUTCDate()).padStart(2, '0')}`
      const slice = arr.slice(Math.max(0, idx - 3), idx + 1)
      const avg4 = Math.round(slice.reduce((s, [, v]) => s + v, 0) / slice.length)
      return { name: lbl, Actual: actual, Target: target, '4W Avg': avg4 }
    })
    return rows
  }, [fieldData, master])

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
          <b>Power Receiving cable due 2026-08-01</b> — Customer Required basis. GTG #11 Synchronization cable
          due <b>2026-09-23</b>, event date <b>2026-12-22</b>.
          {hasActual && gapM != null && gapM > 0 && (
            <> Current actuals are <b style={{ color: '#ef4444' }}>{gapM.toLocaleString()} m ({gapPct?.toFixed(1)}%p) behind plan</b>.</>
          )}
        </div>
      </div>

      <div className="mpl-kpi-row">
        <div className="mpl-kpi">
          <div className="mpl-kpi-label">⚡ Power Receiving Cable Due</div>
          <div className="mpl-kpi-value" style={{ color: '#b45309' }}>2026-08-01</div>
          <div className="mpl-kpi-sub">Customer Required — PR Event 2026-10-30</div>
        </div>
        <div className="mpl-kpi">
          <div className="mpl-kpi-label">GTG #11 Sync Cable Due</div>
          <div className="mpl-kpi-value" style={{ color: '#7c3aed' }}>2026-09-23</div>
          <div className="mpl-kpi-sub">Customer Required — Event 2026-12-22</div>
        </div>
        <div className="mpl-kpi">
          <div className="mpl-kpi-label">Plan Cumulative (This Month)</div>
          <div className="mpl-kpi-value" style={{ color: C_OWNER }}>
            {planAtToday != null ? `${planAtToday}%` : '—'}
          </div>
          <div className="mpl-kpi-sub">Customer Required basis</div>
        </div>
        <div className="mpl-kpi">
          <div className="mpl-kpi-label">Schedule Delay</div>
          <div className="mpl-kpi-value" style={{ color: gapM != null && gapM > 0 ? '#ef4444' : '#22c55e' }}>
            {gapM != null ? (gapM > 0 ? `▼ ${gapM.toLocaleString()} m` : 'On Track') : '—'}
          </div>
          <div className="mpl-kpi-sub">
            {gapPct != null ? `${gapPct.toFixed(1)}%p behind plan` : 'Awaiting actual data'}
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
          <b>Cable Due</b> = cable completion deadline for each milestone (90 days before event). Source: completion schedule file · 2026-07-04.
        </p>
      </div>

      {/* Weekly Construction Progress */}
      <div className="chart-card">
        <div className="chart-card-header">
          <span className="chart-title">Weekly Construction Progress</span>
          <span className="chart-subtitle">Cable pulling actuals by week (m) · last 14 weeks</span>
        </div>
        {WEEKLY_DATA.length === 0 ? (
          <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 24px' }}>
              No weekly actuals yet — enter pulling data in Field Actuals
            </span>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={WEEKLY_DATA} margin={{ top: 20, right: 24, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="grad-weekly-actual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C_ACTUAL} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={C_ACTUAL} stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748d', fontSize: 11 }} axisLine={{ stroke: '#e3e8ee' }} tickLine={false} />
                <YAxis tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e3e8ee', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                        <div style={{ fontWeight: 700, marginBottom: 6, color: '#0d253d' }}>Week of {label}</div>
                        {payload.map(p => (
                          <div key={p.name} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 3 }}>
                            <span style={{ width: 8, height: 8, borderRadius: p.name === 'Actual' ? 2 : '50%', background: p.color, flexShrink: 0 }} />
                            <span style={{ color: '#64748b' }}>{p.name}</span>
                            <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#0d253d', fontVariantNumeric: 'tabular-nums' }}>
                              {Math.round(p.value).toLocaleString()} m
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  }}
                  cursor={{ fill: 'rgba(83,58,253,0.04)' }}
                />
                <Bar dataKey="Actual" fill="url(#grad-weekly-actual)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                  <LabelList dataKey="Actual" position="top" fontSize={9} fill={C_ACTUAL} fontWeight={700}
                    formatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
                </Bar>
                <Line type="monotone" dataKey="Target" stroke={C_OWNER} strokeWidth={2} strokeDasharray="6 4"
                  dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="4W Avg" stroke="#f59e0b" strokeWidth={2}
                  dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                  isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mpl-legend">
              <span><i className="mpl-sw" style={{ background: C_ACTUAL }} />Weekly Actual</span>
              <span><i className="mpl-sw" style={{ background: C_OWNER }} />Weekly Target (plan÷4.33)</span>
              <span><i className="mpl-sw" style={{ background: '#f59e0b' }} />4-Week Rolling Avg</span>
            </div>
          </>
        )}
      </div>

      {/* Monthly Pulling Plan — line + bar side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div className="chart-card" style={{ margin: 0 }}>
          <div className="chart-card-header">
            <span className="chart-title">Monthly Pulling Plan</span>
            <span className="chart-subtitle">m / month · trend line</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={MONTHLY_DATA} margin={{ top: 20, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#64748d', fontSize: 10 }} axisLine={{ stroke: '#e3e8ee' }}
                    tickLine={false} interval={0} angle={-30} textAnchor="end" height={48} />
                  <YAxis tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip content={<MonthlyTooltip />} cursor={{ stroke: '#c5c9d9', strokeWidth: 1, strokeDasharray: '4 3' }} />
                  <ReferenceLine x="'26.10" stroke="#b45309" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: 'PR', fill: '#b45309', fontSize: 10, fontWeight: 700, position: 'top' }} />
                  <ReferenceLine x="'26.12" stroke="#7c3aed" strokeDasharray="4 3" strokeWidth={1.5}
                    label={{ value: 'GTG#11', fill: '#7c3aed', fontSize: 10, fontWeight: 700, position: 'top' }} />
                  <ReferenceLine x={TODAY_LABEL} stroke="#dc2626" strokeWidth={1.5}
                    label={{ value: 'TODAY', fill: '#dc2626', fontSize: 9, fontWeight: 700, position: 'insideTopLeft' }} />
                  <Line type="monotone" dataKey="Customer Required" stroke={C_OWNER} strokeWidth={2.2}
                    strokeDasharray="6 4" dot={false} />
                  {hasActual && (
                    <Line type="monotone" dataKey="Actual" stroke={C_ACTUAL} strokeWidth={2.4}
                      dot={{ r: 3, fill: C_ACTUAL, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: C_ACTUAL, stroke: '#fff', strokeWidth: 2 }}
                      connectNulls={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
              <div className="mpl-legend">
                <span><i className="mpl-sw" style={{ background: C_OWNER }} />Plan</span>
                {hasActual && <span><i className="mpl-sw" style={{ background: C_ACTUAL }} />Actual</span>}
                <span><i className="mpl-sw" style={{ background: '#b45309' }} />PR</span>
                <span><i className="mpl-sw" style={{ background: '#7c3aed' }} />GTG#11 Sync</span>
              </div>
            </div>
            {/* Right stats panel */}
            <div style={{
              flexShrink: 0, width: 168, marginTop: 8,
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
              fontSize: 11, fontVariantNumeric: 'tabular-nums', overflow: 'hidden',
            }}>
              <div style={{ padding: '7px 10px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 4 }}>
                <span style={{ color: '#64748b', fontWeight: 700 }}>Month</span>
                <span style={{ color: C_OWNER, fontWeight: 700, textAlign: 'right' }}>Plan</span>
                <span style={{ color: C_ACTUAL, fontWeight: 700, textAlign: 'right' }}>Actual</span>
              </div>
              {MONTHLY_DATA.filter((_, i) => i <= Math.max(todayIdx + 1, 5)).map((d, i) => {
                const plan = d['Customer Required'] || 0
                const actual = d['Actual'] || 0
                const isToday = d.name === TODAY_LABEL
                const gap = plan - actual
                return (
                  <div key={d.name} style={{
                    padding: '5px 10px',
                    borderBottom: '1px solid #eef0f6',
                    background: isToday ? '#fffbeb' : 'transparent',
                    display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 4, alignItems: 'center',
                  }}>
                    <span style={{ color: isToday ? '#b45309' : '#64748b', fontWeight: isToday ? 700 : 400 }}>
                      {d.name}{isToday ? ' ◀' : ''}
                    </span>
                    <span style={{ color: '#94a3b8', textAlign: 'right' }}>
                      {plan >= 1000 ? `${Math.round(plan/1000)}k` : plan || '—'}
                    </span>
                    <span style={{ color: actual > 0 ? C_ACTUAL : '#cbd5e1', textAlign: 'right', fontWeight: actual > 0 ? 700 : 400 }}>
                      {actual > 0 ? (actual >= 1000 ? `${Math.round(actual/1000)}k` : actual) : '—'}
                    </span>
                  </div>
                )
              })}
              {hasActual && gapM != null && (
                <div style={{ padding: '7px 10px', background: '#fef2f2', borderTop: '1px solid #fca5a5' }}>
                  <div style={{ color: '#64748b', marginBottom: 2 }}>Gap (this month)</div>
                  <div style={{ color: '#dc2626', fontWeight: 800, fontSize: 13 }}>
                    ▼ {(OWNER_MONTHLY[todayIdx] - (actualMonthly[todayIdx] || 0)).toLocaleString()} m
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="chart-card" style={{ margin: 0 }}>
          <div className="chart-card-header">
            <span className="chart-title">Plan vs Actual — Monthly Bar</span>
            <span className="chart-subtitle">m / month · balanced target to Dec 2027 (~{Math.round(TOTAL_M/MONTHS.length/1000)}k/mo)</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={MONTHLY_DATA} margin={{ top: 20, right: 16, left: 0, bottom: 8 }} barGap={2} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#64748d', fontSize: 10 }} axisLine={{ stroke: '#e3e8ee' }}
                tickLine={false} interval={0} angle={-30} textAnchor="end" height={48} />
              <YAxis tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip content={<MonthlyTooltip />} cursor={{ fill: 'rgba(83,58,253,0.04)' }} />
              <ReferenceLine x="'26.10" stroke="#b45309" strokeDasharray="4 3" strokeWidth={1.5}
                label={{ value: 'PR', fill: '#b45309', fontSize: 10, fontWeight: 700, position: 'top' }} />
              <ReferenceLine x="'26.12" stroke="#7c3aed" strokeDasharray="4 3" strokeWidth={1.5}
                label={{ value: 'GTG#11', fill: '#7c3aed', fontSize: 10, fontWeight: 700, position: 'top' }} />
              <ReferenceLine x={TODAY_LABEL} stroke="#dc2626" strokeWidth={1.5}
                label={{ value: 'TODAY', fill: '#dc2626', fontSize: 9, fontWeight: 700, position: 'insideTopLeft' }} />
              <Bar dataKey="Monthly Target" fill={C_OWNER} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                <LabelList dataKey="Monthly Target" position="top" fontSize={9} fill="#64748b"
                  formatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              </Bar>
              {hasActual && (
                <Bar dataKey="Actual" fill={C_ACTUAL} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                  <LabelList dataKey="Actual" position="top" fontSize={9} fill={C_ACTUAL} fontWeight={700}
                    formatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                </Bar>
              )}
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mpl-legend">
            <span><i className="mpl-sw" style={{ background: C_OWNER }} />Monthly Target (balanced to Dec 2027)</span>
            {hasActual && <span><i className="mpl-sw" style={{ background: C_ACTUAL }} />Actual</span>}
          </div>
        </div>
      </div>

      {/* Cumulative S-Curve + Projection panel */}
      <div className="chart-card">
        <div className="chart-card-header">
          <span className="chart-title">Cumulative S-Curve — Plan vs Actual</span>
          <span className="chart-subtitle">% of {TOTAL_M.toLocaleString()} m total · red area = delay gap</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Chart */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={CUM_DATA} margin={{ top: 20, right: 16, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="grad-actual-cum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.08} />
                  </linearGradient>
                  <linearGradient id="grad-gap-cum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748d', fontSize: 10 }} axisLine={{ stroke: '#e3e8ee' }}
                  tickLine={false} interval={0} angle={-30} textAnchor="end" height={48} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}%`} />
                <Tooltip content={<SCurveTooltip />} cursor={{ stroke: '#c5c9d9', strokeWidth: 1, strokeDasharray: '4 3' }} />
                {/* Stacked fills: blue=actual, red=gap to plan */}
                <Area type="monotone" dataKey="actualFill" stackId="cum"
                  fill="url(#grad-actual-cum)" stroke="none" connectNulls={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="gapFill" stackId="cum"
                  fill="url(#grad-gap-cum)" stroke="none" connectNulls={false} isAnimationActive={false} />
                {/* Reference lines */}
                <ReferenceLine x={TODAY_LABEL} stroke="#dc2626" strokeWidth={2}
                  label={{ value: 'TODAY', fill: '#dc2626', fontSize: 9, fontWeight: 700, position: 'insideBottomLeft' }} />
                <ReferenceLine x="'26.10" stroke="#b45309" strokeDasharray="4 3" strokeWidth={1.5}
                  label={{ value: 'PR', fill: '#b45309', fontSize: 10, fontWeight: 700, position: 'top' }} />
                <ReferenceLine x="'26.12" stroke="#7c3aed" strokeDasharray="4 3" strokeWidth={1.5}
                  label={{ value: 'GTG#11', fill: '#7c3aed', fontSize: 10, fontWeight: 700, position: 'top' }} />
                {/* Lines on top of fills */}
                <Line type="monotone" dataKey="Plan" stroke={C_OWNER} strokeWidth={2.2}
                  strokeDasharray="6 4" dot={false} />
                {hasActual && (
                  <Line type="monotone" dataKey="Actual" stroke="#3b82f6" strokeWidth={2.8}
                    dot={{ r: 3.5, fill: '#3b82f6', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                    connectNulls={false} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mpl-legend">
              <span><i className="mpl-sw" style={{ background: C_OWNER }} />Customer Required (Plan)</span>
              {hasActual && <span><i className="mpl-sw" style={{ background: '#3b82f6' }} />Actual</span>}
              <span><i className="mpl-sw" style={{ background: '#ef4444', opacity: .55 }} />Gap (delay)</span>
            </div>
          </div>

          {/* Projection panel */}
          <ProjectionPanel actualMonthly={actualMonthly} hasActual={hasActual} gapM={gapM} gapPct={gapPct} />
        </div>
      </div>
    </div>
  )
}
