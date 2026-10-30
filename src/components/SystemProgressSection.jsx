import { useMemo, useState } from 'react'
import { t, getLang } from '../lib/i18n'
import { isLumpSum } from '../data/cableData'

// Pulling, termination and line-check progress per system, for the cables that have a
// deadline: PR, EP-DCS and Early Power. ETC is left out so a large unstarted scope does
// not bury the systems that are actually being chased.
const SCOPE = ['PR', 'EP-DCS', 'Early Power']
const PRI_TONE = { PR: 'pr', 'EP-DCS': 'epdcs', 'Early Power': 'ep' }

// I&C systems are written "ENGLISH NAME / РУССКОЕ НАЗВАНИЕ"; group on the English half so
// the same system typed twice (with and without the Russian part) is one row.
const splitName = s => {
  const [en, ...ru] = String(s || '').split(' / ')
  return { en: en.trim() || '(blank)', ru: ru.join(' / ').trim() }
}

const num = n => Math.round(n).toLocaleString()
const pctOf = (a, b) => (b ? (a / b) * 100 : 0)

const COLS = [
  ['name', 'System'], ['n', 'Cables'], ['len', 'Design (m)'], ['pn', 'Pulled'],
  ['pl', 'Pulled (m)'], ['left', 'Remaining (m)'], ['pct', 'Pulling %'],
  ['tc', 'Terminated'], ['lc', 'Line check'],
]

export default function SystemProgressSection({ master, fieldData }) {
  const [pri, setPri] = useState('All')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState({ key: 'len', desc: true })

  const rows = useMemo(() => {
    if (!master) return []
    const by = new Map()
    for (const c of master) {
      if (isLumpSum(c) || !SCOPE.includes(c.pri) || (pri !== 'All' && c.pri !== pri)) continue
      const { en, ru } = splitName(c.sys)
      const key = en.toUpperCase()
      let r = by.get(key)
      if (!r) by.set(key, r = { key, en, ru, pris: {}, cats: new Set(), n: 0, len: 0, pn: 0, pl: 0, tc: 0, lc: 0 })
      if (!r.ru && ru) r.ru = ru
      const design = Number(c.l) || 0
      const e = fieldData?.[c.n]
      r.pris[c.pri] = (r.pris[c.pri] || 0) + 1
      r.cats.add(c.g)
      r.n++; r.len += design
      // completed = DESIGN length, the same basis as the KPI cards above
      if (e?.pullingDate) { r.pn++; r.pl += design }
      if (e?.termDateFrom && e?.termDateTo) r.tc++
      if (e?.lc === 'Done') r.lc++
    }
    return [...by.values()].map(r => ({ ...r, left: r.len - r.pl, pct: pctOf(r.pl, r.len) }))
  }, [master, fieldData, pri])

  const ru = getLang() === 'ru'
  const label = r => (ru && r.ru) || r.en

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? rows.filter(r => `${r.en} ${r.ru}`.toLowerCase().includes(needle))
      : rows
    const { key, desc } = sort
    const val = r => (key === 'name' ? label(r).toLowerCase() : r[key])
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b)
      const d = x < y ? -1 : x > y ? 1 : 0
      return desc ? -d : d
    })
  }, [rows, q, sort, ru]) // eslint-disable-line react-hooks/exhaustive-deps

  const tot = shown.reduce((a, r) => {
    a.n += r.n; a.len += r.len; a.pn += r.pn; a.pl += r.pl; a.tc += r.tc; a.lc += r.lc
    return a
  }, { n: 0, len: 0, pn: 0, pl: 0, tc: 0, lc: 0 })
  const done = shown.filter(r => r.pn === r.n).length

  if (!master) return null

  const onSort = key => setSort(s => ({ key, desc: s.key === key ? !s.desc : key !== 'name' }))
  const Bar = ({ p }) => (
    <div className="sys-bar"><span style={{ width: `${Math.min(100, p)}%` }} className={p >= 100 ? 'full' : ''} /></div>
  )

  return (
    <section className="sys-prog">
      <div className="sys-head">
        <div>
          <h3>{t('Progress by System')}</h3>
          <p>{t('PR + EP-DCS + Early Power cables · completed = design length of cables with a pulling date')}</p>
        </div>
        <div className="sys-tools">
          <div className="sys-chips" role="group" aria-label={t('Priority')}>
            {['All', ...SCOPE].map(k => (
              <button key={k} type="button" className={`sys-chip${pri === k ? ' on' : ''}`} onClick={() => setPri(k)}>
                {k === 'All' ? t('All') : k}
              </button>
            ))}
          </div>
          <input className="sys-search" type="search" value={q} onChange={e => setQ(e.target.value)}
            placeholder={t('Search system')} />
        </div>
      </div>

      <div className="sys-kpis">
        <div><span>{t('Systems')}</span><b>{shown.length}</b><small>{t('{n} fully pulled', { n: done })}</small></div>
        <div><span>{t('Cables')}</span><b>{num(tot.n)}</b><small>{num(tot.pn)} {t('pulled')}</small></div>
        <div><span>{t('Pulled (m)')}</span><b>{pctOf(tot.pl, tot.len).toFixed(1)}%</b><small>{num(tot.pl)} / {num(tot.len)} m</small></div>
        <div><span>{t('Terminated')}</span><b>{pctOf(tot.tc, tot.n).toFixed(1)}%</b><small>{num(tot.tc)} / {num(tot.n)}</small></div>
        <div><span>{t('Line check')}</span><b>{pctOf(tot.lc, tot.n).toFixed(1)}%</b><small>{num(tot.lc)} / {num(tot.n)}</small></div>
      </div>

      <div className="sys-table-wrap">
        <table className="sys-table">
          <thead>
            <tr>
              {COLS.map(([k, l]) => (
                <th key={k} className={k === 'name' ? '' : 'num'} onClick={() => onSort(k)} aria-sort={sort.key === k ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
                  {t(l)}{sort.key === k ? (sort.desc ? ' ▾' : ' ▴') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.key}>
                <td className="sys-name">
                  <span title={r.ru ? `${r.en} / ${r.ru}` : r.en}>{label(r)}</span>
                  <span className="sys-tags">
                    {SCOPE.filter(p => r.pris[p]).map(p => (
                      <i key={p} className={`sys-pri sys-pri-${PRI_TONE[p]}`}>{p}{Object.keys(r.pris).length > 1 ? ` ${r.pris[p]}` : ''}</i>
                    ))}
                    <em>{[...r.cats].join(' · ')}</em>
                  </span>
                </td>
                <td className="num">{num(r.n)}</td>
                <td className="num">{num(r.len)}</td>
                <td className="num">{num(r.pn)}</td>
                <td className="num">{num(r.pl)}</td>
                <td className="num">{num(r.left)}</td>
                <td className="num"><div className="sys-pct"><Bar p={r.pct} /><span>{r.pct.toFixed(0)}%</span></div></td>
                <td className="num">{num(r.tc)} <small>{pctOf(r.tc, r.n).toFixed(0)}%</small></td>
                <td className="num">{num(r.lc)} <small>{pctOf(r.lc, r.n).toFixed(0)}%</small></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{t('Total')}</td>
              <td className="num">{num(tot.n)}</td>
              <td className="num">{num(tot.len)}</td>
              <td className="num">{num(tot.pn)}</td>
              <td className="num">{num(tot.pl)}</td>
              <td className="num">{num(tot.len - tot.pl)}</td>
              <td className="num"><div className="sys-pct"><Bar p={pctOf(tot.pl, tot.len)} /><span>{pctOf(tot.pl, tot.len).toFixed(1)}%</span></div></td>
              <td className="num">{num(tot.tc)} <small>{pctOf(tot.tc, tot.n).toFixed(0)}%</small></td>
              <td className="num">{num(tot.lc)} <small>{pctOf(tot.lc, tot.n).toFixed(0)}%</small></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
