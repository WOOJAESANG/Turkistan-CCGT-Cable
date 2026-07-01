// Semi-circle gauges showing Line Check / Inspection completion per category.
// (Bar chart on the left already shows Pulling vs Termination progress, so
// the right-side gauges surface the different metric: inspection completion.)

function polarToCartesian(cx, cy, r, angleDeg) {
  const a = (angleDeg - 180) * Math.PI / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}
function arcPath(cx, cy, r, startAngle, endAngle) {
  const s = polarToCartesian(cx, cy, r, endAngle)
  const e = polarToCartesian(cx, cy, r, startAngle)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`
}

function Gauge({ label, pct, color, total, done }) {
  const displayPct = Math.min(100, pct)
  const cx = 90, cy = 88, r = 66
  const stroke = 12
  const endAngle = 180 * (displayPct / 100)
  const track = arcPath(cx, cy, r, 0, 180)
  const value = endAngle > 0 ? arcPath(cx, cy, r, 0, endAngle) : ''

  return (
    <div className="tg-card" style={{ '--gc': color }}>
      <div className="tg-wrap">
        <svg viewBox="0 0 180 110" width="100%" height="110">
          <path d={track} stroke="#eef0f6" strokeWidth={stroke} strokeLinecap="round" fill="none" />
          {value && (
            <path d={value} stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none" />
          )}
        </svg>
        <div className="tg-center">
          <div className="tg-pct">{pct.toFixed(1)}<span className="tg-pct-sym">%</span></div>
        </div>
      </div>
      <div className="tg-meta">
        <div className="tg-label">{label}</div>
        <div className="tg-nums">
          <span className="tg-done">{done.toLocaleString()}</span>
          <span className="tg-slash"> / </span>
          <span className="tg-designed">{total.toLocaleString()} EA</span>
        </div>
      </div>
    </div>
  )
}

export default function TerminationGauges({ categories, inspection }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <span className="chart-title">Inspection Status</span>
        <span className="chart-subtitle">Line Check Done · By Category</span>
      </div>
      <div className="tg-grid">
        {categories.map(c => {
          const done = inspection?.[c.id] || 0
          const total = c.lineCount || 0
          const pct = total > 0 ? (done / total * 100) : 0
          return (
            <Gauge
              key={c.id}
              label={c.label}
              pct={pct}
              color={c.color}
              total={total}
              done={done}
            />
          )
        })}
      </div>
    </div>
  )
}
