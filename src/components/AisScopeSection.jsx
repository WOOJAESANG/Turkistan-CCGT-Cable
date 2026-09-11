import { useMemo } from 'react'

// AIS cables all sit under the PKG category, but two different contractors pull them:
// Shymkent Automatika takes Power and Control, communication cable is someone else's
// scope. Rolled up together the communication metres drag Shymkent's progress down and
// there is no way to see what they are actually accountable for.
//
// The split is already carried by the drum tag, so nobody has to classify anything by
// hand: AIS-PoCable is power, AIS-CoCable / AIS-CC are control, AIS-CMcable is
// communication (fibre, Cat.6, coax).
const SCOPE = [
  [/-CMcable-/i, 'Communication'],
  [/-PoCable-/i, 'Power'],
  [/-(CoCable|CC)-/i, 'Control'],
]
const scopeOf = drum => SCOPE.find(([re]) => re.test(drum))?.[1] || null

const SECTIONS = ['AIS 500kV', 'AIS 220kV', 'AIS-OCP']
const num = n => Math.round(n).toLocaleString()

export default function AisScopeSection({ master, fieldData, drumMap }) {
  const data = useMemo(() => {
    if (!master) return null
    const blank = () => ({ n: 0, len: 0, doneN: 0, done: 0 })
    const cell = {}
    const at = (sec, sc) => (cell[`${sec}|${sc}`] ||= blank())
    for (const c of master) {
      const drum = drumMap?.[c.n]
      if (!drum || !String(drum).startsWith('AIS-')) continue
      const sc = scopeOf(drum)
      if (!sc) continue
      const design = Number(c.l) || 0
      const e = fieldData?.[c.n]
      const pulled = parseFloat(String(e?.pulledLength ?? '').replace(/[^0-9.]/g, ''))
      const has = e?.pullingDate || !isNaN(pulled)
      for (const sec of [c.sys, 'ALL']) {
        const r = at(sec, sc)
        r.n++; r.len += design
        if (has) { r.doneN++; r.done += isNaN(pulled) ? design : pulled }
      }
    }
    const sum = (...rs) => rs.filter(Boolean).reduce((a, r) => ({
      n: a.n + r.n, len: a.len + r.len, doneN: a.doneN + r.doneN, done: a.done + r.done,
    }), blank())
    const shym = sec => sum(cell[`${sec}|Power`], cell[`${sec}|Control`])
    const rows = SECTIONS.filter(s => cell[`${s}|Power`] || cell[`${s}|Control`] || cell[`${s}|Communication`])
    return { cell, shym, rows, total: shym('ALL'), comm: cell['ALL|Communication'] || blank() }
  }, [master, fieldData, drumMap])

  if (!data || !data.total.len) return null
  const pct = r => (r.len ? (r.done / r.len) * 100 : 0)

  const Bar = ({ r, tone }) => (
    <div className={`ais-bar ais-bar-${tone}`}>
      <span style={{ width: `${Math.min(100, pct(r))}%` }} />
    </div>
  )

  return (
    <section className="ais-scope">
      <div className="ais-head">
        <h3>AIS 포설 현황 — 업체 범위별</h3>
        <p>드럼 태그로 자동 구분 · PoCable=Power, CoCable/CC=Control, CMcable=Communication</p>
      </div>

      <div className="ais-cards">
        <article className="ais-card ais-card-main">
          <header>Shymkent Automatika<small>Power + Control</small></header>
          <strong>{pct(data.total).toFixed(1)}%</strong>
          <Bar r={data.total} tone="main" />
          <dl>
            <div><dt>완료</dt><dd>{num(data.total.done)} m</dd></div>
            <div><dt>잔여</dt><dd>{num(data.total.len - data.total.done)} m</dd></div>
            <div><dt>설계</dt><dd>{num(data.total.len)} m</dd></div>
          </dl>
        </article>
        <article className="ais-card ais-card-alt">
          <header>Communication<small>타 업체 범위</small></header>
          <strong>{pct(data.comm).toFixed(1)}%</strong>
          <Bar r={data.comm} tone="alt" />
          <dl>
            <div><dt>완료</dt><dd>{num(data.comm.done)} m</dd></div>
            <div><dt>잔여</dt><dd>{num(data.comm.len - data.comm.done)} m</dd></div>
            <div><dt>설계</dt><dd>{num(data.comm.len)} m</dd></div>
          </dl>
        </article>
      </div>

      <div className="ais-table-wrap">
        <table className="ais-table">
          <thead>
            <tr>
              <th>구간</th><th>범위</th>
              <th className="num">본수</th><th className="num">설계 (m)</th>
              <th className="num">완료 (m)</th><th className="num">잔여 (m)</th>
              <th className="num">진도</th><th>　</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map(sec => {
              const s = data.shym(sec)
              const cm = data.cell[`${sec}|Communication`]
              const line = (label, r, cls) => r && r.n > 0 && (
                <tr key={`${sec}-${label}`} className={cls}>
                  {label === 'Shymkent' && <td rowSpan={cm?.n ? 4 : 3}>{sec.replace('AIS ', '').replace('AIS-', '')}</td>}
                  <td>{label}</td>
                  <td className="num">{num(r.n)}</td>
                  <td className="num">{num(r.len)}</td>
                  <td className="num">{num(r.done)}</td>
                  <td className="num">{num(r.len - r.done)}</td>
                  <td className="num">{pct(r).toFixed(1)}%</td>
                  <td><Bar r={r} tone={cls === 'ais-r-comm' ? 'alt' : 'row'} /></td>
                </tr>
              )
              return [
                line('Shymkent', s, 'ais-r-sum'),
                line('　└ Control', data.cell[`${sec}|Control`], 'ais-r-sub'),
                line('　└ Power', data.cell[`${sec}|Power`], 'ais-r-sub'),
                line('Communication', cm, 'ais-r-comm'),
              ]
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
