import { useState, useMemo, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'

const EXPORT_COLS = [
  'Category', 'Cable No.', 'Spec', 'Length (m)', 'System', 'Priority',
  'From', 'To', 'Pulling', 'Termination', 'Line Check', 'Act No.',
]

function buildScheduleRows(rows, fieldData) {
  return rows.map(c => {
    const fd = fieldData[c.n] || {}
    return [
      c.g || '', c.n || '', c.s || '', (c.l != null ? c.l : ''), c.sys || '', c.pri || '',
      c.f || '', c.t || '', c.p || '', c.e || '', fd.lc || 'Pending', fd.act || '',
    ]
  })
}

function stamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function exportScheduleExcel(rows, fieldData) {
  const aoa = [EXPORT_COLS, ...buildScheduleRows(rows, fieldData)]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 10 }, { wch: 26 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 13 },
    { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ]
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: EXPORT_COLS.length - 1, r: aoa.length - 1 } }) }
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cable Schedule')
  XLSX.writeFile(wb, `Cable Schedule_${stamp()}.xlsx`)
}

function exportScheduleCSV(rows, fieldData) {
  const aoa = [EXPORT_COLS, ...buildScheduleRows(rows, fieldData)]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const csv = XLSX.utils.sheet_to_csv(ws)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Cable Schedule_${stamp()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function ScheduleExportMenu({ rows, fieldData }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const run = fn => { fn(rows, fieldData); setOpen(false) }
  const disabled = !rows || rows.length === 0

  return (
    <div className="cm-export" ref={ref}>
      <button type="button" className={`cm-export-btn${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)} disabled={disabled}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Export</span>
        <svg className="cm-export-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="cm-export-menu">
          <button onClick={() => run(exportScheduleExcel)}>
            <span className="cm-export-ico xls">XLS</span> Excel (.xlsx)
          </button>
          <button onClick={() => run(exportScheduleCSV)}>
            <span className="cm-export-ico csv">CSV</span> CSV (.csv)
          </button>
        </div>
      )}
    </div>
  )
}

const LS_KEY = 'cable-field-data'
export function loadFieldData() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') }
  catch { return {} }
}
export function updateFieldEntry(cno, patch) {
  const prev = loadFieldData()
  const next = { ...prev, [cno]: { ...prev[cno], ...patch } }
  localStorage.setItem(LS_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('cable-field-update', { detail: { cno, data: next[cno] } }))
}
export function deleteFieldEntry(cno) {
  const prev = loadFieldData()
  if (!(cno in prev)) return
  const next = { ...prev }
  delete next[cno]
  localStorage.setItem(LS_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('cable-field-update', { detail: { cno, data: null } }))
}
// Derive Pulling/Termination status from entered field actuals (실적 연동)
export function derivePullStatus(base, fd = {}) {
  return fd.pullingDate ? 'Done' : (base?.p || 'Pending')
}
export function deriveTermStatus(base, fd = {}) {
  if (fd.termDateTo) return 'Done'
  if (fd.termDateFrom) return 'In Progress'
  return base?.e || 'Pending'
}


const CATEGORY_COLORS = {
  'Power':   { bg: '#ede9fe', text: '#6d28d9' },
  'Control': { bg: '#e0f2fe', text: '#0369a1' },
  'I&C':     { bg: '#fef3c7', text: '#92400e' },
  'PKG':     { bg: '#d1fae5', text: '#065f46' },
}

const PRI_COLORS = {
  'PR':           { bg: '#fce7f3', text: '#9d174d' },
  'Simple Cycle': { bg: '#dbeafe', text: '#1e40af' },
  'ETC':          { bg: '#f3f4f6', text: '#6b7280' },
}

const STATUS_COLORS = {
  'Pending':     { bg: '#f3f4f6', text: '#6b7280' },
  'In Progress': { bg: '#fef3c7', text: '#92400e' },
  'Done':        { bg: '#d1fae5', text: '#065f46' },
}

const PAGE_SIZE = 25
const CATEGORIES = ['All', 'Power', 'Control', 'I&C', 'PKG']
const PRIORITIES = ['All', 'PR', 'Simple Cycle', 'ETC']
const STATUSES = ['All', 'Pending', 'In Progress', 'Done']

export default function CableSchedule() {
  const [allData, setAllData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [priFilter, setPriFilter] = useState('All')
  const [pullFilter, setPullFilter] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [fieldData, setFieldData] = useState(loadFieldData)

  useEffect(() => {
    fetch('/cable-data.json')
      .then(r => r.json())
      .then(data => { setAllData(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = () => setFieldData(loadFieldData())
    window.addEventListener('cable-field-update', handler)
    return () => window.removeEventListener('cable-field-update', handler)
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allData.filter(c => {
      if (catFilter !== 'All' && c.g !== catFilter) return false
      if (priFilter !== 'All' && c.pri !== priFilter) return false
      if (pullFilter !== 'All' && derivePullStatus(c, fieldData[c.n]) !== pullFilter) return false
      if (q) {
        return (
          c.n.toLowerCase().includes(q) ||
          c.s.toLowerCase().includes(q) ||
          (c.sys && c.sys.toLowerCase().includes(q)) ||
          c.f.toLowerCase().includes(q) ||
          c.t.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allData, search, catFilter, priFilter, pullFilter, fieldData])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const handleSearch = v => { setSearch(v); setCurrentPage(1) }
  const handleCat = v => { setCatFilter(v); setCurrentPage(1) }
  const handlePri = v => { setPriFilter(v); setCurrentPage(1) }
  const handlePull = v => { setPullFilter(v); setCurrentPage(1) }

  if (loading) {
    return (
      <div className="cs-page">
        <div className="cs-body">
          <div className="page-header">
            <h2>Cable Schedule</h2>
          </div>
          <div className="cs-loading">Loading data…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="cs-page">
      <div className="cs-body">
        <div className="page-header">
          <h2>Cable Schedule</h2>
          <span className="cs-total">{filtered.length.toLocaleString()} cables</span>
        </div>

        <div className="cs-toolbar">
          <div className="cs-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search Cable No / Spec / System / From / To"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
            {search && <button className="cs-clear" onClick={() => handleSearch('')}>✕</button>}
          </div>
          <select value={catFilter} onChange={e => handleCat(e.target.value)}>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
            ))}
          </select>
          <select value={priFilter} onChange={e => handlePri(e.target.value)}>
            {PRIORITIES.map(p => (
              <option key={p} value={p}>{p === 'All' ? 'All Priorities' : p}</option>
            ))}
          </select>
          <select value={pullFilter} onChange={e => handlePull(e.target.value)}>
            {STATUSES.map(s => (
              <option key={s} value={s}>{s === 'All' ? 'All Pulling' : s}</option>
            ))}
          </select>
          <ScheduleExportMenu rows={filtered} fieldData={fieldData} />
        </div>

        <div className="cs-table-wrap">
          <table className="cs-table">
            <thead>
              <tr>
                <th>CATEGORY</th>
                <th>CABLE NO.</th>
                <th>SPEC</th>
                <th className="num">LENGTH (M)</th>
                <th>SYSTEM</th>
                <th>PRIORITY</th>
                <th>FROM</th>
                <th>TO</th>
                <th>PULLING</th>
                <th>TERMINATION</th>
                <th>LINE CHECK</th>
                <th>ACT NO.</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((c, i) => {
                const catC = CATEGORY_COLORS[c.g] || { bg: '#f3f4f6', text: '#374151' }
                const priC = PRI_COLORS[c.pri] || PRI_COLORS['ETC']
                const isAdj = c.n.includes('AGGREGATE-ADJ')
                const fd = fieldData[c.n] || {}
                const pullStatus = derivePullStatus(c, fd)
                const termStatus = deriveTermStatus(c, fd)
                const pullC = STATUS_COLORS[pullStatus] || STATUS_COLORS['Pending']
                const termC = STATUS_COLORS[termStatus] || STATUS_COLORS['Pending']
                const lcStatus = fd.lc || 'Pending'
                const lcColor = lcStatus === 'Done'
                  ? STATUS_COLORS['Done']
                  : lcStatus === 'In Progress'
                  ? STATUS_COLORS['In Progress']
                  : STATUS_COLORS['Pending']
                return (
                  <tr key={i} className={isAdj ? 'cs-adj-row' : ''}>
                    <td>
                      <span className="cs-badge" style={{ background: catC.bg, color: catC.text }}>{c.g}</span>
                      {isAdj && <span className="cs-agg-badge">AGG</span>}
                    </td>
                    <td className="cs-cable-no">{c.n}</td>
                    <td className="cs-spec">{c.s || '—'}</td>
                    <td className="num">{c.l != null ? c.l.toLocaleString() : '—'}</td>
                    <td className="cs-sys">{c.sys || '—'}</td>
                    <td>
                      <span className="cs-badge" style={{ background: priC.bg, color: priC.text }}>{c.pri}</span>
                    </td>
                    <td className="cs-kks">{c.f || '—'}</td>
                    <td className="cs-kks">{c.t || '—'}</td>
                    <td>
                      <span className="cs-badge" style={{ background: pullC.bg, color: pullC.text }}>{pullStatus}</span>
                    </td>
                    <td>
                      <span className="cs-badge" style={{ background: termC.bg, color: termC.text }}>{termStatus}</span>
                    </td>
                    <td>
                      <span className="cs-badge" style={{ background: lcColor.bg, color: lcColor.text }}>{lcStatus}</span>
                    </td>
                    <td className="cs-act-cell">{fd.act || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="cs-empty">No results found.</div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="cs-pagination">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>‹</button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pg
              if (totalPages <= 7) pg = i + 1
              else if (currentPage <= 4) pg = i + 1
              else if (currentPage >= totalPages - 3) pg = totalPages - 6 + i
              else pg = currentPage - 3 + i
              return (
                <button key={pg} className={pg === currentPage ? 'active' : ''} onClick={() => setCurrentPage(pg)}>
                  {pg}
                </button>
              )
            })}
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>›</button>
            <span className="cs-page-info">Page {currentPage} / {totalPages}</span>
          </div>
        )}
      </div>
    </div>
  )
}
