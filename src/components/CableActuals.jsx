import { useState, useMemo, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { loadFieldData, updateFieldEntry, deleteFieldEntry, loadVendors } from '../lib/dataStore'

const DATE_MIN = '2026-07-01'
const DATE_MAX = '2028-12-31'

const CATEGORY_COLORS = {
  'Power':   { bg: '#ede9fe', text: '#6d28d9' },
  'Control': { bg: '#e0f2fe', text: '#0369a1' },
  'I&C':     { bg: '#fef3c7', text: '#92400e' },
  'PKG':     { bg: '#d1fae5', text: '#065f46' },
}
const STATUS_COLORS = {
  'Pending':     { bg: '#f3f4f6', text: '#6b7280' },
  'In Progress': { bg: '#fef3c7', text: '#92400e' },
  'Done':        { bg: '#d1fae5', text: '#065f46' },
}
const LC_OPTIONS = ['Pending', 'In Progress', 'Done']

const EMPTY_FORM = {
  vendor: '',
  pulledLength: '', usedDrum: '', pulledBy: '', pullingDate: '',
  termDateFrom: '', termByFrom: '', termDateTo: '', termByTo: '',
  lc: 'Pending', act: '',
}
// presence of any of these flags a real record (vendor / manpower are reference-only)
const TEXT_FIELDS = ['pulledLength', 'usedDrum', 'pulledBy', 'pullingDate',
  'termDateFrom', 'termByFrom', 'termDateTo', 'termByTo', 'act']
function hasActuals(e) {
  if (!e) return false
  if (TEXT_FIELDS.some(k => e[k] != null && String(e[k]).trim() !== '')) return true
  return e.lc && e.lc !== 'Pending'
}
function pickForm(e = {}) {
  const out = { ...EMPTY_FORM }
  for (const k of Object.keys(EMPTY_FORM)) out[k] = e[k] != null ? e[k] : EMPTY_FORM[k]
  return out
}

// per-phase required-field validation (단계별)
function validate(tag, form) {
  const miss = new Set()
  const labels = []
  if (!(tag || '').trim()) { miss.add('tag'); labels.push('Cable Tag') }
  const PULL = [['pulledLength', 'Pulled Length'], ['usedDrum', 'Used Drum (Drum No.)'],
    ['pulledBy', 'Pulled By'], ['pullingDate', 'Pulling Date']]
  const pullFilled = PULL.some(([k]) => String(form[k] || '').trim())
  if (pullFilled) for (const [k, l] of PULL) if (!String(form[k] || '').trim()) { miss.add(k); labels.push(l) }
  if (['termDateFrom', 'termByFrom'].some(k => String(form[k] || '').trim())) {
    if (!String(form.termDateFrom || '').trim()) { miss.add('termDateFrom'); labels.push('Termination Date (From)') }
    if (!String(form.termByFrom || '').trim()) { miss.add('termByFrom'); labels.push('Terminated By (From)') }
  }
  if (['termDateTo', 'termByTo'].some(k => String(form[k] || '').trim())) {
    if (!String(form.termDateTo || '').trim()) { miss.add('termDateTo'); labels.push('Termination Date (To)') }
    if (!String(form.termByTo || '').trim()) { miss.add('termByTo'); labels.push('Terminated By (To)') }
  }
  const anyPhase = pullFilled || ['termDateFrom', 'termByFrom', 'termDateTo', 'termByTo'].some(k => String(form[k] || '').trim())
  if ((tag || '').trim() && !anyPhase) labels.push('Pulling 또는 Termination 실적 1개 이상')
  return { ok: miss.size === 0 && labels.length === 0, miss, labels }
}

function stamp() {
  const d = new Date(); const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ---- Cable Tag autocomplete (master list) + free-text fallback ----
function CableTagInput({ value, onChange, onPick, master, invalid }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const matches = useMemo(() => {
    const q = (value || '').trim().toLowerCase()
    if (!q) return []
    const out = []
    for (const c of master) {
      if (c.n && c.n.toLowerCase().includes(q)) { out.push(c); if (out.length >= 50) break }
    }
    return out
  }, [value, master])

  return (
    <div className="ca-combo" ref={ref}>
      <input
        className={`ca-input ca-tag-input${invalid ? ' ca-err' : ''}`}
        type="text"
        placeholder="Type cable no. — e.g. B1-SWG-64601-P2001"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => value && setOpen(true)}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div className="ca-combo-list">
          {matches.map(c => {
            const cc = CATEGORY_COLORS[c.g] || { bg: '#f3f4f6', text: '#374151' }
            return (
              <button type="button" key={c.n} className="ca-combo-item"
                onClick={() => { onPick(c); setOpen(false) }}>
                <span className="ca-combo-no">{c.n}</span>
                <span className="ca-combo-meta">
                  <span className="cs-badge" style={{ background: cc.bg, color: cc.text }}>{c.g}</span>
                  <span className="ca-combo-spec">{c.s || ''}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Used Drum autocomplete (drum master from Cable Material) + manual entry ----
function DrumInput({ value, onChange, master, cat, invalid }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const matches = useMemo(() => {
    const q = (value || '').trim().toLowerCase()
    let pool
    if (q) pool = master.filter(d => d.drum.toLowerCase().includes(q))
    else if (cat) pool = master.filter(d => d.cat === cat)
    else return []
    return pool.slice(0, 60)
  }, [value, master, cat])

  return (
    <div className="ca-combo" ref={ref}>
      <input
        className={`ca-input${invalid ? ' ca-err' : ''}`}
        type="text"
        placeholder="Pick from list or type manually"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div className="ca-combo-list">
          {matches.map(d => {
            const cc = CATEGORY_COLORS[d.cat] || { bg: '#f3f4f6', text: '#374151' }
            return (
              <button type="button" key={d.drum} className="ca-combo-item ca-combo-item-drum"
                onClick={() => { onChange(d.drum); setOpen(false) }}>
                <span className="ca-combo-no">{d.drum}</span>
                {d.cat && <span className="cs-badge" style={{ background: cc.bg, color: cc.text }}>{d.cat}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function CableActuals() {
  const [master, setMaster] = useState([])
  const [masterMap, setMasterMap] = useState(new Map())
  const [drumMaster, setDrumMaster] = useState([])
  const [loading, setLoading] = useState(true)
  const [fieldData, setFieldData] = useState(loadFieldData)
  const [tag, setTag] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [missing, setMissing] = useState(new Set())
  const [search, setSearch] = useState('')
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/cable-data.json').then(r => r.json()),
      fetch('/cable-material.json').then(r => r.json()).catch(() => []),
    ]).then(([cables, materials]) => {
      setMaster(cables)
      setMasterMap(new Map(cables.map(c => [c.n, c])))
      const dm = []; const seen = new Set()
      for (const item of materials) {
        const cat = (item.category || '').replace(' Cable', '')
        for (const drum of (item.drumList || [])) {
          if (!seen.has(drum)) { seen.add(drum); dm.push({ drum, cat }) }
        }
      }
      setDrumMaster(dm)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = () => setFieldData(loadFieldData())
    window.addEventListener('cable-field-update', handler)
    return () => window.removeEventListener('cable-field-update', handler)
  }, [])

  const context = tag ? masterMap.get(tag.trim()) : null
  const clearErr = () => { if (missing.size) setMissing(new Set()); if (flash && flash.type === 'err') setFlash(null) }
  const setField = (k, v) => { setForm(f => ({ ...f, [k]: v })); clearErr() }
  const ic = key => `ca-input${missing.has(key) ? ' ca-err' : ''}`

  const onTagChange = v => {
    setTag(v); clearErr()
    const c = masterMap.get(v.trim())
    if (c) setForm(pickForm(fieldData[v.trim()]))
  }
  const pickCable = c => { setTag(c.n); setForm(pickForm(fieldData[c.n])); clearErr() }

  const save = () => {
    const t = tag.trim()
    const { ok, miss, labels } = validate(tag, form)
    if (!ok) {
      setMissing(miss)
      setFlash({ type: 'err', msg: `필수 항목을 입력하세요 — ${labels.join(', ')}` })
      return
    }
    updateFieldEntry(t, { ...form })
    setMissing(new Set())
    setFlash({ type: 'ok', msg: `저장 완료 · ${t}` })
    setTimeout(() => setFlash(null), 2800)
  }
  const clear = () => { setTag(''); setForm(EMPTY_FORM); setMissing(new Set()); setFlash(null) }

  const editRecord = cno => {
    setTag(cno); setForm(pickForm(fieldData[cno])); setMissing(new Set()); setFlash(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const removeRecord = cno => {
    if (!window.confirm(`${cno} 실적을 삭제할까요?`)) return
    deleteFieldEntry(cno)
    if (tag.trim() === cno) clear()
  }

  const records = useMemo(() => {
    const q = search.trim().toLowerCase()
    return Object.entries(fieldData)
      .filter(([, e]) => hasActuals(e))
      .filter(([cno]) => !q || cno.toLowerCase().includes(q))
      .map(([cno, e]) => ({ cno, ...e, cat: masterMap.get(cno)?.g || '' }))
      .sort((a, b) => a.cno.localeCompare(b.cno))
  }, [fieldData, search, masterMap])

  const EXPORT_COLS = ['Cable Tag', 'Category', 'Vendor', 'Pulled Length(m)', 'Used Drum', 'Pulled By',
    'Pulling Date', 'Term Date (From)', 'Terminated By (From)',
    'Term Date (To)', 'Terminated By (To)', 'Line Check', 'ACT No.']
  const buildRows = () => records.map(r => [
    r.cno, r.cat, r.vendor || '', r.pulledLength || '', r.usedDrum || '', r.pulledBy || '',
    r.pullingDate || '', r.termDateFrom || '', r.termByFrom || '',
    r.termDateTo || '', r.termByTo || '', r.lc || 'Pending', r.act || '',
  ])
  const exportExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([EXPORT_COLS, ...buildRows()])
    ws['!cols'] = [{ wch: 26 }, { wch: 9 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 13 },
      { wch: 13 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 14 }]
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: EXPORT_COLS.length - 1, r: records.length } }) }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Work Log')
    XLSX.writeFile(wb, `Work Log_${stamp()}.xlsx`)
  }
  const exportCSV = () => {
    const ws = XLSX.utils.aoa_to_sheet([EXPORT_COLS, ...buildRows()])
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `Work Log_${stamp()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="cs-page"><div className="cs-body">
        <div className="page-header"><h2>Work Log</h2></div>
        <div className="cs-loading">Loading data…</div>
      </div></div>
    )
  }

  const tagTrim = tag.trim()
  const tagState = !tagTrim ? null : (context ? 'in' : 'free')

  return (
    <div className="cs-page">
      <div className="cs-body">
        <div className="page-header">
          <div className="cm-header-left">
            <h2>Work Log</h2>
            <div className="cm-subtitle">Field Records · 실적 입력</div>
          </div>
          <span className="cs-total">{records.length} records</span>
        </div>

        {/* ---- Entry form ---- */}
        <div className="ca-form">
          <div className="ca-top-row">
            <div className="ca-field ca-field-tag">
              <label>Cable Tag <span className="ca-req">*</span></label>
              <CableTagInput value={tag} onChange={onTagChange} onPick={pickCable} master={master} invalid={missing.has('tag')} />
              {tagState === 'in' && context && (
                <div className="ca-ctx ca-ctx-in">
                  <span className="cs-badge" style={{ ...(CATEGORY_COLORS[context.g] || { bg: '#eee', text: '#333' }) }}>{context.g}</span>
                  <span className="ca-ctx-item">{context.s || '—'}</span>
                  <span className="ca-ctx-sep">·</span>
                  <span className="ca-ctx-item">{context.f || '—'} → {context.t || '—'}</span>
                  <span className="ca-ctx-sep">·</span>
                  <span className="ca-ctx-item">{context.sys || '—'}</span>
                  {context.l != null && <><span className="ca-ctx-sep">·</span><span className="ca-ctx-item">{context.l.toLocaleString()} m design</span></>}
                </div>
              )}
              {tagState === 'free' && (
                <div className="ca-ctx ca-ctx-free">⚠ 마스터 목록에 없는 태그 — 직접 입력으로 저장됩니다.</div>
              )}
            </div>
            <div className="ca-field ca-field-vendor">
              <label>Vendor (업체명)</label>
              <input className="ca-input" type="text" list="ca-vendors" placeholder="Subcontractor / 업체명"
                value={form.vendor} onChange={e => setField('vendor', e.target.value)} />
              <datalist id="ca-vendors">
                {loadVendors().filter(v => v.active).map(v => <option key={v.id} value={v.name} />)}
              </datalist>
            </div>
          </div>

          <div className="ca-grid">
            <div className="ca-block ca-block-pull">
              <div className="ca-block-head ca-head-pull">PULLING STATUS</div>
              <div className="ca-block-fields">
                <div className="ca-field">
                  <label>Pulled Length (m) <span className="ca-req">*</span></label>
                  <input className={ic('pulledLength')} type="text" inputMode="decimal" placeholder="e.g. 478"
                    value={form.pulledLength} onChange={e => setField('pulledLength', e.target.value)} />
                </div>
                <div className="ca-field">
                  <label>Used Drum <span className="ca-req">*</span></label>
                  <DrumInput value={form.usedDrum} onChange={v => setField('usedDrum', v)}
                    master={drumMaster} cat={context?.g} invalid={missing.has('usedDrum')} />
                </div>
                <div className="ca-field">
                  <label>Pulled By <span className="ca-req">*</span></label>
                  <input className={ic('pulledBy')} type="text" placeholder="Name / Crew"
                    value={form.pulledBy} onChange={e => setField('pulledBy', e.target.value)} />
                </div>
                <div className="ca-field">
                  <label>Pulling Date <span className="ca-req">*</span></label>
                  <input className={ic('pullingDate')} type="date" min={DATE_MIN} max={DATE_MAX}
                    value={form.pullingDate} onChange={e => setField('pullingDate', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="ca-block ca-block-term">
              <div className="ca-block-head ca-head-term">TERMINATION STATUS</div>
              <div className="ca-block-fields">
                <div className="ca-field">
                  <label>Termination Date (From)</label>
                  <input className={ic('termDateFrom')} type="date" min={DATE_MIN} max={DATE_MAX}
                    value={form.termDateFrom} onChange={e => setField('termDateFrom', e.target.value)} />
                </div>
                <div className="ca-field">
                  <label>Terminated By (From)</label>
                  <input className={ic('termByFrom')} type="text" placeholder="Name / Crew"
                    value={form.termByFrom} onChange={e => setField('termByFrom', e.target.value)} />
                </div>
                <div className="ca-field">
                  <label>Termination Date (To)</label>
                  <input className={ic('termDateTo')} type="date" min={DATE_MIN} max={DATE_MAX}
                    value={form.termDateTo} onChange={e => setField('termDateTo', e.target.value)} />
                </div>
                <div className="ca-field">
                  <label>Terminated By (To)</label>
                  <input className={ic('termByTo')} type="text" placeholder="Name / Crew"
                    value={form.termByTo} onChange={e => setField('termByTo', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="ca-block ca-block-check">
              <div className="ca-block-head ca-head-check">LINE CHECK / INSPECTION</div>
              <div className="ca-block-fields">
                <div className="ca-field">
                  <label>Line Check</label>
                  <select className="ca-input ca-select" value={form.lc} onChange={e => setField('lc', e.target.value)}>
                    {LC_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="ca-field">
                  <label>ACT No.</label>
                  <input className="ca-input" type="text" placeholder="e.g. ACT-2026-001"
                    value={form.act} onChange={e => setField('act', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="ca-actions">
            <button className="ca-btn ca-btn-save" onClick={save}>Save Record</button>
            <button className="ca-btn ca-btn-clear" onClick={clear}>Clear</button>
            {flash && <span className={`ca-flash ${flash.type === 'ok' ? 'ok' : 'err'}`}>{flash.msg}</span>}
          </div>
        </div>

        {/* ---- Records table ---- */}
        <div className="cs-toolbar ca-records-bar">
          <div className="cs-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" placeholder="Search recorded Cable Tag" value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="cs-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          <div className="cm-export-inline">
            <button className="cm-export-btn" onClick={exportExcel} disabled={records.length === 0}>
              <span className="cm-export-ico xls">XLS</span> Excel
            </button>
            <button className="cm-export-btn ca-btn-csv" onClick={exportCSV} disabled={records.length === 0}>
              <span className="cm-export-ico csv">CSV</span> CSV
            </button>
          </div>
        </div>

        <div className="cs-table-wrap">
          <table className="cs-table ca-table">
            <thead>
              <tr>
                <th>Cable Tag</th>
                <th>Cat.</th>
                <th>Vendor</th>
                <th className="ca-th-pull">Pulled Len(m)</th>
                <th className="ca-th-pull">Used Drum</th>
                <th className="ca-th-pull">Pulled By</th>
                <th className="ca-th-pull">Pulling Date</th>
                <th className="ca-th-term">Term Date (From)</th>
                <th className="ca-th-term">By (From)</th>
                <th className="ca-th-term">Term Date (To)</th>
                <th className="ca-th-term">By (To)</th>
                <th className="ca-th-check">Line Check</th>
                <th className="ca-th-check">ACT No.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const cc = CATEGORY_COLORS[r.cat] || { bg: '#f3f4f6', text: '#374151' }
                const lc = r.lc || 'Pending'
                const lcC = STATUS_COLORS[lc] || STATUS_COLORS['Pending']
                return (
                  <tr key={r.cno}>
                    <td className="cs-cable-no">{r.cno}</td>
                    <td>{r.cat ? <span className="cs-badge" style={{ background: cc.bg, color: cc.text }}>{r.cat}</span> : <span className="cm-muted">—</span>}</td>
                    <td>{r.vendor || '—'}</td>
                    <td className="num">{r.pulledLength || '—'}</td>
                    <td className="ca-mono">{r.usedDrum || '—'}</td>
                    <td>{r.pulledBy || '—'}</td>
                    <td className="ca-mono">{r.pullingDate || '—'}</td>
                    <td className="ca-mono">{r.termDateFrom || '—'}</td>
                    <td>{r.termByFrom || '—'}</td>
                    <td className="ca-mono">{r.termDateTo || '—'}</td>
                    <td>{r.termByTo || '—'}</td>
                    <td><span className="cs-badge" style={{ background: lcC.bg, color: lcC.text }}>{lc}</span></td>
                    <td className="ca-mono">{r.act || '—'}</td>
                    <td className="ca-row-actions">
                      <button className="ca-act ca-act-edit" title="Edit" onClick={() => editRecord(r.cno)}>Edit</button>
                      <button className="ca-act ca-act-del" title="Delete" onClick={() => removeRecord(r.cno)}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {records.length === 0 && <div className="cs-empty">No records yet. Enter a Cable Tag above and save.</div>}
        </div>

        <p className="cm-note">
          <strong>*</strong> 표시는 필수 입력입니다. 실적은 이 브라우저에 저장되며 <strong>Cable Schedule</strong>과 <strong>Dashboard</strong> 진행률에 반영됩니다 —
          Pulling Date 입력 시 Pulling <strong>Done</strong>, Termination Date(To) 입력 시 Termination <strong>Done</strong> (From만 = In Progress). 날짜는 2026-07 ~ 2028-12.
        </p>
      </div>
    </div>
  )
}
