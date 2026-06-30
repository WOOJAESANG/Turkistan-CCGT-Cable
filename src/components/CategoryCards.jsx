function formatNumber(n) {
  return n.toLocaleString('ko-KR')
}

export default function CategoryCards({ categories }) {
  return (
    <div className="category-row">
      {categories.map((cat) => (
        <div className="category-card" key={cat.id} data-cat={cat.id}>
          <div className="cat-header">
            <span className="cat-tag" data-cat={cat.id}>{cat.label}</span>
            <span className="cat-length">{formatNumber(cat.designedLength)}m ({formatNumber(cat.designedTermination)}P)</span>
          </div>
          <div className="cat-gauge-row">
            <div className="cat-gauge">
              <div className="cat-gauge-label">Pulling</div>
              <div className="cat-gauge-pct">
                {cat.pullPct.toFixed(1)}<span className="pct-sym">%</span>
              </div>
              <div className="mini-bar-track">
                <div
                  className="mini-bar-fill"
                  style={{
                    width: `${Math.max(cat.pullPct, 1)}%`,
                    background: cat.color,
                  }}
                />
              </div>
            </div>
            <div className="cat-gauge">
              <div className="cat-gauge-label">Termination</div>
              <div className="cat-gauge-pct">
                {cat.termPct.toFixed(1)}<span className="pct-sym">%</span>
              </div>
              <div className="mini-bar-track">
                <div
                  className="mini-bar-fill"
                  style={{
                    width: `${Math.max(cat.termPct, 1)}%`,
                    background: cat.color,
                    opacity: 0.6,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
