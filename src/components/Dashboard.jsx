import { useState, useEffect } from 'react'
import { getTotals, getCategoryProgress, getPriorityChartData, rollupActuals } from '../data/cableData'
import { loadFieldData } from '../lib/dataStore'
import KpiCards from './KpiCards'
import CategoryCards from './CategoryCards'
import BarChartSection from './BarChartSection'
import PieChartSection from './PieChartSection'

export default function Dashboard() {
  const [master, setMaster] = useState(null)
  const [actuals, setActuals] = useState(null)

  useEffect(() => {
    fetch('/cable-data.json').then(r => r.json()).then(setMaster).catch(() => setMaster([]))
  }, [])

  useEffect(() => {
    if (!master) return
    const recompute = () => setActuals(rollupActuals(loadFieldData(), master))
    recompute()
    window.addEventListener('cable-field-update', recompute)
    return () => window.removeEventListener('cable-field-update', recompute)
  }, [master])

  const totals = getTotals(actuals)
  const categoryProgress = getCategoryProgress(actuals)
  const priorityChartData = getPriorityChartData()

  const today = new Date()
  const dateStr = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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
      <CategoryCards categories={categoryProgress} />
      <div className="charts-row">
        <BarChartSection categories={categoryProgress} />
        <PieChartSection data={priorityChartData} />
      </div>
    </div>
  )
}
