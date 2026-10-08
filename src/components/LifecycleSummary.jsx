import { t, locale } from '../lib/i18n'

function fmt(n) { return Math.round(n).toLocaleString(locale()) }

export default function LifecycleSummary({ totals, supplyInfo }) {
  const designLen = totals.totalDesignedLength
  const pulledLen = totals.totalPulledLength
  const remainPull = designLen - pulledLen
  const pullPct = totals.pullingPercent
  const termDone = totals.totalTerminatedCount
  const termDesign = totals.totalDesignedTermination
  const remainTerm = termDesign - termDone
  const termPct = totals.terminationPercent

  const totalCap = supplyInfo?.totalCapacity || 0
  const onSiteM = supplyInfo?.suppliedMeters || 0
  const remainSupply = designLen - totalCap
  const supplyPct = designLen > 0 ? (totalCap / designLen) * 100 : 0
  const onSite = supplyInfo?.byStatus?.['On-Site']?.drums || 0
  const sailing = supplyInfo?.byStatus?.['Sailing']?.drums || 0
  const cargoReady = supplyInfo?.byStatus?.['Cargo Ready']?.drums || 0
  const totalDrums = supplyInfo?.totalDrums || 0

  return (
    <div className="lcs-section">
      <div className="lcs-title">{t('Cabling Lifecycle Summary')}</div>
      <div className="lcs-grid">
        <div className="lcs-card">
          <div className="lcs-card-header">
            <div className="lcs-icon lcs-icon-design">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <span className="lcs-card-label">{t('Design Overview')}</span>
          </div>
          <div className="lcs-stats">
            <div className="lcs-stat">
              <span className="lcs-stat-label">{t('Total Design')}</span>
              <span className="lcs-stat-value">{fmt(designLen)} <span className="lcs-unit">m</span></span>
            </div>
            <div className="lcs-stat">
              <span className="lcs-stat-label">{t('Total Cables')}</span>
              <span className="lcs-stat-value">{fmt(totals.totalLineCount)} <span className="lcs-unit">{t('lines')}</span></span>
            </div>
            <div className="lcs-divider" />
            <div className="lcs-stat">
              <span className="lcs-stat-label">{t('Termination Points')}</span>
              <span className="lcs-stat-value">{fmt(termDesign)} <span className="lcs-unit">{t('pts')}</span></span>
            </div>
            <div className="lcs-stat">
              <span className="lcs-stat-label">{t('Pulling Rate')}</span>
              <span className="lcs-stat-value" style={{ color: pullPct > 50 ? 'var(--success)' : 'var(--primary)' }}>{pullPct.toFixed(1)} <span className="lcs-unit">%</span></span>
            </div>
          </div>
        </div>

        <div className="lcs-card">
          <div className="lcs-card-header">
            <div className="lcs-icon lcs-icon-supply">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            </div>
            <span className="lcs-card-label">{t('Supply Status')}</span>
          </div>
          <div className="lcs-stats">
            <div className="lcs-stat">
              <span className="lcs-stat-label">{t('Total Supply')}</span>
              <span className="lcs-stat-value" style={{ color: 'var(--primary)' }}>{fmt(totalCap)} <span className="lcs-unit">m</span></span>
            </div>
            <div className="lcs-stat">
              <span className="lcs-stat-label">{t('Not supplied (remaining)')}</span>
              <span className="lcs-stat-value lcs-amber">{fmt(remainSupply > 0 ? remainSupply : 0)} <span className="lcs-unit">m</span></span>
            </div>
            <div className="lcs-divider" />
            <div className="lcs-stat">
              <span className="lcs-stat-label">{t('Supply Rate')}</span>
              <span className="lcs-stat-value" style={{ color: 'var(--primary)' }}>{supplyPct.toFixed(1)} <span className="lcs-unit">%</span></span>
            </div>
            <div className="lcs-stat">
              <span className="lcs-stat-label">{t('Drums')}</span>
              <span className="lcs-stat-value">{fmt(totalDrums)} <span className="lcs-unit">{t('ea')}</span></span>
            </div>
            <div className="lcs-divider" />
            <div className="lcs-status-row">
              <span className="lcs-status lcs-status-onsite">{t('On-Site')} {onSite}</span>
              <span className="lcs-status lcs-status-sailing">{t('Sailing')} {sailing}</span>
              <span className="lcs-status lcs-status-ready">{t('Ready')} {cargoReady}</span>
            </div>
          </div>
        </div>

        <div className="lcs-card">
          <div className="lcs-card-header">
            <div className="lcs-icon lcs-icon-progress">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            </div>
            <span className="lcs-card-label">{t('Construction Progress')}</span>
          </div>
          <div className="lcs-stats">
            <div className="lcs-stat">
              <span className="lcs-stat-label">{t('Pulling Complete')}</span>
              <span className="lcs-stat-value" style={{ color: 'var(--primary)' }}>{fmt(pulledLen)} <span className="lcs-unit">m</span></span>
            </div>
            <div className="lcs-stat">
              <span className="lcs-stat-label">{t('Termination Complete')}</span>
              <span className="lcs-stat-value" style={{ color: 'var(--cat-control)' }}>{fmt(termDone)} <span className="lcs-unit">{t('pts')}</span></span>
            </div>
            <div className="lcs-divider" />
            <div className="lcs-stat">
              <span className="lcs-stat-label">{t('Remaining (Pulling)')}</span>
              <span className="lcs-stat-value lcs-amber">{fmt(remainPull)} <span className="lcs-unit">m</span></span>
            </div>
            <div className="lcs-stat">
              <span className="lcs-stat-label">{t('Remaining (Term)')}</span>
              <span className="lcs-stat-value lcs-amber">{fmt(remainTerm)} <span className="lcs-unit">{t('pts')}</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
