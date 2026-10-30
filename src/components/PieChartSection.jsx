import { PieChart, Pie, Cell } from 'recharts'
import { t, locale } from '../lib/i18n'

function formatNumber(n) {
  return Math.round(n).toLocaleString(locale())
}

const TRACK = '#eef0f6'
const DONUT = 132 // px, sized so three rings fit the existing card

// One donut per priority: the ring is that priority's own pulled vs designed length,
// so the number in the middle is the same progress % the numbers underneath describe.
function PriorityDonut({ d, done, total }) {
  const pct = d.value > 0 ? Math.min(100, (done / d.value * 100)) : 0
  const share = total > 0 ? (d.value / total * 100) : 0
  const ring = [
    { name: 'pulled', value: Math.min(done, d.value) },
    { name: 'remaining', value: Math.max(d.value - done, 0) },
  ]
  return (
    <div className="pri-donut">
      <div className="pie-shell pri-donut-ring">
        <PieChart width={DONUT} height={DONUT}>
          <Pie
            data={ring} cx="50%" cy="50%"
            innerRadius={46} outerRadius={62} startAngle={90} endAngle={-270}
            dataKey="value" stroke="none" isAnimationActive={false}
          >
            <Cell fill={d.color} />
            <Cell fill={TRACK} />
          </Pie>
        </PieChart>
        <div className="pie-center">
          <div className="pie-center-pct pri-donut-pct" style={{ color: d.color }}>{pct.toFixed(1)}<span>%</span></div>
          <div className="pie-center-label">{t('Pulled')}</div>
        </div>
      </div>
      <div className="pri-donut-name">
        <span className="pie-legend-dot" style={{ background: d.color }} />
        {t(d.name)}
      </div>
      <div className="pri-donut-nums">
        <span className="pri-done">{formatNumber(done)}m</span>
        <span className="pri-slash"> / </span>
        <span className="pri-total">{formatNumber(d.value)}m</span>
      </div>
      <div className="pri-donut-meta">{formatNumber(d.lineCount)} {t('lines')}</div>
      <div className="pri-donut-meta">{t('Share of total')} {share.toFixed(1)}%</div>
      {d.lump > 0 && (
        <div className="pri-donut-meta pri-donut-lump" title={t('Package quantity known only as a total — not in progress')}>
          + {t('package lump sum')} {formatNumber(d.lump)}m
        </div>
      )}
    </div>
  )
}

export default function PieChartSection({ data, pulled = {} }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const totalPulled = data.reduce((s, d) => s + (pulled[d.name] || 0), 0)
  const overallPct = total > 0 ? (totalPulled / total * 100) : 0

  return (
    <div className="chart-card pri-card">
      <div className="chart-card-header">
        <span className="chart-title">{t('Priority Distribution')}</span>
        <span className="chart-subtitle">{t('Progress by Priority')}</span>
      </div>
      <div className="pri-donuts">
        {data.map((d) => (
          <PriorityDonut key={d.name} d={d} done={pulled[d.name] || 0} total={total} />
        ))}
      </div>

      <div className="pie-legend">
        <div className="pie-legend-item pri-row pri-total-row">
          <div className="pri-row-head">
            <span className="pie-legend-dot" style={{ background: 'transparent' }} />
            <span className="pie-legend-name" style={{ fontWeight: 600 }}>{t('Total')}</span>
            <span className="pri-pct" style={{ color: '#533afd' }}>{overallPct.toFixed(1)}%</span>
          </div>
          <div className="pri-nums">
            <span className="pri-done">{formatNumber(totalPulled)}m</span>
            <span className="pri-slash"> / </span>
            <span className="pri-total">{formatNumber(total)}m</span>
          </div>
        </div>
      </div>
    </div>
  )
}
