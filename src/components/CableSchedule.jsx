import { useState, useMemo, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { dataUrl } from '../lib/dataUrl'

const EXPORT_COLS = [
  'Category', 'Cable No.', 'Spec', 'Length (m)', 'System', 'Priority',
  'From', 'To', 'Drum No.', 'Pkg List', 'Pulling', 'Used Drum', 'Termination', 'Line Check', 'Act No.',
]

function buildScheduleRows(rows, fieldData, drumMap, pkgMap = {}) {
  return rows.map(c => {
    const fd = fieldData[c.n] || {}
    const drum = drumMap[c.n] || ''
    return [
      c.g || '', c.n || '', c.s || '', (c.l != null ? c.l : ''), c.sys || '', c.pri || '',
      c.f || '', c.t || '', drum, pkgMap[drum] || '', c.p || '', fd.usedDrum || '', c.e || '', fd.lc || 'Pending', fd.act || '',
    ]
  })
}

function stamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function exportScheduleExcel(rows, fieldData, drumMap, pkgMap) {
  const aoa = [EXPORT_COLS, ...buildScheduleRows(rows, fieldData, drumMap, pkgMap)]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 10 }, { wch: 26 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 13 },
    { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 15 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ]
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: EXPORT_COLS.length - 1, r: aoa.length - 1 } }) }
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Cable Schedule')
  XLSX.writeFile(wb, `Cable Schedule_${stamp()}.xlsx`)
}

function exportScheduleCSV(rows, fieldData, drumMap, pkgMap) {
  const aoa = [EXPORT_COLS, ...buildScheduleRows(rows, fieldData, drumMap, pkgMap)]
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

function ScheduleExportMenu({ rows, fieldData, drumMap, pkgMap }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const run = fn => { fn(rows, fieldData, drumMap, pkgMap); setOpen(false) }
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

// Re-export the Supabase-backed data API so existing import paths keep working.
export { loadFieldData, updateFieldEntry, deleteFieldEntry } from '../lib/dataStore'
import { loadFieldData } from '../lib/dataStore'
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

// FROM area options: physical location of the FROM (feeding) equipment,
// resolved from the schedule's SWGR LOCATION column (elecFromAreaMap) with a
// tag-prefix fallback for anything not covered.
const FROM_AREAS = [
  { code: '1.1', label: '1.1 — Main Building Complex' },
  { code: '1.2', label: '1.2 — LEB Block 1' },
  { code: '1.3', label: '1.3 — LEB Block 2' },
  { code: '4',   label: '4 — STG Generator Step-Up (GSU) Transformer' },
  { code: '5',   label: '5 — GTG Generator Step-Up (GSU) Transformer' },
  { code: '6',   label: '6 — Unit Auxiliary Transformer' },
  { code: '10',  label: '10-11 — Water Treatment Plant' },
  { code: '16',  label: '16 — CEPB (Condensate Extraction Pump Bldg)' },
  { code: '19',  label: '19 — Distribution Point 10kV' },
  { code: '24',  label: '24 — Workshop' },
  { code: '25',  label: '25 — Admin Building (CER/CCR/Server Room)' },
  { code: '34',  label: '34 — Back-Up Transformer' },
  { code: '38',  label: '38 — Operational Control Point (OCP)' },
  { code: '39',  label: '39 — 500 MVA Auto Transformer' },
]

// TO area options: destination system area (sys field based)
const TO_AREAS = [
  { code: '1.1',   label: '1.1 — Main Building Complex',   kw: ['GTG', 'HRSG', 'HSRG', 'STG', 'FEEDWATER', 'HP & LP STEAM', 'CONDENSATE', 'GCB', 'HOT WATER', 'EPB FOR', 'DIVERTER', 'ATMOSPHERIC FLASH', 'AUXILIARY STEAM', 'AUXILIARY BOILER', 'AUX BOILER', 'GT PKG', 'GAS TURBINE CONTROL SYSTEM', 'STEAM', 'VMS', 'DC UPS_ST', 'DCS', 'COMMON DCS', 'Crane & Hoist', 'WASTE WATER', 'SEWAGE'], hidden: true },
  { code: '1.1.1', label: '1.1 — Main BLDG Block #1', kw: [] },
  { code: '1.1.2', label: '1.1 — Main BLDG Block #2', kw: [] },
  { code: '1.2', label: '1.2 — LEB Block 1',             kw: ['LEB #1', '#B1', 'ST1 LEB', 'FMS_LEB #1', 'VMS_LEB #1', 'SWGR_LEB #1', 'TIE FEEDER_LEB #1'] },
  { code: '1.3', label: '1.3 — LEB Block 2',             kw: ['LEB #2', '#B2', 'FMS_LEB #2', 'VMS_LEB #2', 'SWGR_LEB #2', 'TIE FEEDER_LEB #2'] },
  { code: '2.1', label: '2.1 — ACC Block 1',             kw: ['ACC #1', 'AIR COOLED CONDENSER#1'] },
  { code: '2.2', label: '2.2 — ACC Block 2',             kw: ['ACC #2', 'AIR COOLED CONDENSER#2'] },
  { code: '3',   label: '3 — Fuel Gas (FGSS)',             kw: ['FUEL GAS', 'GAS METERING', 'GAS REGULATOR', 'IGNITION GAS'] },
  { code: '7.1', label: '7.1 — CCW Fan Block 1',         kw: ['CCW #1', 'FIN FAN COOLER', 'INST BOX_CCW #1'] },
  { code: '7.2', label: '7.2 — CCW Fan Block 2',         kw: ['CCW #2', 'INST BOX_CCW #2'] },
  { code: '8.1', label: '8.1 — CCW Pump Building Block 1', kw: [] },
  { code: '8.2', label: '8.2 — CCW Pump Building Block 2', kw: [] },
  { code: '9',   label: '9 — BSDG',                      kw: ['BSDG', 'BSDEG', 'EMERGENCY DIESEL', 'Back Up SWGR', 'DU UPS_ACC'] },
  { code: '10',  label: '10-11 — Water Treatment Plant', kw: ['WATER TREATMENT', 'DEMI WATER', 'DEMI WTR', 'POTABLE WATER', 'SERVICE WATER', 'SERVICE WTR', 'RAW WATER', 'RWA WATER', 'WTP'] },
  { code: '16',  label: '16 — CEPB (Condensate Extraction Pump Bldg)', kw: ['CONDENSATE EXTRACTION', 'SWGR_CEPB', 'FMS_CEPB', 'VMS_CEPB'] },
  { code: '18',  label: '18 — Auxiliary Boiler / LER',   kw: [] },
  { code: '19',  label: '19 — Distribution Point 10kV',  kw: [] },
  { code: '21',  label: '21 — Fuel Oil Pump Station',    kw: ['FUEL OIL', 'OIL FACILITY', 'OIL STORAGE'] },
  { code: '23.1', label: '23.1 — Emergency Lube Oil Pit for GT', kw: [] },
  { code: '24',  label: '24 — Workshop',                 kw: ['WORKSHOP'] },
  { code: '25',  label: '25 — Admin Building (CER/CCR/Server Room)',  kw: ['DC UPS_ADM'] },
  { code: '32',  label: '32 — Hot Water Supply Building', kw: [] },
  { code: '33',  label: '33 — Oil Storage Dyke',         kw: [] },
  { code: '34',  label: '34 — Back-Up Transformer',      kw: [] },
  { code: '4.2', label: '4.2 — STG Step-Up Transformer', kw: [] },
  { code: '38',  label: '38 — Operational Control Point (OCP)', kw: ['AIS-OCP'] },
]

// FROM tags whose schedule LOCATION cell is a document reference (e.g.
// "CCP-W-B115-IA-329-0001") rather than a parseable area code — resolved
// manually from the paired TO tag / cable-number block prefix.
const FROM_TAG_AREA = {
  '+QE CEMS': '1.2',
  'STM BLW MOV-1': '1.2', 'STM BLW MOV-2': '1.2',
  'B1-LCP-4101': '1.1', 'B1-LCP-4201': '1.1',
  'B2-LCP-4101': '1.1', 'B2-LCP-4201': '1.1',
}

function getFromArea(tag, elecFromAreaMap = {}) {
  if (!tag) return ''
  if (FROM_TAG_AREA[tag]) return FROM_TAG_AREA[tag]
  if (elecFromAreaMap[tag]) return elecFromAreaMap[tag]
  if (/^(11|12|21|22)[A-Z0-9]/.test(tag)) return '1.1'
  if (tag.startsWith('B1-')) return '1.2'
  if (tag.startsWith('B2-')) return '1.3'
  if (tag.startsWith('B0-')) return '1.2'
  return ''
}

// Heat Tracing Panel (HTP) tag → physical Load Location (from Power Cable Schedule)
const HTP_TAG_AREA = {
  'B0-HTP-00701': '10',   // Water Treatment Plant
  'B0-HTP-00702': '19',   // Distribution Point 10kV / TP Station
  'B0-HTP-00703': '18',   // Auxiliary Boiler / LER
  'B0-HTP-00704': '21',   // Diesel Oil Pump Station (21)
  'B0-HTP-00706': '16',   // CEP Building W/ACC LER
  'B0-HTP-00719': '33',   // Oil Storage Dyke
  'B0-HTP-00720': '24',   // Workshop
  'B0-HTP-00721': '8.2',  // CCW Pump / Heat Exchanger Building Block 2
  'B0-HTP-00725': '4.2',  // STG Generator Step-Up TR / Pipe Rack
  'B1-HTP-16601': '2.1',  // ACC Block 1
  'B2-HTP-16601': '2.2',  // ACC Block 2
}

function getToArea(sys, toTag, elecAreaMap = {}, cableNumAreaMap = {}, cableNum = '') {
  if (!sys) return ''
  // Cable-number-level override (e.g. 10kV SWGR feeder cables with t='-')
  if (cableNum && cableNumAreaMap[cableNum]) return cableNumAreaMap[cableNum]
  // Power Cable Schedule Load Location lookup (tag → area code from xlsx)
  if (toTag && elecAreaMap[toTag]) return elecAreaMap[toTag]
  // Heat Tracing Panels: each HTP tag has a specific physical Load Location
  if (toTag && toTag in HTP_TAG_AREA) return HTP_TAG_AREA[toTag]
  // Admin Building 25 (CER/CCR/Server Room): B0-MD-* panels are physically in Admin Bldg 25
  if (toTag && toTag.startsWith('B0-MD-')) return '25'
  // Fuel Gas (FGSS): must check before generic 'EPB FOR' keyword hits 1.1 (e.g. "EPB FOR FGSS")
  if (sys.includes('FGSS')) return '3'
  // CEPB (Building 16): must check before generic CONDENSATE keyword hits 1.1
  if (sys.includes('CONDENSATE EXTRACTION') || sys.includes('SWGR_CEPB') || sys.includes('FMS_CEPB') || sys.includes('VMS_CEPB')) return '16'
  // CCW Pump Building: sys values identical across blocks — use TO tag prefix
  if (sys.includes('CLOSED COOLING WATER PUMP') || sys.includes('CLOSED COOLING WATER SYSTEM')) {
    if (toTag && toTag.startsWith('B1-')) return '8.1'
    if (toTag && toTag.startsWith('B2-')) return '8.2'
    return ''
  }
  // Waste water: B1/B2 go to their Main Building block; B0-* common → Block #1
  if (sys.includes('WASTE WATER') || sys.includes('SEWAGE')) {
    if (toTag && toTag.startsWith('B2-')) return '1.1.2'
    return '1.1.1'
  }
  // FIN FAN / FFC Instrument Box: split by TO tag B1/B2 prefix
  if (sys.includes('FIN FAN') || sys.includes('INST BOX_FFC')) {
    if (toTag && toTag.startsWith('B1-')) return '7.1'
    if (toTag && toTag.startsWith('B2-')) return '7.2'
    return '7.1'
  }
  // Keyword match for all other systems
  let code = ''
  for (const a of TO_AREAS) {
    if (a.kw.length > 0 && a.kw.some(kw => sys.includes(kw))) { code = a.code; break }
  }
  // Main Building sub-split: 21xx/22xx / B2- = Block 2; everything else (incl. B0-*) = Block 1
  if (code === '1.1') {
    if (toTag && (toTag.startsWith('B2-') || /^(21|22)[A-Z0-9]/.test(toTag))) return '1.1.2'
    return '1.1.1'
  }
  return code
}

// Per-column header filters (Excel-style filter row under the column titles)
const EMPTY_COLF = {
  cat: 'All', cn: '', spec: '', lmin: '', lmax: '', sys: '', pri: 'All',
  from: '', to: '', drum: '', pkg: '', pull: 'All', used: '', term: 'All', lc: 'All', act: '',
  fromArea: '', toArea: '',
}

export default function CableSchedule() {
  const [allData, setAllData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [colF, setColF] = useState(EMPTY_COLF)
  const [currentPage, setCurrentPage] = useState(1)
  const [fieldData, setFieldData] = useState(loadFieldData)
  const [drumMap, setDrumMap] = useState({})
  const [pkgMap, setPkgMap] = useState({})
  const [elecAreaMap, setElecAreaMap] = useState({})
  const [cableNumAreaMap, setCableNumAreaMap] = useState({})
  const [elecFromAreaMap, setElecFromAreaMap] = useState({})

  useEffect(() => {
    fetch(dataUrl('/cable-data.json'))
      .then(r => r.json())
      .then(data => { setAllData(data); setLoading(false) })
      .catch(() => setLoading(false))
    fetch(dataUrl('/cable-drum-map.json'))
      .then(r => r.json())
      .then(setDrumMap)
      .catch(() => setDrumMap({}))
    fetch(dataUrl('/cable-pkg-map.json'))
      .then(r => r.json())
      .then(setPkgMap)
      .catch(() => setPkgMap({}))
    fetch(dataUrl('/cable-elec-area-map.json'))
      .then(r => r.json())
      .then(setElecAreaMap)
      .catch(() => setElecAreaMap({}))
    fetch(dataUrl('/cable-n-area-map.json'))
      .then(r => r.json())
      .then(setCableNumAreaMap)
      .catch(() => setCableNumAreaMap({}))
    fetch(dataUrl('/cable-elec-from-area-map.json'))
      .then(r => r.json())
      .then(setElecFromAreaMap)
      .catch(() => setElecFromAreaMap({}))
  }, [])

  useEffect(() => {
    const handler = () => setFieldData(loadFieldData())
    window.addEventListener('cable-field-update', handler)
    return () => window.removeEventListener('cable-field-update', handler)
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const inc = (val, f) => !f || String(val || '').toLowerCase().includes(f.toLowerCase())
    const lmin = colF.lmin !== '' ? parseFloat(colF.lmin) : null
    const lmax = colF.lmax !== '' ? parseFloat(colF.lmax) : null
    return allData.filter(c => {
      const fd = fieldData[c.n] || {}
      // FROM / TO area filter
      if (colF.fromArea || colF.toArea) {
        const s = c.sys || ''
        if (colF.toArea === '38') {
          // Area 38 (OCP): only AIS-OCP cables; these are PKG so skip the normal PKG exclusion
          if (s !== 'AIS-OCP') return false
        } else {
          if (c.g === 'PKG') return false
          if (s.startsWith('AIS 220kV') || s.startsWith('AIS 500kV') || s === 'AIS-OCP' || s.startsWith('AIS LEB')) return false
          if (colF.fromArea && getFromArea(c.f, elecFromAreaMap) !== colF.fromArea) return false
          if (colF.toArea) {
            const ca = getToArea(c.sys, c.t, elecAreaMap, cableNumAreaMap, c.n)
            if (ca !== colF.toArea) return false
          }
        }
      }
      if (colF.cat !== 'All' && c.g !== colF.cat) return false
      if (colF.pri !== 'All' && c.pri !== colF.pri) return false
      if (!inc(c.n, colF.cn)) return false
      if (!inc(c.s, colF.spec)) return false
      if (lmin != null && !((c.l || 0) >= lmin)) return false
      if (lmax != null && !((c.l || 0) <= lmax)) return false
      if (!inc(c.sys, colF.sys)) return false
      if (!inc(c.f, colF.from)) return false
      if (!inc(c.t, colF.to)) return false
      if (!inc(drumMap[c.n], colF.drum)) return false
      if (!inc(pkgMap[drumMap[c.n]], colF.pkg)) return false
      if (!inc(fd.usedDrum, colF.used)) return false
      if (!inc(fd.act, colF.act)) return false
      if (colF.pull !== 'All' && derivePullStatus(c, fd) !== colF.pull) return false
      if (colF.term !== 'All' && deriveTermStatus(c, fd) !== colF.term) return false
      if (colF.lc !== 'All' && (fd.lc || 'Pending') !== colF.lc) return false
      if (q) {
        const assignedDrum = drumMap[c.n] || ''
        const usedDrum = fd.usedDrum || ''
        const pkgNo = pkgMap[assignedDrum] || ''
        return (
          c.n.toLowerCase().includes(q) ||
          c.s.toLowerCase().includes(q) ||
          (c.sys && c.sys.toLowerCase().includes(q)) ||
          c.f.toLowerCase().includes(q) ||
          c.t.toLowerCase().includes(q) ||
          assignedDrum.toLowerCase().includes(q) ||
          usedDrum.toLowerCase().includes(q) ||
          pkgNo.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allData, search, colF, fieldData, drumMap, pkgMap, elecAreaMap, cableNumAreaMap, elecFromAreaMap])

  const totalMeters = useMemo(() => filtered.reduce((s, c) => s + (c.l || 0), 0), [filtered])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const handleSearch = v => { setSearch(v); setCurrentPage(1) }
  const setCF = (k, v) => { setColF(f => ({ ...f, [k]: v })); setCurrentPage(1) }
  const anyColF = Object.keys(EMPTY_COLF).some(k => colF[k] !== EMPTY_COLF[k])
  const resetColF = () => { setColF(EMPTY_COLF); setCurrentPage(1) }

  const cfText = (key, ph = 'Filter') => (
    <input
      type="text"
      className={`cs-cf${colF[key] ? ' active' : ''}`}
      placeholder={ph}
      value={colF[key]}
      onChange={e => setCF(key, e.target.value)}
    />
  )
  const cfSelect = (key, options) => (
    <select
      className={`cs-cf${colF[key] !== 'All' ? ' active' : ''}`}
      value={colF[key]}
      onChange={e => setCF(key, e.target.value)}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

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
          <div className="cs-header-stats">
            <span className="cs-meters">
              {Math.round(totalMeters).toLocaleString()}<span className="cs-meters-unit"> m</span>
            </span>
            <span className="cs-total">{filtered.length.toLocaleString()} cables</span>
          </div>
        </div>

        <div className="cs-toolbar">
          <div className="cs-loc-bar">
            <span className="cs-loc-label">Location</span>
            <div className="cs-loc-selects">
              <select
                className={`cs-loc-select${colF.fromArea ? ' active' : ''}`}
                value={colF.fromArea}
                onChange={e => setCF('fromArea', e.target.value)}
              >
                <option value="">FROM — Any</option>
                {FROM_AREAS.map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
              </select>
              <span className="cs-loc-arrow">→</span>
              <select
                className={`cs-loc-select${colF.toArea ? ' active' : ''}`}
                value={colF.toArea}
                onChange={e => setCF('toArea', e.target.value)}
              >
                <option value="">TO — Any</option>
                {TO_AREAS.filter(a => !a.hidden).map(a => <option key={a.code} value={a.code}>{a.label}</option>)}
              </select>
            </div>
            {(colF.fromArea || colF.toArea) && colF.toArea !== '38' && (
              <span className="cs-loc-note">AIS &amp; PKG excluded</span>
            )}
          </div>
          <div className="cs-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search Cable No / Spec / System / From / To / Drum No / Used Drum"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
            {search && <button className="cs-clear" onClick={() => handleSearch('')}>✕</button>}
          </div>
          {anyColF && (
            <button type="button" className="cs-reset-filters" onClick={resetColF}>
              ✕ Reset Filters
            </button>
          )}
          <ScheduleExportMenu rows={filtered} fieldData={fieldData} drumMap={drumMap} pkgMap={pkgMap} />
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
                <th>DRUM NO.</th>
                <th>PKG LIST</th>
                <th>PULLING</th>
                <th>USED DRUM</th>
                <th>TERMINATION</th>
                <th>LINE CHECK</th>
                <th>ACT NO.</th>
              </tr>
              <tr className="cs-filter-row">
                <th>{cfSelect('cat', CATEGORIES)}</th>
                <th>{cfText('cn')}</th>
                <th>{cfText('spec')}</th>
                <th>
                  <div className="cs-cf-len">
                    <input type="number" className={`cs-cf${colF.lmin ? ' active' : ''}`} placeholder="Min"
                      value={colF.lmin} onChange={e => setCF('lmin', e.target.value)} />
                    <input type="number" className={`cs-cf${colF.lmax ? ' active' : ''}`} placeholder="Max"
                      value={colF.lmax} onChange={e => setCF('lmax', e.target.value)} />
                  </div>
                </th>
                <th>{cfText('sys')}</th>
                <th>{cfSelect('pri', PRIORITIES)}</th>
                <th>{cfText('from')}</th>
                <th>{cfText('to')}</th>
                <th>{cfText('drum')}</th>
                <th>{cfText('pkg', 'e.g. 590')}</th>
                <th>{cfSelect('pull', STATUSES)}</th>
                <th>{cfText('used')}</th>
                <th>{cfSelect('term', STATUSES)}</th>
                <th>{cfSelect('lc', STATUSES)}</th>
                <th>{cfText('act')}</th>
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
                    <td className="cs-kks">{drumMap[c.n] || '—'}</td>
                    <td className="cs-pkg-cell">{pkgMap[drumMap[c.n]] || '—'}</td>
                    <td>
                      <span className="cs-badge" style={{ background: pullC.bg, color: pullC.text }}>{pullStatus}</span>
                    </td>
                    <td className="cs-kks">{fd.usedDrum || '—'}</td>
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

        <p className="cm-note">
          <strong>Drum No.</strong> is the assigned drum from the master schedule — paste it into <strong>Cable Material</strong>'s
          search to find which packing list it ships in. AIS cables use their real interconnection-diagram numbers (e.g. D01_119)
          with drums from the 2026.06.30 revision. For PKG cables with no individual drum (FGSS, HRSG, STG), this shows the
          <strong> Packing List</strong> number instead. DCS and FFC are not yet covered (multiple packing lists, no per-cable key).
          <strong> Used Drum</strong> is the actual drum entered in Work Log after pulling — compare the two to catch cases where a
          different drum was used than planned.
        </p>
      </div>
    </div>
  )
}
