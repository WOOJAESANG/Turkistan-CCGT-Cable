import { useState, useEffect } from 'react'
import { getTotals, getCategoryProgress, getPriorityChartData, rollupActuals, rollupPriorityActuals, rollupInspection } from '../data/cableData'
import { loadFieldData } from '../lib/dataStore'
import KpiCards from './KpiCards'
import BarChartSection from './BarChartSection'
import PieChartSection from './PieChartSection'
import MonthlyPullingChart from './MonthlyPullingChart'
import TerminationGauges from './TerminationGauges'

export default function Dashboard() {
  const [master, setMaster] = useState(null)
  const [fieldData, setFieldData] = useState({})
  const [actuals, setActuals] = useState(null)

  useEffect(() => {
    fetch('/cable-data.json').then(r => r.json()).then(setMaster).catch(() => setMaster([]))
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

  const totals = getTotals(actuals)
  const categoryProgress = getCategoryProgress(actuals)
  const priorityChartData = getPriorityChartData()
  const priorityPulled = master ? rollupPriorityActuals(fieldData, master) : {}
  const inspection = master ? rollupInspection(fieldData, master) : { power: 0, control: 0, iac: 0, pkg: 0 }

  const today = new Date()
  const dateStr = today.toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })

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
