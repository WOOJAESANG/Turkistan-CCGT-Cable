import { useState, useEffect } from 'react'
import { getTotals, getCategoryProgress, getPriorityChartData, masterLengths, rollupActuals, rollupPriorityActuals, rollupInspection } from '../data/cableData'
import { loadFieldData } from '../lib/dataStore'
import { dataUrl } from '../lib/dataUrl'
import KpiCards from './KpiCards'
import LifecycleSummary from './LifecycleSummary'
import WeeklyProgressChart from './WeeklyProgressChart'
import BarChartSection from './BarChartSection'
import PieChartSection from './PieChartSection'
import MonthlyPullingChart from './MonthlyPullingChart'
import TerminationGauges from './TerminationGauges'

export default function Dashboard() {
  const [master, setMaster] = useState(null)
  const [fieldData, setFieldData] = useState({})
  const [actuals, setActuals] = useState(null)

  const [supplyInfo, setSupplyInfo] = useState(null)

  useEffect(() => {
    fetch(dataUrl('/cable-data.json')).then(r => r.json()).then(setMaster).catch(() => setMaster([]))
    Promise.all([
      fetch(dataUrl('/cable-material.json')).then(r => r.json()),
      fetch(dataUrl('/drum-capacity.json')).then(r => r.json()),
    ]).then(([mat, cap]) => {
      const byStatus = {}
      let totalDrums = 0
      const onSiteDrumSet = new Set()
      for (const r of mat) {
        const s = (r.status || 'N/A').trim()
        const cnt = r.drumCount || r.drumList?.length || 0
        if (!byStatus[s]) byStatus[s] = { rows: 0, drums: 0 }
        byStatus[s].rows++
        byStatus[s].drums += cnt
        totalDrums += cnt
        if (s === 'On-Site' && r.drumList) r.drumList.forEach(d => onSiteDrumSet.add(d))
      }
      let suppliedMeters = 0
      let totalCapacity = 0
      for (const [k, v] of Object.entries(cap)) {
        totalCapacity += v.m || 0
        if (onSiteDrumSet.has(k)) suppliedMeters += v.m || 0
      }
      setSupplyInfo({ byStatus, totalDrums, suppliedMeters, totalCapacity })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!master) return
    const recompute = () => {
      const fd = loadFieldData()
      setFieldData(fd)
      setActuals(rollupActuals(fd, master))
    }
    recompute()
    window.addEventListener('cable-field-update', recompute)
    return () => window.removeEventListener('cable-field-update', recompute)
  }, [master])

  const lengths = masterLengths(master)
  const totals = getTotals(actuals, lengths)
  const categoryProgress = getCategoryProgress(actuals, lengths)
  const priorityChartData = getPriorityChartData(lengths)
  const priorityPulled = master ? rollupPriorityActuals(fieldData, master) : {}
  const inspection = master ? rollupInspection(fieldData, master) : { power: 0, control: 0, iac: 0, pkg: 0 }

  const today = new Date()
  const dateStr = today.toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })

  // wait for cable-data.json + actuals rollup: rendering earlier would flash
  // the hardcoded fallback figures before the derived ones replace them
  if (!master || !actuals) {
    return (
      <div className="content-body">
        <div className="page-header">
          <h2>Cable Dashboard</h2>
        </div>
        <div className="cs-loading">Loading data…</div>
      </div>
    )
  }

  return (
    <div className="content-body">
      <div className="page-header">
        <h2>Cable Dashboard</h2>
        <div className="header-meta">
          <div className="live-badge">
            <span className="live-dot" />
            LIVE
          </div>
          <span className="date-label">{dateStr} 기준</span>
        </div>
      </div>

      <KpiCards totals={totals} />

      <LifecycleSummary totals={totals} supplyInfo={supplyInfo} />

      <div className="charts-row">
        <WeeklyProgressChart fieldData={fieldData} master={master} totalDesignedLength={totals.totalDesignedLength} />
      </div>

      <div className="charts-row">
        <MonthlyPullingChart fieldData={fieldData} master={master} />
        <PieChartSection data={priorityChartData} pulled={priorityPulled} />
      </div>

      <div className="charts-row">
        <BarChartSection categories={categoryProgress} />
        <TerminationGauges categories={categoryProgress} inspection={inspection} />
      </div>
    </div>
  )
}
