import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  ComposedChart, Bar,
} from 'recharts'

// Source: 완료일정 기입됨.xlsx (2026-07-04) — milestone dates + cable completion deadlines
const UNIT1 = [
  { name: 'Power Receiving',         cust: '2026-10-30', custCable: '2026-08-01', l3: '2027-02-05', l3Cable: '2026-11-07', gap: '~3.2 mo' },
  { name: 'GTG #11 Initial Firing',  cust: '2026-11-23', custCable: '2026-08-25', l3: '2027-04-06', l3Cable: '2027-01-06', gap: '~4.4 mo' },
  { name: 'GTG #11 Synchronization', cust: '2026-12-22', custCable: '2026-09-23', l3: '2027-05-05', l3Cable: '2027-02-04', gap: '~4.5 mo' },
  { name: 'GTG #12 Synchronization', cust: '2027-01-20', custCable: '2026-10-22', l3: '2027-06-03', l3Cable: '2027-03-05', gap: '~4.4 mo' },
  { name: 'STG #10 Synchronization', cust: '2027-07-11', custCable: '2027-04-12', l3: '2027-11-22', l3Cable: '2027-08-24', gap: '~4.4 mo', finish: true },
]
const UNIT2 = [
  { name: 'GTG #21 Initial Firing',  cust: '2027-01-15', custCable: '2026-10-17', l3: '2027-05-29', l3Cable: '2027-02-28', gap: '~4.4 mo' },
  { name: 'GTG #21 Synchronization', cust: '2027-02-12', custCable: '2026-11-14', l3: '2027-06-26', l3Cable: '2027-03-28', gap: '~4.4 mo' },
  { name: 'GTG #22 Synchronization', cust: '2027-03-14', custCable: '2026-12-14', l3: '2027-07-26', l3Cable: '2027-04-27', gap: '~4.4 mo' },
  { name: 'STG #20 Synchronization', cust: '2027-09-19', custCable: '2027-06-21', l3: '2028-01-31', l3Cable: '2027-11-02', gap: '~4.4 mo', finish: true },
]

// Bell-shaped plan estimate anchored to the milestone dates (not a real detailed schedule yet)
const MONTHS = ['2026-07','2026-08','2026-09','2026-10','2026-11','2026-12','2027-01','2027-02','2027-03','2027-04','2027-05','2027-06','2027-07','2027-08','2027-09','2027-10','2027-11','2027-12']
const OWNER_MONTHLY = [56380,210585,397950,429915,233757,72846,3795,0,0,0,0,0,0,0,0,0,0,0]
const L3_MONTHLY    = [21745,56625,112494,191651,245412,269000,228092,142561,88925,38221,10502,0,0,0,0,0,0,0]
const OWNER_CUM = [4.0,19.0,47.3,77.9,94.5,99.7,100.0,100.0,100.0,100.0,100.0,100.0,100.0,100.0,100.0,100.0,100.0,100.0]
const L3_CUM    = [1.5,5.6,13.6,27.2,44.7,63.8,80.1,90.2,96.5,99.3,100.0,100.0,100.0,100.0,100.0,100.0,100.0,100.0]
const AIS_MONTHLY = [109414,170509,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]

const label = m => { const [y,mm] = m.split('-'); return `'${y.slice(2)}.${mm}` }
const MONTHLY_DATA = MONTHS.map((m, i) => ({
  name: label(m),
  'Customer Required': OWNER_MONTHLY[i],
  'L3 Target': L3_MONTHLY[i],
  'AIS Detail Plan': AIS_MONTHLY[i],
}))
const CUM_DATA = MONTHS.map((m, i) => ({
  name: label(m),
  'Customer Required': OWNER_CUM[i],
  'L3 Target': L3_CUM[i],
}))

const C_OWNER = '#94a3b8'
const C_L3 = '#533afd'
const C_AIS = '#f97316'
const C_CABLE_OWNER = '#f59e0b'

// ── Milestone timeline (Gantt) built directly from the Excel data ──
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

function PlanTooltip({ active, payload, label: lb, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff', border: '1px solid #e3e8ee', borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,55,112,0.08)', fontSize: 13,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: '#0d253d' }}>{lb}</div>
      {payload.filter(p => p.value != null).map(p => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.stroke, flexShrink: 0 }} />
          <span style={{ color: '#64748d' }}>{p.dataKey}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#0d253d', paddingLeft: 12 }}>
            {unit === '%' ? `${p.value}%` : `${Math.round(p.value).toLocaleString()} m`}
          </span>
        </div>
      ))}
    </div>
  )
}

function MilestoneRows({ rows }) {
  return rows.map(r => (
    <tr key={r.name} className={r.finish ? 'mpl-finish-row' : ''}>
      <td className="mpl-metric">{r.name}</td>
      <td className="mpl-owner">{r.cust}</td>
      <td className="mpl-cable-owner">{r.custCable}</td>
      <td className="mpl-l3">{r.l3}</td>
      <td className="mpl-cable-l3">{r.l3Cable}</td>
      <td className="mpl-gap">{r.gap}</td>
    </tr>
  ))
}

export default function MasterPlan() {
  return (
    <div className="content-body">
      <div className="page-header">
        <h2>Cable Master Plan</h2>
        <span className="cs-total">Customer Required vs L3 Target</span>
      </div>

      <div className="mpl-callout">
        ⚠️ <div>
          <b>The Customer Required schedule needs all Power Receiving cables done by 2026-08-01</b> — 25 days from now.
          Cable work for the full scope (through STG #20 Synchronization) must finish by <b>2027-06-21</b> under Customer
          Required vs <b>2027-11-02</b> under the L3 schedule — a consistent <b>~4.4 month gap</b> across all nine milestones.
        </div>
      </div>

      <div className="mpl-kpi-row">
        <div className="mpl-kpi">
          <div className="mpl-kpi-label">⚡ Next Cable Deadline (Cust. Req)</div>
          <div className="mpl-kpi-value" style={{ color: '#b45309' }}>2026-08-01</div>
          <div className="mpl-kpi-sub">Power Receiving — 25 days away</div>
        </div>
        <div className="mpl-kpi">
          <div className="mpl-kpi-label">Next Cable Deadline (L3)</div>
          <div className="mpl-kpi-value" style={{ color: '#7c3aed' }}>2026-11-07</div>
          <div className="mpl-kpi-sub">Power Receiving — L3 scenario</div>
        </div>
        <div className="mpl-kpi">
          <div className="mpl-kpi-label">Power Receiving Event Gap</div>
          <div className="mpl-kpi-value" style={{ color: '#dc2626' }}>~3.2 months</div>
          <div className="mpl-kpi-sub">Cust. 2026-10-30 → L3 2027-02-05</div>
        </div>
        <div className="mpl-kpi">
          <div className="mpl-kpi-label">AIS Site Plan (Jul–Aug)</div>
          <div className="mpl-kpi-value" style={{ color: C_AIS }}>279,923 m</div>
          <div className="mpl-kpi-sub">From the daily schedule file</div>
        </div>
      </div>

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
                <th>Gap (Cust→L3)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="mpl-section"><td colSpan={6}>Simple Cycle — Unit 1 (GT#11 / GT#12 / ST#10)</td></tr>
              <MilestoneRows rows={UNIT1} />
              <tr className="mpl-section"><td colSpan={6}>Simple Cycle — Unit 2 (GT#21 / GT#22 / ST#20)</td></tr>
              <MilestoneRows rows={UNIT2} />
            </tbody>
          </table>
        </div>
        <p className="mpl-note">
          <b>Cable Due</b> = date by which all cable work for that milestone must be completed (approx. 3 months lead
          before the event date). Gap = difference between Customer Required and L3 Schedule event dates.
          Source: completion schedule file · 2026-07-04
        </p>
      </div>

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
            <ReferenceLine x={day('2026-07-07')} stroke="#dc2626" strokeWidth={2}
              label={{ value: 'TODAY', fill: '#dc2626', fontSize: 10, fontWeight: 700, position: 'top' }} />
            <Bar dataKey="custOffset" stackId="cust" fill="transparent" barSize={9} isAnimationActive={false} />
            <Bar dataKey="custSpan" stackId="cust" fill={C_CABLE_OWNER} barSize={9} radius={[4, 4, 4, 4]} isAnimationActive={false} />
            <Bar dataKey="l3Offset" stackId="l3" fill="transparent" barSize={9} isAnimationActive={false} />
            <Bar dataKey="l3Span" stackId="l3" fill={C_L3} barSize={9} radius={[4, 4, 4, 4]} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mpl-legend">
          <span><i className="mpl-sw" style={{ background: C_CABLE_OWNER }} />Customer Required (cable due → event)</span>
          <span><i className="mpl-sw" style={{ background: C_L3 }} />L3 Schedule (cable due → event)</span>
          <span><i className="mpl-sw" style={{ background: '#dc2626' }} />TODAY (2026-07-07)</span>
        </div>
        <p className="mpl-note">
          Bar start = cable completion deadline · bar end = milestone event date. All nine milestones from the
          completion schedule file are shown — the amber Power Receiving bar starting 2026-08-01 is the most urgent.
        </p>
      </div>

      <div className="chart-card">
        <div className="chart-card-header">
          <span className="chart-title">Monthly Pulling Plan — Customer Required vs L3 Target vs AIS Detail</span>
          <span className="chart-subtitle">m / month · bell-shaped estimate anchored to milestones</span>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={MONTHLY_DATA} margin={{ top: 20, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#64748d', fontSize: 11 }} axisLine={{ stroke: '#e3e8ee' }}
              tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
            <YAxis tick={{ fill: '#64748d', fontSize: 12 }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip content={<PlanTooltip />} />
            <ReferenceLine x="'26.10" stroke={C_OWNER} strokeDasharray="4 3"
              label={{ value: 'PR (Cust)', fill: C_OWNER, fontSize: 10, position: 'top' }} />
            <ReferenceLine x="'27.02" stroke={C_L3} strokeDasharray="4 3"
              label={{ value: 'PR (L3)', fill: C_L3, fontSize: 10, position: 'top' }} />
            <Line type="monotone" dataKey="Customer Required" stroke={C_OWNER} strokeWidth={2.4} strokeDasharray="6 4" dot={false} />
            <Line type="monotone" dataKey="L3 Target" stroke={C_L3} strokeWidth={2.4} strokeDasharray="5 3" dot={false} />
            <Line type="monotone" dataKey="AIS Detail Plan" stroke={C_AIS} strokeWidth={3}
              dot={{ r: 4, fill: C_AIS, strokeWidth: 0 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="mpl-legend">
          <span><i className="mpl-sw" style={{ background: C_OWNER }} />Customer Required</span>
          <span><i className="mpl-sw" style={{ background: C_L3 }} />L3 Target</span>
          <span><i className="mpl-sw" style={{ background: C_AIS }} />AIS Detail Plan (site data, Jul–Aug only)</span>
        </div>
      </div>

      <div className="chart-card">
        <div className="chart-card-header">
          <span className="chart-title">Cumulative S-Curve — When Does It Reach 100%?</span>
          <span className="chart-subtitle">% of total 1,405,228 m</span>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={CUM_DATA} margin={{ top: 20, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#64748d', fontSize: 11 }} axisLine={{ stroke: '#e3e8ee' }}
              tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
            <YAxis domain={[0, 100]} tick={{ fill: '#64748d', fontSize: 12 }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v}%`} />
            <Tooltip content={<PlanTooltip unit="%" />} />
            <ReferenceLine x="'26.07" stroke="#dc2626" strokeWidth={2}
              label={{ value: 'TODAY', fill: '#dc2626', fontSize: 10, fontWeight: 700, position: 'insideBottomLeft' }} />
            <ReferenceLine x="'27.01" stroke={C_OWNER} strokeWidth={2}
              label={{ value: '100% (Cust) 2027-01-05', fill: C_OWNER, fontSize: 10, fontWeight: 700, position: 'top' }} />
            <ReferenceLine x="'27.05" stroke={C_L3} strokeWidth={2}
              label={{ value: '100% (L3) 2027-05-19', fill: C_L3, fontSize: 10, fontWeight: 700, position: 'top' }} />
            <Line type="monotone" dataKey="Customer Required" stroke={C_OWNER} strokeWidth={2.4} strokeDasharray="6 4" dot={false} />
            <Line type="monotone" dataKey="L3 Target" stroke={C_L3} strokeWidth={2.4} strokeDasharray="5 3" dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className="mpl-legend">
          <span><i className="mpl-sw" style={{ background: C_OWNER }} />Customer Required</span>
          <span><i className="mpl-sw" style={{ background: C_L3 }} />L3 Target</span>
          <span><i className="mpl-sw" style={{ background: '#dc2626' }} />TODAY</span>
        </div>
      </div>
    </div>
  )
}
