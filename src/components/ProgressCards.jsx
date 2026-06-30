function formatNumber(n) {
  return n.toLocaleString('ko-KR')
}

export default function ProgressCards({ totals }) {
  return (
    <div className="progress-row">
      <div className="progress-card">
        <div className="progress-card-header">
          <span className="progress-card-title">Cable Pulling</span>
          <span className="progress-pct">
            {totals.pullingPercent.toFixed(1)}
            <span className="pct-symbol">%</span>
          </span>
        </div>
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{
              width: `${Math.max(totals.pullingPercent, 0.5)}%`,
              background: 'linear-gradient(90deg, var(--primary), var(--primary-soft))',
            }}
          />
        </div>
        <div className="progress-detail">
          Pulled {formatNumber(totals.totalPulledLength)}m of {formatNumber(totals.totalDesignedLength)}m · Remaining {formatNumber(totals.totalDesignedLength - totals.totalPulledLength)}m
        </div>
      </div>

      <div className="progress-card">
        <div className="progress-card-header">
          <span className="progress-card-title">Cable Termination</span>
          <span className="progress-pct" style={{ color: 'var(--cat-control)' }}>
            {totals.terminationPercent.toFixed(1)}
            <span className="pct-symbol">%</span>
          </span>
        </div>
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{
              width: `${Math.max(totals.terminationPercent, 0.5)}%`,
              background: 'linear-gradient(90deg, var(--cat-control), #67e8f9)',
            }}
          />
        </div>
        <div className="progress-detail">
          Completed {formatNumber(totals.totalTerminatedCount)}점 of {formatNumber(totals.totalDesignedTermination)}점 · Remaining {formatNumber(totals.totalDesignedTermination - totals.totalTerminatedCount)}점
        </div>
      </div>
    </div>
  )
}
