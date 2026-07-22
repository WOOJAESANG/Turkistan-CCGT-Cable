import { useState, useMemo, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { loadFieldData } from '../lib/dataStore'
import { dataUrl } from '../lib/dataUrl'
import { stamp, num } from '../lib/format'

const EXPORT_COLS = [
  'No.', 'Category', 'Type', 'Title', 'In-Charge', 'Document No.',
  'Packing List', 'Packing Detail', 'Drum No.', 'Drum Count',
  'Delivery', 'ETA', 'Remark',
]

function buildRows(rows) {
  return rows.map(r => [
    r.no, r.category, r.cableType || '', r.title || '', r.inCharge || '',
    r.docNo || '', r.packingList || '', r.packingDetail || '',
    (r.drumList && r.drumList.length ? r.drumList.join(', ') : (r.drumNo || '')),
    r.drumCount ?? (r.drumList ? r.drumList.length : ''),
    r.status || '', r.eta || '', r.remark || '',
  ])
}


function exportExcel(rows) {
  const aoa = [EXPORT_COLS, ...buildRows(rows)]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 5 }, { wch: 14 }, { wch: 8 }, { wch: 34 }, { wch: 18 },
    { wch: 26 }, { wch: 16 }, { wch: 26 }, { wch: 60 }, { wch: 6 },
    { wch: 12 }, { wch: 12 }, { wch: 22 },
  ]
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: EXPORT_COLS.length - 1, r: aoa.length - 1 } }) }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cable Material')
  XLSX.writeFile(wb, `Cable Material Information_${stamp()}.xlsx`)
}

function exportCSV(rows) {
  const aoa = [EXPORT_COLS, ...buildRows(rows)]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const csv = XLSX.utils.sheet_to_csv(ws)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Cable Material Information_${stamp()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const CATEGORY_COLORS = {
  'Power Cable':   { bg: '#ede9fe', text: '#6d28d9' },
  'Control Cable': { bg: '#e0f2fe', text: '#0369a1' },
  'I&C Cable':     { bg: '#fef3c7', text: '#92400e' },
  'PKG Cable':     { bg: '#d1fae5', text: '#065f46' },
}
const CAT_SHORT = {
  'Power Cable': 'Power', 'Control Cable': 'Control',
  'I&C Cable': 'I&C', 'PKG Cable': 'PKG',
}
const STATUS_COLORS = {
  'On-Site':     { bg: '#d1fae5', text: '#065f46' },
  'Cargo Ready': { bg: '#fef3c7', text: '#92400e' },
  'Sailing':     { bg: '#e0f2fe', text: '#0369a1' },
}
const CATEGORIES = ['All', 'Power Cable', 'Control Cable', 'I&C Cable', 'PKG Cable']
const DELIVERY = ['All', 'On-Site', 'Cargo Ready', 'Sailing']

// Per-column header filters (Excel-style filter row under the column titles)
const EMPTY_CMF = {
  cat: 'All', type: '', title: '', charge: '', doc: '',
  packing: '', detail: '', drum: '', status: 'All', eta: '', remark: '',
}

function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function DownloadLink({ url, label, name }) {
  if (!label) return <span className="cm-muted">—</span>
  if (!url) return <span className="cm-code cm-muted" title="No file available">{label}</span>
  return (
    <a className="cm-dl" href={dataUrl(url)} download={name} title={`Download ${name}`}>
      <DownloadIcon />
      <span>{label}</span>
    </a>
  )
}

function DrumDropdown({ list, compact, highlight }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const btnRef = useRef(null)

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const W = 240, margin = 8
    let left = r.left
    if (left + W > window.innerWidth - margin) left = window.innerWidth - W - margin
    const below = window.innerHeight - r.bottom
    const openUp = below < 280 && r.top > below
    setPos({ left: Math.max(margin, left), top: openUp ? null : r.bottom + 5, bottom: openUp ? window.innerHeight - r.top + 5 : null })
  }

  const toggle = () => {
    if (!open) { place(); setQ('') }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    // scrolling inside the panel must not close it; outside scroll re-anchors
    // the fixed panel to the button, closing only once the button scrolls away
    const onScroll = e => {
      if (ref.current && e.target instanceof Node && ref.current.contains(e.target)) return
      const r = btnRef.current?.getBoundingClientRect()
      if (!r || r.bottom < 0 || r.top > window.innerHeight) { setOpen(false); return }
      place()
    }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  if (!list || list.length === 0) return <span className="cm-muted">—</span>

  const ql = q.trim().toLowerCase()
  const shown = ql ? list.filter(d => d.toLowerCase().includes(ql)) : list

  return (
    <div className="cm-drumdd" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className={`cm-drumdd-btn${open ? ' open' : ''}`}
        onClick={toggle}
        title={compact}
      >
        <span className="cm-drumdd-count">{list.length}</span>
        <span className="cm-drumdd-label">drum{list.length > 1 ? 's' : ''}</span>
        <svg className="cm-drumdd-caret" width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pos && (
        <div
          className="cm-drumdd-panel"
          style={{ left: pos.left, top: pos.top ?? undefined, bottom: pos.bottom ?? undefined }}
        >
          <div className="cm-drumdd-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              autoFocus
              type="text"
              placeholder="Find drum no."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            {q && <button className="cm-drumdd-clear" onClick={() => setQ('')}>✕</button>}
          </div>
          <div className="cm-drumdd-list">
            {shown.length === 0 && <div className="cm-drumdd-empty">No match</div>}
            {shown.map(d => {
              const hl = highlight && d.toLowerCase().includes(highlight)
              return (
                <div key={d} className={`cm-drumdd-item${hl ? ' hit' : ''}`}>{d}</div>
              )
            })}
          </div>
          <div className="cm-drumdd-foot">
            {ql ? `${shown.length} of ${list.length}` : `${list.length} total`}
          </div>
        </div>
      )}
    </div>
  )
}

function ExportMenu({ rows }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const run = fn => { fn(rows); setOpen(false) }
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
          <button onClick={() => run(exportExcel)}>
            <span className="cm-export-ico xls">XLS</span> Excel (.xlsx)
          </button>
          <button onClick={() => run(exportCSV)}>
            <span className="cm-export-ico csv">CSV</span> CSV (.csv)
          </button>
          <button onClick={() => { setOpen(false); setTimeout(() => window.print(), 60) }}>
            <span className="cm-export-ico pdf">PDF</span> PDF / Print
          </button>
        </div>
      )}
    </div>
  )
}

// ── Drum Usage: per-drum consumption from Work Log vs packing-list capacity ──

// Legacy AIS tags (before packing-prefixed rename) → canonical prefixed tags.
// Unprefixed PoCable maps to 0481: 0570 is not yet on site, so any existing
// Work Log entry can only have used a 0481 drum.
const LEGACY_AIS_PK = { pocable: '0481', cocable: '0571', cc: '0585', cmcable: '0587' }
function canonDrum(tag) {
  const m = tag.match(/^AIS-(PoCable|CoCable|CC|CMcable)-(\d{1,3})$/i)
  if (!m) return tag
  const pk = LEGACY_AIS_PK[m[1].toLowerCase()]
  return `AIS-${m[1]}-${pk}-${m[2].padStart(3, '0')}`
}

function DrumUsage({ capacity }) {
  const [fieldData, setFieldData] = useState(loadFieldData)
  const [q, setQ] = useState('')

  useEffect(() => {
    const h = () => setFieldData(loadFieldData())
    window.addEventListener('cable-field-update', h)
    return () => window.removeEventListener('cable-field-update', h)
  }, [])

  const capUpper = useMemo(() => {
    const m = new Map()
    for (const [tag, v] of Object.entries(capacity || {})) m.set(tag.toUpperCase(), { tag, ...v })
    return m
  }, [capacity])

  const rows = useMemo(() => {
    const byKey = new Map()
    for (const [cno, e] of Object.entries(fieldData || {})) {
      const drum = canonDrum((e?.usedDrum || '').trim())
      if (!drum) continue
      const cap = capUpper.get(drum.toUpperCase())
      const pk = cap?.pk || '—'
      const key = drum.toUpperCase() + '\x00' + pk
      if (!byKey.has(key)) byKey.set(key, {
        drum, pk,
        capacity: cap?.m ?? null,
        used: 0, cables: [],
      })
      const r = byKey.get(key)
      r.used += num(e.pulledLength)
      r.cables.push(cno)
    }
    const out = [...byKey.values()].map(r => ({
      ...r,
      remaining: r.capacity != null ? r.capacity - r.used : null,
      pct: r.capacity && r.capacity > 0 ? Math.min(100, (r.used / r.capacity) * 100) : null,
    }))
    out.sort((a, b) => b.used - a.used)
    const ql = q.trim().toLowerCase()
    return ql ? out.filter(r => r.drum.toLowerCase().includes(ql) || r.pk.toLowerCase().includes(ql)) : out
  }, [fieldData, capUpper, q])

  const totals = useMemo(() => ({
    drums: rows.length,
    used: rows.reduce((s, r) => s + r.used, 0),
    remaining: rows.reduce((s, r) => s + (r.remaining ?? 0), 0),
  }), [rows])

  return (
    <>
      <div className="cs-toolbar">
        <div className="cs-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Search Drum No / Packing List" value={q} onChange={e => setQ(e.target.value)} />
          {q && <button className="cs-clear" onClick={() => setQ('')}>✕</button>}
        </div>
        <span className="du-totals">
          {totals.drums} drums in use · <b>{Math.round(totals.used).toLocaleString()} m</b> pulled ·{' '}
          <b className="du-remain">{Math.round(totals.remaining).toLocaleString()} m</b> remaining
        </span>
      </div>

      <div className="cs-table-wrap">
        <table className="cs-table">
          <thead>
            <tr>
              <th>DRUM NO.</th>
              <th>PACKING LIST</th>
              <th className="num">CAPACITY (M)</th>
              <th className="num">USED (M)</th>
              <th className="num">REMAINING (M)</th>
              <th>USAGE</th>
              <th className="num">CABLES</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const over = r.remaining != null && r.remaining < 0
              const low = !over && r.remaining != null && r.capacity > 0 && r.remaining / r.capacity < 0.1
              return (
                <tr key={r.drum + '\x00' + r.pk}>
                  <td className="cs-cable-no">{r.drum}</td>
                  <td className="cs-kks">{r.pk}</td>
                  <td className="num">{r.capacity != null ? Math.round(r.capacity).toLocaleString() : '—'}</td>
                  <td className="num du-used">{Math.round(r.used).toLocaleString()}</td>
                  <td className={`num ${over ? 'du-over' : low ? 'du-low' : 'du-remain'}`}>
                    {r.remaining != null ? Math.round(r.remaining).toLocaleString() : '—'}
                  </td>
                  <td className="du-bar-cell">
                    {r.pct != null ? (
                      <div className="du-bar-track" title={`${r.pct.toFixed(1)}%`}>
                        <div className={`du-bar-fill${over ? ' over' : low ? ' low' : ''}`} style={{ width: `${r.pct}%` }} />
                      </div>
                    ) : <span className="cm-muted">no capacity data</span>}
                  </td>
                  <td className="num" title={r.cables.join(', ')}>{r.cables.length}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="cs-empty">No drums recorded yet — enter a Used Drum in Work Log and it will appear here.</div>
        )}
      </div>

      <p className="cm-note">
        <strong>Used (m)</strong> = sum of pulled lengths entered in Work Log for each drum. <strong>Capacity</strong> comes
        from the packing lists (Detail PL sheets). Rows without capacity data are drums whose packing file does not state
        a length (e.g. ACC, FFC-CAB, DCS cabinets) or free-text drum names that don't match a packing tag — check spelling
        against the Drum No. dropdown on the Packing List view. Remaining under 10% is highlighted amber; negative (over-pulled) red.
      </p>
    </>
  )
}

export default function CableMaterial() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [colF, setColF] = useState(EMPTY_CMF)
  const [view, setView] = useState('packing')
  const [capacity, setCapacity] = useState({})

  useEffect(() => {
    fetch(dataUrl('/cable-material.json'))
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
    fetch(dataUrl('/drum-capacity.json'))
      .then(r => r.json())
      .then(setCapacity)
      .catch(() => setCapacity({}))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const inc = (val, f) => !f || String(val || '').toLowerCase().includes(f.toLowerCase())
    return data.filter(r => {
      if (colF.cat !== 'All' && r.category !== colF.cat) return false
      if (colF.status !== 'All' && (r.status || '').trim() !== colF.status) return false
      if (!inc(r.cableType, colF.type)) return false
      if (!inc(r.title, colF.title)) return false
      if (!inc(r.inCharge, colF.charge)) return false
      if (!inc(r.docNo, colF.doc)) return false
      if (!inc(r.packingList, colF.packing)) return false
      if (!inc(r.packingDetail, colF.detail)) return false
      if (colF.drum && !(r.drumNo || '').toLowerCase().includes(colF.drum.toLowerCase())
        && !(r.drumList || []).some(d => d.toLowerCase().includes(colF.drum.toLowerCase()))) return false
      if (!inc(r.eta, colF.eta)) return false
      if (!inc(r.remark, colF.remark)) return false
      if (!q) return true
      const fields = [r.title, r.drumNo, r.packingList, r.docNo, r.inCharge, r.packingDetail, r.cableType]
      if (fields.some(v => v && String(v).toLowerCase().includes(q))) return true
      return (r.drumList || []).some(d => d.toLowerCase().includes(q))
    })
  }, [data, search, colF])

  const setCF = (k, v) => setColF(f => ({ ...f, [k]: v }))
  const anyColF = Object.keys(EMPTY_CMF).some(k => colF[k] !== EMPTY_CMF[k])
  const cfText = key => (
    <input type="text" className={`cs-cf${colF[key] ? ' active' : ''}`} placeholder="Filter"
      value={colF[key]} onChange={e => setCF(key, e.target.value)} />
  )
  const cfSelect = (key, options) => (
    <select className={`cs-cf${colF[key] !== 'All' ? ' active' : ''}`} value={colF[key]}
      onChange={e => setCF(key, e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  if (loading) {
    return (
      <div className="cs-page"><div className="cs-body">
        <div className="page-header"><h2>Cable Material Information</h2></div>
        <div className="cs-loading">Loading data…</div>
      </div></div>
    )
  }

  return (
    <div className="cs-page">
      <div className="cs-body">
        <div className="page-header">
          <div className="cm-header-left">
            <h2>Cable Material Information</h2>
            <div className="cm-subtitle">Packing &amp; Drum</div>
          </div>
          <div className="cm-header-right">
            <div className="cm-view-toggle">
              <button className={view === 'packing' ? 'active' : ''} onClick={() => setView('packing')}>Packing List</button>
              <button className={view === 'drums' ? 'active' : ''} onClick={() => setView('drums')}>Drum Usage</button>
            </div>
            {view === 'packing' && <span className="cs-total">{filtered.length} of {data.length} items</span>}
          </div>
        </div>

        {view === 'drums' && <DrumUsage capacity={capacity} />}

        {view === 'packing' && <>
        <div className="cm-print-head">
          <div className="cm-print-title">Cable Material Information — Packing &amp; Drum</div>
          <div className="cm-print-meta">
            Turkistan CCGT · {colF.cat === 'All' ? 'All Categories' : colF.cat}
            {search ? ` · Filter: “${search}”` : ''} · {filtered.length} items · {stamp()}
          </div>
        </div>

        <div className="cs-toolbar">
          <div className="cs-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" placeholder="Search Title / Drum No / Packing List / Document / In-Charge"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="cs-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          {anyColF && (
            <button type="button" className="cs-reset-filters" onClick={() => setColF(EMPTY_CMF)}>
              ✕ Reset Filters
            </button>
          )}
          <ExportMenu rows={filtered} />
        </div>

        <div className="cs-table-wrap">
          <table className="cs-table cm-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Category</th>
                <th>Type</th>
                <th>Title</th>
                <th>In-Charge</th>
                <th>Document No. (Drawing)</th>
                <th>Packing List</th>
                <th>Packing Detail</th>
                <th>Drum No.</th>
                <th>Delivery</th>
                <th>ETA</th>
                <th>Remark</th>
              </tr>
              <tr className="cs-filter-row">
                <th />
                <th>{cfSelect('cat', CATEGORIES)}</th>
                <th>{cfText('type')}</th>
                <th>{cfText('title')}</th>
                <th>{cfText('charge')}</th>
                <th>{cfText('doc')}</th>
                <th>{cfText('packing')}</th>
                <th>{cfText('detail')}</th>
                <th>{cfText('drum')}</th>
                <th>{cfSelect('status', DELIVERY)}</th>
                <th>{cfText('eta')}</th>
                <th>{cfText('remark')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const catC = CATEGORY_COLORS[r.category] || { bg: '#f3f4f6', text: '#374151' }
                const stC = STATUS_COLORS[r.status] || { bg: '#f3f4f6', text: '#6b7280' }
                return (
                  <tr key={r.no}>
                    <td className="cm-no">{r.no}</td>
                    <td><span className="cs-badge" style={{ background: catC.bg, color: catC.text }}>{CAT_SHORT[r.category] || r.category}</span></td>
                    <td className="cm-type">{r.cableType || '—'}</td>
                    <td className="cm-title">{r.title}</td>
                    <td className="cm-charge">{r.inCharge}</td>
                    <td>
                      {r.docUrl2 ? (
                        <div className="cm-doc-pair">
                          <span className="cm-doc-no cm-muted">{r.docNo}</span>
                          <div className="cm-dl-row">
                            <DownloadLink url={r.docUrl} label="220kV" name={r.docName} />
                            <DownloadLink url={r.docUrl2} label="500kV" name={r.docName2} />
                          </div>
                        </div>
                      ) : (
                        <DownloadLink url={r.docUrl} label={r.docNo} name={r.docName} />
                      )}
                    </td>
                    <td><DownloadLink url={r.packingUrl} label={r.packingList} name={r.packingName} /></td>
                    <td className="cm-code cm-muted">{r.packingDetail || '—'}</td>
                    <td className="cm-drum">
                      <DrumDropdown list={r.drumList} compact={r.drumNo} highlight={search.trim().toLowerCase()} />
                      <span className="cm-drum-print">{r.drumNo || '—'}{r.drumCount ? ` (${r.drumCount})` : ''}</span>
                    </td>
                    <td><span className="cs-badge" style={{ background: stC.bg, color: stC.text }}>{r.status || '—'}</span></td>
                    <td className="cm-eta">{r.eta || '—'}</td>
                    <td className="cm-remark">{r.remark || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="cs-empty">No results found.</div>}
        </div>

        <p className="cm-note">
          Click a <strong>Document No.</strong> or <strong>Packing List</strong> number to download the source Excel file.
          Open the <strong>Drum No.</strong> dropdown to browse or search every individual drum tag; the top search box also matches drum numbers across all rows.
        </p>
        </>}
      </div>
    </div>
  )
}
