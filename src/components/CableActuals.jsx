import { useState, useMemo, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { loadFieldData, fetchAllFieldData, updateFieldEntry, bulkUpsertFieldEntries, deleteFieldEntry, loadVendors } from '../lib/dataStore'
import { dataUrl } from '../lib/dataUrl'
import { stamp } from '../lib/format'
import { ambiguousDrumTag, canonDrum, sameDrum } from '../lib/drumTag'
import { t } from '../lib/i18n'

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
  if (!(tag || '').trim()) { miss.add('tag'); labels.push(t('Cable Tag')) }
  const PULL = [['pulledLength', t('Pulled Length')], ['usedDrum', t('Used Drum (Drum No.)')],
    ['pulledBy', t('Pulled By')], ['pullingDate', t('Pulling Date')]]
  const pullFilled = PULL.some(([k]) => String(form[k] || '').trim())
  if (pullFilled) for (const [k, l] of PULL) if (!String(form[k] || '').trim()) { miss.add(k); labels.push(l) }
  if (['termDateFrom', 'termByFrom'].some(k => String(form[k] || '').trim())) {
    if (!String(form.termDateFrom || '').trim()) { miss.add('termDateFrom'); labels.push(t('Termination Date (From)')) }
    if (!String(form.termByFrom || '').trim()) { miss.add('termByFrom'); labels.push(t('Terminated By (From)')) }
  }
  if (['termDateTo', 'termByTo'].some(k => String(form[k] || '').trim())) {
    if (!String(form.termDateTo || '').trim()) { miss.add('termDateTo'); labels.push(t('Termination Date (To)')) }
    if (!String(form.termByTo || '').trim()) { miss.add('termByTo'); labels.push(t('Terminated By (To)')) }
  }
  const anyPhase = pullFilled || ['termDateFrom', 'termByFrom', 'termDateTo', 'termByTo'].some(k => String(form[k] || '').trim())
  if ((tag || '').trim() && !anyPhase) labels.push(t('at least one Pulling or Termination entry'))
  return { ok: miss.size === 0 && labels.length === 0, miss, labels }
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
        placeholder={t('Type cable no. — e.g. B1-SWG-64601-P2001')}
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

// A tag that is not in the master is invisible to the Dashboard: rollupActuals()
// skips any cable it cannot find, so the record is stored yet never counted. Most of
// these are typos, so normalising away the usual slips finds the intended cable.
const normTag = t => (t || '').toUpperCase().replace(/[\s._-]/g, '')

// ---- Used Drum: a real dropdown, not free text ----
// Free-typing let the field carry a packing "Package No." (e.g. PGU-DE-439-PCC-046) instead
// of the drum tag design uses (e.g. PE-L1-3C4-09) — the two number a physical drum
// differently, and only the drum-tag form can be compared against the designed Drum No.
// Restricting entry to the master list is what actually closes that gap; a searchable
// combo would still accept anything typed.
function DrumInput({ value, onChange, master, cat, invalid, designDrum }) {
  const options = useMemo(() => {
    const pool = cat ? master.filter(d => d.cat === cat) : master
    const drums = pool.map(d => d.drum)
    // The designed drum must always be offered, even if its packing is not registered yet.
    if (designDrum) drums.push(designDrum)
    if (value && !drums.includes(value)) drums.push(value)
    return [...new Set(drums)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }, [master, cat, value, designDrum])

  // Typed entry with the list as suggestions, not a gate: a drum whose packing is not
  // registered yet still has to be enterable, or the record never gets made at all.
  return (
    <>
      <input
        className={`ca-input ca-mono-input${invalid ? ' ca-err' : ''}`}
        type="text"
        list="ca-drums"
        placeholder={t('Type a drum no. or pick from the list — e.g. PE-L1-3C4-09')}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        autoComplete="off"
      />
      <datalist id="ca-drums">
        {designDrum && <option value={designDrum}>{t('Design allocation')}</option>}
        {options.filter(d => d !== designDrum).map(d => <option key={d} value={d} />)}
      </datalist>
    </>
  )
}

export default function CableActuals({ session }) {
  const admin = session?.user?.user_metadata?.role === 'admin'
  const viewer = session?.user?.user_metadata?.role === 'viewer'
  const [master, setMaster] = useState([])
  const [masterMap, setMasterMap] = useState(new Map())
  const [drumMaster, setDrumMaster] = useState([])
  const [drumMap, setDrumMap] = useState({})
  const [drumCap, setDrumCap] = useState({})
  const [pkgDrum, setPkgDrum] = useState({})
  const [pkgNo, setPkgNo] = useState('')
  const [loading, setLoading] = useState(true)
  const [fieldData, setFieldData] = useState(loadFieldData)
  const [tag, setTag] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [missing, setMissing] = useState(new Set())
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [vendorFilter, setVendorFilter] = useState('')
  const [diffOnly, setDiffOnly] = useState(false)
  const [orphanOnly, setOrphanOnly] = useState(false)
  const [visibleCount, setVisibleCount] = useState(50)
  const [flash, setFlash] = useState(null)
  const [importMsg, setImportMsg] = useState(null)
  const importRef = useRef(null)

  // Bulk import vendor actuals from a JSON file. Existing fields on each cable are
  // preserved — only the keys present in the file are overwritten.
  //
  // The rows go up in chunks rather than one request each: a per-row loop over a few
  // hundred cables trips Supabase's rate limit partway through, which surfaced as
  // "160건 실패" on an import whose data was perfectly valid. Completion is judged by
  // re-reading from the server, since the local cache is written optimistically and
  // would still look successful if the request behind it never landed.
  async function handleImport(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const entries = parsed.entries || parsed
      const keys = Object.keys(entries)
      if (!keys.length) { setImportMsg(t('Empty file')); return }

      setImportMsg(`${t('Applying…')} 0/${keys.length}`)
      const failed = await bulkUpsertFieldEntries(
        keys.map(cno => ({ cno, patch: entries[cno] })),
        (n, total) => setImportMsg(`${t('Applying…')} ${n}/${total}`),
      )

      // Trust the server, not the optimistic cache: confirm every "success" actually landed
      // by re-reading and comparing field-by-field. A row can already exist for a cable from
      // an earlier entry — its mere presence doesn't prove *this* write's fields landed.
      setImportMsg(t('Verifying…'))
      await fetchAllFieldData()
      const server = loadFieldData()
      const fieldsMatch = (cno, patch) => {
        const row = server[cno]
        if (!row) return false
        return Object.entries(patch).every(([k, v]) => String(row[k] ?? '') === String(v ?? ''))
      }
      const unverified = keys.filter(cno => !failed.includes(cno) && !fieldsMatch(cno, entries[cno]))
      const stillMissing = [...failed, ...unverified]

      setFieldData(server)
      if (stillMissing.length) {
        console.error('[import] not confirmed on server:', stillMissing)
        setImportMsg(t('Done: {ok} applied, {bad} failed (listed in the console — import only the failed ones again)', { ok: keys.length - stillMissing.length, bad: stillMissing.length }))
      } else {
        setImportMsg(t('Done: all {n} confirmed on the server', { n: keys.length }))
      }
      setTimeout(() => setImportMsg(null), 12000)
    } catch (err) {
      setImportMsg(t('File error: ') + err.message)
    }
  }

  useEffect(() => {
    Promise.all([
      fetch(dataUrl('/cable-data.json')).then(r => r.json()),
      fetch(dataUrl('/cable-material.json')).then(r => r.json()).catch(() => []),
      fetch(dataUrl('/cable-drum-map.json')).then(r => r.json()).catch(() => ({})),
      fetch(dataUrl('/drum-capacity.json')).then(r => r.json()).catch(() => ({})),
      fetch(dataUrl('/packing-drum-map.json')).then(r => r.json()).catch(() => ({})),
    ]).then(([cables, materials, dmap, dcap, pmap]) => {
      setPkgDrum(pmap || {})
      setDrumMap(dmap || {})
      setDrumCap(dcap || {})
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
    if (viewer) return
    const cno = tag.trim()
    const { ok, miss, labels } = validate(tag, form)
    if (!ok) {
      setMissing(miss)
      setFlash({ type: 'err', msg: `${t('Fill in the required fields')} — ${labels.join(', ')}` })
      return
    }
    if (!masterMap.has(cno) && !window.confirm(
      [t('"{c}" is not in the cable master.', { c: cno }), '',
       t('It will be saved, but not counted in Dashboard progress.'),
       t('Please check the number again.'), '',
       t('Save anyway?')].join('\n'))) return
    updateFieldEntry(cno, { ...form })
    setMissing(new Set())
    setFlash({ type: 'ok', msg: `${t('Saved')} · ${cno}` })
    setTimeout(() => setFlash(null), 2800)
  }
  const clear = () => { setTag(''); setForm(EMPTY_FORM); setPkgNo(''); setMissing(new Set()); setFlash(null) }

  const editRecord = cno => {
    setTag(cno); setForm(pickForm(fieldData[cno])); setMissing(new Set()); setFlash(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const removeRecord = cno => {
    if (!window.confirm(t('Delete the record for {c}?', { c: cno }))) return
    deleteFieldEntry(cno)
    if (tag.trim() === cno) clear()
  }

  // Search / date / vendor narrow the working set; the mismatch and orphan toggles
  // pick from within it. Both the list and the badge counts read this same set, so
  // the number on a badge is always the number of rows clicking it produces.
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase()
    return Object.entries(fieldData)
      .filter(([, e]) => hasActuals(e))
      .filter(([cno]) => !q || cno.toLowerCase().includes(q))
      .filter(([, e]) => {
        if (!dateFrom && !dateTo) return true
        const dates = [e.pullingDate, e.termDateFrom, e.termDateTo].filter(Boolean)
        if (!dates.length) return false
        return dates.some(d => (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo))
      })
      .filter(([, e]) => !vendorFilter || (e.vendor || '') === vendorFilter)
      .map(([cno, e]) => {
        const design = drumMap[cno] || ''
        return {
          cno, ...e,
          cat: masterMap.get(cno)?.g || '',
          designDrum: design,
          // Only a drum that was actually entered can disagree with the design.
          drumDiff: !!(design && e.usedDrum && !sameDrum(e.usedDrum, design)),
          orphan: !masterMap.has(cno),
        }
      })
  }, [fieldData, search, masterMap, dateFrom, dateTo, vendorFilter, drumMap])

  const records = useMemo(() => scoped
    .filter(r => !diffOnly || r.drumDiff)
    .filter(r => !orphanOnly || r.orphan)
    .sort((a, b) => {
      const da = a.pullingDate || ''
      const db = b.pullingDate || ''
      if (da || db) return db.localeCompare(da) || a.cno.localeCompare(b.cno)
      return a.cno.localeCompare(b.cno)
    }), [scoped, diffOnly, orphanOnly])

  const diffCount = useMemo(() => scoped.filter(r => r.drumDiff).length, [scoped])
  const orphanCount = useMemo(() => scoped.filter(r => r.orphan).length, [scoped])

  const vendorList = useMemo(() => {
    const set = new Set()
    Object.values(fieldData).forEach(e => { if (hasActuals(e) && e.vendor) set.add(e.vendor) })
    return [...set].sort()
  }, [fieldData])

  const totalPulled = useMemo(() => records.reduce((s, r) => {
    const n = parseFloat(String(r.pulledLength ?? '').replace(/[^0-9.]/g, ''))
    return s + (isNaN(n) ? 0 : n)
  }, 0), [records])

  // Short drum tag that omits the packing number — resolves to one drum by guess only.
  // The drum design allocated to this cable. Field crews do sometimes pull from a
  // different drum, so a mismatch is surfaced as a warning and never blocks saving —
  // what matters is that it stops being invisible.
  const designDrum = tag ? (drumMap[tag.trim()] || '') : ''
  const drumMismatch = !!(designDrum && form.usedDrum && !sameDrum(form.usedDrum, designDrum))

  // Every drum is allocated to 99-100% of its capacity, so pulling past the reel is
  // not a rounding matter - it leaves the cables the drum was assigned to with nothing.
  // The current cable's own saved length is excluded so editing an entry never
  // double-counts it against the drum.
  const drumBudget = useMemo(() => {
    const drum = (form.usedDrum || '').trim()
    if (!drum) return null
    const key = canonDrum(drum).toUpperCase()
    const cap = Object.entries(drumCap).find(([k]) => k.toUpperCase() === key)?.[1]?.m
    if (cap == null) return { drum, cap: null }
    const me = tag.trim()
    let used = 0
    for (const [cno, e] of Object.entries(fieldData)) {
      if (cno === me) continue
      if (canonDrum((e?.usedDrum || '').trim()).toUpperCase() !== key) continue
      const v = parseFloat(String(e.pulledLength ?? '').replace(/[^0-9.]/g, ''))
      if (!isNaN(v)) used += v
    }
    const mine = parseFloat(String(form.pulledLength ?? '').replace(/[^0-9.]/g, ''))
    const entered = isNaN(mine) ? 0 : mine
    return { drum, cap, used, remaining: cap - used, after: cap - used - entered, entered }
  }, [form.usedDrum, form.pulledLength, fieldData, drumCap, tag])

  // The physical drum carries only the packing number, so the field writes that down
  // and someone converts it to a drum tag by hand — which is where PGU-DE-439-PCC-046
  // became PE-L1-3C4-15 instead of -09. Entering the packing number does the lookup.
  const pkgIndex = useMemo(() => {
    const m = new Map()
    for (const [k, v] of Object.entries(pkgDrum)) m.set(k.toUpperCase().replace(/\s/g, ''), v)
    return m
  }, [pkgDrum])
  const pkgLookup = useMemo(() => {
    const q = pkgNo.trim()
    if (!q) return null
    const hit = pkgIndex.get(q.toUpperCase().replace(/\s/g, ''))
    return hit ? { drum: hit } : { drum: null }
  }, [pkgNo, pkgIndex])

  const drumWarn = useMemo(
    () => ambiguousDrumTag(form.usedDrum, form.pullingDate),
    [form.usedDrum, form.pullingDate])

  const EXPORT_COLS = ['Cable Tag', 'Category', 'Vendor', 'Pulled Length(m)', 'Used Drum', 'Designed Drum', 'Drum Match', 'Pulled By',
    'Pulling Date', 'Term Date (From)', 'Terminated By (From)',
    'Term Date (To)', 'Terminated By (To)', 'Line Check', 'ACT No.']
  const buildRows = () => records.map(r => [
    r.cno, r.cat, r.vendor || '', r.pulledLength || '', r.usedDrum || '',
    r.designDrum || '', r.designDrum ? (r.drumDiff ? 'MISMATCH' : 'OK') : '',
    r.pulledBy || '',
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

  const tagTrim = tag.trim()
  // Cables whose number differs from what was typed only by spacing or punctuation.
  // Must sit above the loading return — a hook after a conditional return runs on some
  // renders and not others, which is what crashed the page.
  const tagSuggest = useMemo(() => {
    if (!tagTrim || context) return []
    const key = normTag(tagTrim)
    if (key.length < 4) return []
    return master.filter(c => normTag(c.n) === key).map(c => c.n).slice(0, 5)
  }, [tagTrim, context, master])

  if (loading) {
    return (
      <div className="cs-page"><div className="cs-body">
        <div className="page-header"><h2>{t('Work Log')}</h2></div>
        <div className="cs-loading">{t('Loading data…')}</div>
      </div></div>
    )
  }

  const tagState = !tagTrim ? null : (context ? 'in' : 'free')

  return (
    <div className="cs-page">
      <div className="cs-body">
        <div className="page-header">
          <div className="cm-header-left">
            <h2>{t('Work Log')}</h2>
            <div className="cm-subtitle">{t('Field Records')}</div>
          </div>
          <div className="cs-header-stats">
            <span className="cs-meters">{Math.round(totalPulled).toLocaleString()}<span className="cs-meters-unit"> m {t('pulled')}</span></span>
            <span className="cs-total">{t('{n} lines', { n: records.length })}</span>
          </div>
        </div>

        {/* ---- Entry form ---- */}
        {viewer && (
          <div className="ca-viewer-notice">👁 {t('View Only — you can browse and export records, but not add or edit them.')}</div>
        )}
        {!viewer && (
        <div className="ca-form">
          <div className="ca-top-row">
            <div className="ca-field ca-field-tag">
              <label>{t('Cable Tag')} <span className="ca-req">*</span></label>
              <CableTagInput value={tag} onChange={onTagChange} onPick={pickCable} master={master} invalid={missing.has('tag')} />
              {tagState === 'in' && context && (
                <div className="ca-ctx ca-ctx-in">
                  <span className="cs-badge" style={{ ...(CATEGORY_COLORS[context.g] || { bg: '#eee', text: '#333' }) }}>{context.g}</span>
                  <span className="ca-ctx-item">{context.s || '—'}</span>
                  <span className="ca-ctx-sep">·</span>
                  <span className="ca-ctx-item">{context.f || '—'} → {context.t || '—'}</span>
                  <span className="ca-ctx-sep">·</span>
                  <span className="ca-ctx-item">{context.sys || '—'}</span>
                  {context.l != null && <><span className="ca-ctx-sep">·</span><span className="ca-ctx-item">{context.l.toLocaleString()} m {t('design')}</span></>}
                </div>
              )}
              {tagState === 'free' && (
                <div className="ca-ctx ca-tag-unknown">
                  <div className="ca-tag-unknown-top">
                    ⚠ {t('Not in the cable master.')}
                  </div>
                  <div className="ca-tag-unknown-why">
                    {t('It will be saved, but not counted in Dashboard progress.')} {t('Please check the number again.')}
                  </div>
                  {tagSuggest.length > 0 && (
                    <div className="ca-drum-warn-fix">
                      {t('Did you mean:')}
                      {tagSuggest.map(n => (
                        <button type="button" key={n} className="ca-drum-warn-pick"
                          onClick={() => { setTag(n); setForm(pickForm(fieldData[n])); clearErr() }}>{n}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="ca-field ca-field-vendor">
              <label>{t('Vendor')}</label>
              <input className="ca-input" type="text" list="ca-vendors" placeholder={t('Subcontractor')}
                value={form.vendor} onChange={e => setField('vendor', e.target.value)} />
              <datalist id="ca-vendors">
                {loadVendors().filter(v => v.active).map(v => <option key={v.id} value={v.name} />)}
              </datalist>
            </div>
          </div>

          <div className="ca-grid">
            <div className="ca-block ca-block-pull">
              <div className="ca-block-head ca-head-pull">{t('PULLING STATUS')}</div>
              <div className="ca-block-fields">
                <div className="ca-field">
                  <label>{t('Pulled Length (m)')} <span className="ca-req">*</span></label>
                  <input className={ic('pulledLength')} type="text" inputMode="decimal" placeholder={t('e.g. 478')}
                    value={form.pulledLength} onChange={e => setField('pulledLength', e.target.value)} />
                </div>
                <div className="ca-field">
                  <label>{t('Packing No.')} <span className="ca-opt">({t('number written on the drum')})</span></label>
                  <input className="ca-input ca-mono-input" type="text" list="ca-pkgs"
                    placeholder={t('e.g. PGU-DE-439-PCC-046')}
                    value={pkgNo} onChange={e => setPkgNo(e.target.value)} autoComplete="off" />
                  <datalist id="ca-pkgs">
                    {Object.keys(pkgDrum).slice(0, 1000).map(p => <option key={p} value={p} />)}
                  </datalist>
                  {pkgLookup && (pkgLookup.drum ? (
                    <div className="ca-ctx ca-pkg-hit">
                      → {t('Drum')} <strong>{pkgLookup.drum}</strong>
                      {form.usedDrum === pkgLookup.drum ? (
                        <span className="ca-pkg-ok">{t('Filled into Used Drum')}</span>
                      ) : (
                        <button type="button" className="ca-drum-warn-pick"
                          onClick={() => setField('usedDrum', pkgLookup.drum)}>
                          {t('Put into Used Drum')}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="ca-ctx ca-pkg-miss">
                      {t('Packing number not found. Check the number, or enter the drum number directly.')}
                    </div>
                  ))}
                </div>
                <div className="ca-field">
                  <label>{t('Used Drum')} <span className="ca-req">*</span></label>
                  <DrumInput value={form.usedDrum} onChange={v => setField('usedDrum', v)}
                    master={drumMaster} cat={context?.g} invalid={missing.has('usedDrum')}
                    designDrum={designDrum} />
                  {designDrum && !form.usedDrum && (
                    <div className="ca-ctx ca-ctx-design">
                      {t('Designed drum:')} <strong>{designDrum}</strong>
                    </div>
                  )}
                  {drumBudget && drumBudget.cap != null && (
                    drumBudget.after < 0 ? (
                      <div className="ca-ctx ca-drum-over">
                        &#9888; {t('Exceeds the drum — {rem} m left on the drum but {ent} m entered ({over} m over).', { rem: Math.round(drumBudget.remaining).toLocaleString(), ent: Math.round(drumBudget.entered).toLocaleString(), over: Math.round(-drumBudget.after).toLocaleString() })}
                        <div className="ca-drum-over-sub">
                          {t('Check the drum number or pulled length. If it really was exceeded, you can save as is.')}
                        </div>
                      </div>
                    ) : (
                      <div className={`ca-ctx ca-drum-budget${drumBudget.after < drumBudget.cap * 0.05 ? ' low' : ''}`}>
                        {t('Drum')} {drumBudget.drum} · {t('capacity')} {Math.round(drumBudget.cap).toLocaleString()} m ·
                        {t('used')} {Math.round(drumBudget.used).toLocaleString()} m ·
                        <strong> {t('remaining')} {Math.round(drumBudget.after).toLocaleString()} m</strong>
                        {drumBudget.entered > 0 && ` (${t('including this entry')})`}
                      </div>
                    )
                  )}
                  {drumMismatch && (
                    <div className="ca-ctx ca-drum-diff">
                      ⚠ {t('Differs from the designed drum')} <strong>{designDrum}</strong>.
                      {t('Check that this is the drum actually used.')}
                      <div className="ca-drum-warn-fix">
                        <button type="button" className="ca-drum-warn-pick"
                          onClick={() => setField('usedDrum', designDrum)}>
                          {t('Use designed drum')} ({designDrum})
                        </button>
                        <span className="ca-drum-diff-keep">
                          {t('If a different drum was really used, you can save as is.')}
                        </span>
                      </div>
                    </div>
                  )}
                  {drumWarn && (
                    <div className="ca-ctx ca-ctx-free ca-drum-warn">
                      ⚠ {t('Packing no. missing — this will be counted as')} <strong>{drumWarn.assumed}</strong>.
                      {t('PoCable drum {n} exists in both packings.', { n: drumWarn.no })}
                      <div className="ca-drum-warn-fix">
                        {t('Select the drum you actually used:')}
                        {drumWarn.candidates.map(c => (
                          <button type="button" key={c} className="ca-drum-warn-pick"
                            onClick={() => setField('usedDrum', c)}>{c}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="ca-field">
                  <label>{t('Pulled By')} <span className="ca-req">*</span></label>
                  <input className={ic('pulledBy')} type="text" placeholder={t('Name / Crew')}
                    value={form.pulledBy} onChange={e => setField('pulledBy', e.target.value)} />
                </div>
                <div className="ca-field">
                  <label>{t('Pulling Date')} <span className="ca-req">*</span></label>
                  <input className={ic('pullingDate')} type="date" min={DATE_MIN} max={DATE_MAX}
                    value={form.pullingDate} onChange={e => setField('pullingDate', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="ca-block ca-block-term">
              <div className="ca-block-head ca-head-term">{t('TERMINATION STATUS')}</div>
              <div className="ca-block-fields">
                <div className="ca-field">
                  <label>{t('Termination Date (From)')}</label>
                  <input className={ic('termDateFrom')} type="date" min={DATE_MIN} max={DATE_MAX}
                    value={form.termDateFrom} onChange={e => setField('termDateFrom', e.target.value)} />
                </div>
                <div className="ca-field">
                  <label>{t('Terminated By (From)')}</label>
                  <input className={ic('termByFrom')} type="text" placeholder={t('Name / Crew')}
                    value={form.termByFrom} onChange={e => setField('termByFrom', e.target.value)} />
                </div>
                <div className="ca-field">
                  <label>{t('Termination Date (To)')}</label>
                  <input className={ic('termDateTo')} type="date" min={DATE_MIN} max={DATE_MAX}
                    value={form.termDateTo} onChange={e => setField('termDateTo', e.target.value)} />
                </div>
                <div className="ca-field">
                  <label>{t('Terminated By (To)')}</label>
                  <input className={ic('termByTo')} type="text" placeholder={t('Name / Crew')}
                    value={form.termByTo} onChange={e => setField('termByTo', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="ca-block ca-block-check">
              <div className="ca-block-head ca-head-check">{t('LINE CHECK / INSPECTION')}</div>
              <div className="ca-block-fields">
                <div className="ca-field">
                  <label>{t('Line Check')}</label>
                  <select className="ca-input ca-select" value={form.lc} onChange={e => setField('lc', e.target.value)}>
                    {LC_OPTIONS.map(o => <option key={o} value={o}>{t(o)}</option>)}
                  </select>
                </div>
                <div className="ca-field">
                  <label>{t('ACT No.')}</label>
                  <input className="ca-input" type="text" placeholder={t('e.g. ACT-2026-001')}
                    value={form.act} onChange={e => setField('act', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="ca-actions">
            <button className="ca-btn ca-btn-save" onClick={save}>{t('Save Record')}</button>
            <button className="ca-btn ca-btn-clear" onClick={clear}>{t('Clear')}</button>
            {flash && <span className={`ca-flash ${flash.type === 'ok' ? 'ok' : 'err'}`}>{flash.msg}</span>}
          </div>
        </div>
        )}

        {/* ---- Records table ---- */}
        <div className="cs-toolbar ca-records-bar">
          <div className="cs-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="text" placeholder={t('Search recorded Cable Tag')} value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(50) }} />
            {search && <button className="cs-clear" onClick={() => setSearch('')}>✕</button>}
          </div>
          <div className="ca-date-range">
            <span className="ca-dr-label">{t('Date')}</span>
            <input type="date" className={`ca-dr-input${dateFrom ? ' active' : ''}`} title={t('Start date')} min={DATE_MIN} max={dateTo || DATE_MAX} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            <span className="ca-dr-sep">–</span>
            <input type="date" className={`ca-dr-input${dateTo ? ' active' : ''}`} title={t('End date')} min={dateFrom || DATE_MIN} max={DATE_MAX} value={dateTo} onChange={e => setDateTo(e.target.value)} />
            {(dateFrom || dateTo) && (
              <button className="ca-dr-clear" title={t('Clear date filter')} onClick={() => { setDateFrom(''); setDateTo('') }}>✕</button>
            )}
          </div>
          {vendorList.length > 0 && (
            <div className="ca-date-range" style={{ gap: 4 }}>
              <span className="ca-dr-label">{t('Vendor')}</span>
              <select
                className={`ca-dr-input${vendorFilter ? ' active' : ''}`}
                style={{ minWidth: 120, cursor: 'pointer' }}
                value={vendorFilter}
                onChange={e => { setVendorFilter(e.target.value); setVisibleCount(50) }}
              >
                <option value="">{t('All')}</option>
                {vendorList.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              {vendorFilter && (
                <button className="ca-dr-clear" title={t('Clear vendor filter')} onClick={() => setVendorFilter('')}>✕</button>
              )}
            </div>
          )}
          <button
            type="button"
            className={`ca-diff-toggle ca-orphan-toggle${orphanOnly ? ' on' : ''}`}
            title={t('Show only records whose number is not in the cable master — they are left out of the Dashboard')}
            onClick={() => { setOrphanOnly(v => !v); setVisibleCount(50) }}
          >
            ⛔ {t('Not in master')}
            <span className="ca-diff-count">{orphanCount}</span>
          </button>
          <button
            type="button"
            className={`ca-diff-toggle${diffOnly ? ' on' : ''}`}
            title={t('Show only records whose drum differs from the design')}
            onClick={() => { setDiffOnly(v => !v); setVisibleCount(50) }}
          >
            ⚠ {t('Drum mismatch')}
            <span className="ca-diff-count">{diffCount}</span>
          </button>
          <div className="cm-export-inline">
            <button className="cm-export-btn" onClick={exportExcel} disabled={records.length === 0}>
              <span className="cm-export-ico xls">XLS</span> Excel
            </button>
            <button className="cm-export-btn ca-btn-csv" onClick={exportCSV} disabled={records.length === 0}>
              <span className="cm-export-ico csv">CSV</span> CSV
            </button>
            {admin && (
              <>
                <input ref={importRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />
                <button className="cm-export-btn" style={{ background: '#0d9488', borderColor: '#0d9488' }} onClick={() => importRef.current?.click()} title={t('Bulk import vendor records from JSON (existing records kept)')}>
                  {t('Import records')}
                </button>
              </>
            )}
            {importMsg && <span style={{ fontSize: 12, color: 'var(--ink-secondary)', alignSelf: 'center', whiteSpace: 'nowrap' }}>{importMsg}</span>}
          </div>
        </div>

        <div className="cs-table-wrap">
          <table className="cs-table ca-table">
            <thead>
              <tr>
                <th>{t('Cable Tag')}</th>
                <th>{t('Cat.')}</th>
                <th>{t('Vendor')}</th>
                <th className="ca-th-pull">{t('Pulled Len (m)')}</th>
                <th className="ca-th-pull">{t('Used Drum')}</th>
                <th className="ca-th-pull">{t('Pulled By')}</th>
                <th className="ca-th-pull">{t('Pulling Date')}</th>
                <th className="ca-th-term">{t('Term Date (From)')}</th>
                <th className="ca-th-term">{t('By (From)')}</th>
                <th className="ca-th-term">{t('Term Date (To)')}</th>
                <th className="ca-th-term">{t('By (To)')}</th>
                <th className="ca-th-check">{t('Line Check')}</th>
                <th className="ca-th-check">{t('ACT No.')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, visibleCount).map(r => {
                const cc = CATEGORY_COLORS[r.cat] || { bg: '#f3f4f6', text: '#374151' }
                const lc = r.lc || 'Pending'
                const lcC = STATUS_COLORS[lc] || STATUS_COLORS['Pending']
                return (
                  <tr key={r.cno}>
                    <td className="cs-cable-no">
                      {r.cno}
                      {r.orphan && <span className="ca-orphan-flag" title={t('Not in the cable master — left out of the Dashboard')}>{t('not in master')}</span>}
                    </td>
                    <td>{r.cat ? <span className="cs-badge" style={{ background: cc.bg, color: cc.text }}>{t(r.cat)}</span> : <span className="cm-muted">—</span>}</td>
                    <td>{r.vendor || '—'}</td>
                    <td className="num">{r.pulledLength || '—'}</td>
                    <td className="ca-mono">
                      {r.usedDrum || '—'}
                      {r.drumDiff && (
                        <span className="ca-drum-flag" title={`${t('Designed drum:')} ${r.designDrum}`}>
                          ≠ {r.designDrum}
                        </span>
                      )}
                    </td>
                    <td>{r.pulledBy || '—'}</td>
                    <td className="ca-mono">{r.pullingDate || '—'}</td>
                    <td className="ca-mono">{r.termDateFrom || '—'}</td>
                    <td>{r.termByFrom || '—'}</td>
                    <td className="ca-mono">{r.termDateTo || '—'}</td>
                    <td>{r.termByTo || '—'}</td>
                    <td><span className="cs-badge" style={{ background: lcC.bg, color: lcC.text }}>{t(lc)}</span></td>
                    <td className="ca-mono">{r.act || '—'}</td>
                    <td className="ca-row-actions">
                      {!viewer && <button className="ca-act ca-act-edit" title={t('Edit')} onClick={() => editRecord(r.cno)}>{t('Edit')}</button>}
                      {admin && <button className="ca-act ca-act-del" title={t('Delete (admin)')} onClick={() => removeRecord(r.cno)}>✕</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {records.length === 0 && <div className="cs-empty">{t('No records yet. Enter a Cable Tag above and save.')}</div>}
          {records.length > visibleCount && (
            <button className="ca-btn ca-btn-more" onClick={() => setVisibleCount(v => v + 50)}
              style={{ display: 'block', margin: '12px auto', padding: '6px 24px', cursor: 'pointer', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--ink-secondary)', fontSize: 13 }}>
              {t('Show more')} ({visibleCount} / {records.length})
            </button>
          )}
        </div>

        <p className="cm-note">
          {t('WORKLOG_NOTE')}
        </p>
      </div>
    </div>
  )
}
