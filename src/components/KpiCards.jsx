function formatNumber(n) {
  return n.toLocaleString('ko-KR')
}

export default function KpiCards({ totals }) {
  return (
    <div className="kpi-row">
      <div className="kpi-card" data-kpi="total">
        <div className="kpi-label">
          <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          Total Cable Length
        </div>
        <div className="kpi-value">
          {formatNumber(totals.totalDesignedLength)}
          <span className="unit">m</span>
        </div>
        <div className="kpi-sub">
          Cable {formatNumber(totals.totalLineCount)} Line · Termination {formatNumber(totals.totalDesignedTermination)}P
        </div>
      </div>

      <div className="kpi-card" data-kpi="pulling">
        <div className="kpi-label">
          <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          Pulling Progress
        </div>
        <div className="kpi-value" style={{ color: 'var(--primary)' }}>
          {totals.pullingPercent.toFixed(1)}
          <span className="unit">%</span>
        </div>
        <div className="progress-bar-track" style={{ margin: '10px 0 8px' }}>
          <div
            className="progress-bar-fill"
            style={{
              width: `${Math.max(totals.pullingPercent, 0.5)}%`,
              background: 'linear-gradient(90deg, var(--primary), var(--primary-soft))',
            }}
          />
        </div>
        <div className="kpi-sub">
          {formatNumber(totals.totalPulledLength)}m / {formatNumber(totals.totalDesignedLength)}m
        </div>
      </div>

      <div className="kpi-card" data-kpi="termination">
        <div className="kpi-label">
          <svg className="kpi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          Termination Progress
        </div>
        <div className="kpi-value" style={{ color: 'var(--cat-control)' }}>
          {totals.terminationPercent.toFixed(1)}
          <span className="unit">%</span>
        </div>
        <div className="progress-bar-track" style={{ margin: '10px 0 8px' }}>
          <div
            className="progress-bar-fill"
            style={{
              width: `${Math.max(totals.terminationPercent, 0.5)}%`,
              background: 'linear-gradient(90deg, var(--cat-control), #67e8f9)',
            }}
          />
        </div>
        <div className="kpi-sub">
          {formatNumber(totals.totalTerminatedCount)}P / {formatNumber(totals.totalDesignedTermination)}P
        </div>
      </div>
    </div>
  )
}
