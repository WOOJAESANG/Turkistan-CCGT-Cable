import { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { loadFieldData, loadDaily, saveDailyEntry, deleteDailyEntry, loadVendors } from '../lib/dataStore'
import { stamp, num } from '../lib/format'
import { t } from '../lib/i18n'

const DATE_MIN = '2026-07-01'
const DATE_MAX = '2028-12-31'
const NO_VENDOR = '(미지정)'

const EMPTY = { date: '', vendor: '', pullManpower: '', termManpower: '' }

export default function DailyReport({ session }) {
  const admin = session?.user?.user_metadata?.role === 'admin'
  const viewer = session?.user?.user_metadata?.role === 'viewer'
  const [fieldData, setFieldData] = useState(loadFieldData)
  const [daily, setDaily] = useState(loadDaily)
  const [form, setForm] = useState(EMPTY)
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    const h = () => { setFieldData(loadFieldData()); setDaily(loadDaily()) }
    window.addEventListener('cable-field-update', h)
    window.addEventListener('cable-daily-update', h)
    return () => {
      window.removeEventListener('cable-field-update', h)
      window.removeEventListener('cable-daily-update', h)
    }
  }, [])

  // distinct vendors — master list (active) + auto-discovered from records
  const vendors = useMemo(() => {
    const s = new Set()
    for (const v of loadVendors()) if (v.active) s.add(v.name)
    for (const e of Object.values(fieldData)) if (e.vendor && e.vendor.trim()) s.add(e.vendor.trim())
    for (const m of Object.values(daily)) if (m.vendor && m.vendor !== NO_VENDOR) s.add(m.vendor)
    return [...s].sort()
  }, [fieldData, daily])

  // Build Date × Vendor summary by joining cable actuals + daily manpower
  const summary = useMemo(() => {
    const b = {}
    const ensure = (date, vendor) => {
      const k = `${date}|${vendor}`
      return b[k] || (b[k] = { key: k, date, vendor, pullCables: 0, pullLength: 0, termPoints: 0, pullMan: '', termMan: '' })
    }
    for (const e of Object.values(fieldData)) {
      const vendor = (e.vendor || '').trim() || NO_VENDOR
      if (e.pullingDate) { const r = ensure(e.pullingDate, vendor); r.pullCables += 1; r.pullLength += num(e.pulledLength) }
      if (e.termDateFrom) ensure(e.termDateFrom, vendor).termPoints += 1
      if (e.termDateTo) ensure(e.termDateTo, vendor).termPoints += 1
    }
    for (const m of Object.values(daily)) {
      const r = ensure(m.date, m.vendor)
      r.pullMan = m.pullManpower ?? ''
      r.termMan = m.termManpower ?? ''
    }
    return Object.values(b).sort((a, c) => (c.date.localeCompare(a.date)) || a.vendor.localeCompare(c.vendor))
  }, [fieldData, daily])

  const setField = (k, v) => { setForm(f => ({ ...f, [k]: v })); if (flash?.type === 'err') setFlash(null) }

  const save = () => {
    if (viewer) return
    const date = form.date.trim(); const vendor = form.vendor.trim()
    if (!date || !vendor) { setFlash({ type: 'err', msg: t('Fill in the required fields — Date, Vendor') }); return }
    saveDailyEntry(date, vendor, { pullManpower: form.pullManpower.trim(), termManpower: form.termManpower.trim() })
    setFlash({ type: 'ok', msg: `${t('Saved')} · ${date} · ${vendor}` })
    setTimeout(() => setFlash(null), 2600)
  }
  const clear = () => { setForm(EMPTY); setFlash(null) }
  const editRow = r => {
    setForm({ date: r.date, vendor: r.vendor, pullManpower: String(r.pullMan ?? ''), termManpower: String(r.termMan ?? '') })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const removeRow = r => {
    if (!window.confirm(t('Delete the manpower record for {d} · {v}? (Cable records are kept)', { d: r.date, v: r.vendor }))) return
    deleteDailyEntry(r.key)
  }

  const fmt = n => n ? Math.round(n).toLocaleString() : '0'
  const prod = (val, man) => { const m = num(man); return m > 0 ? (val / m) : null }

  const EXPORT_COLS = ['Date', 'Vendor', 'Pull Cables', 'Pull Length(m)', 'Pull Manpower', 'm / person',
    'Term Points', 'Term Manpower', 'P / person']
  const buildRows = () => summary.map(r => {
    const pp = prod(r.pullLength, r.pullMan); const tp = prod(r.termPoints, r.termMan)
    return [r.date, r.vendor, r.pullCables, Math.round(r.pullLength), r.pullMan || '',
      pp != null ? Math.round(pp) : '', r.termPoints, r.termMan || '', tp != null ? Math.round(tp * 10) / 10 : '']
  })
  const exportExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([EXPORT_COLS, ...buildRows()])
    ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 11 }, { wch: 14 }, { wch: 13 }, { wch: 11 }, { wch: 11 }, { wch: 13 }, { wch: 11 }]
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: EXPORT_COLS.length - 1, r: summary.length } }) }
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Daily Report')
    XLSX.writeFile(wb, `Cable Daily Report_${stamp()}.xlsx`)
  }

  return (
    <div className="cs-page">
      <div className="cs-body">
        <div className="page-header">
          <div className="cm-header-left">
            <h2>{t('Daily Report')}</h2>
            <div className="cm-subtitle">{t('Crews · Productivity')}</div>
          </div>
          <span className="cs-total">{t('{n} day-vendor rows', { n: summary.length })}</span>
        </div>

        {/* ---- Daily manpower entry (once per day per vendor) ---- */}
        {viewer && (
          <div className="ca-viewer-notice">👁 {t('View Only — you can browse and export records, but not add or edit them.')}</div>
        )}
        {!viewer && (
        <div className="ca-form dr-form">
          <div className="dr-entry-grid">
            <div className="ca-field">
              <label>{t('Date')} <span className="ca-req">*</span></label>
              <input className="ca-input" type="date" min={DATE_MIN} max={DATE_MAX}
                value={form.date} onChange={e => setField('date', e.target.value)} />
            </div>
            <div className="ca-field">
              <label>{t('Vendor')} <span className="ca-req">*</span></label>
              <input className="ca-input" type="text" list="dr-vendors" placeholder={t('Vendor name')}
                value={form.vendor} onChange={e => setField('vendor', e.target.value)} />
              <datalist id="dr-vendors">{vendors.map(v => <option key={v} value={v} />)}</datalist>
            </div>
            <div className="ca-field">
              <label>{t('Pulling Manpower')}</label>
              <input className="ca-input" type="text" inputMode="numeric" placeholder={t('persons')}
                value={form.pullManpower} onChange={e => setField('pullManpower', e.target.value)} />
            </div>
            <div className="ca-field">
              <label>{t('Termination Manpower')}</label>
              <input className="ca-input" type="text" inputMode="numeric" placeholder={t('persons')}
                value={form.termManpower} onChange={e => setField('termManpower', e.target.value)} />
            </div>
          </div>
          <div className="ca-actions">
            <button className="ca-btn ca-btn-save" onClick={save}>{t('Save Manpower')}</button>
            <button className="ca-btn ca-btn-clear" onClick={clear}>{t('Clear')}</button>
            {flash && <span className={`ca-flash ${flash.type === 'ok' ? 'ok' : 'err'}`}>{flash.msg}</span>}
          </div>
        </div>
        )}

        {/* ---- Daily summary (auto) ---- */}
        <div className="cs-toolbar ca-records-bar">
          <span className="dr-hint">{t('Pulled length and points are summed from cable records; enter manpower above → productivity per person is calculated')}</span>
          <div className="cm-export-inline">
            <button className="cm-export-btn" onClick={exportExcel} disabled={summary.length === 0}>
              <span className="cm-export-ico xls">XLS</span> Excel
            </button>
          </div>
        </div>

        <div className="cs-table-wrap">
          <table className="cs-table ca-table dr-table">
            <thead>
              <tr>
                <th>{t('Date')}</th>
                <th>{t('Vendor')}</th>
                <th className="ca-th-pull">{t('Pull Cables')}</th>
                <th className="ca-th-pull">{t('Pull Length (m)')}</th>
                <th className="ca-th-pull">{t('Pull Manpower')}</th>
                <th className="ca-th-pull">{t('m / person')}</th>
                <th className="ca-th-term">{t('Term Points')}</th>
                <th className="ca-th-term">{t('Term Manpower')}</th>
                <th className="ca-th-term">{t('pts / person')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {summary.map(r => {
                const pp = prod(r.pullLength, r.pullMan)
                const tp = prod(r.termPoints, r.termMan)
                return (
                  <tr key={r.key}>
                    <td className="ca-mono">{r.date}</td>
                    <td className="dr-vendor">{t(r.vendor)}</td>
                    <td className="num">{r.pullCables || '—'}</td>
                    <td className="num">{r.pullLength ? fmt(r.pullLength) : '—'}</td>
                    <td className="num">{r.pullMan || <span className="dr-need">{t('Enter')}</span>}</td>
                    <td className="num dr-prod">{pp != null ? fmt(pp) : '—'}</td>
                    <td className="num">{r.termPoints || '—'}</td>
                    <td className="num">{r.termMan || <span className="dr-need">{t('Enter')}</span>}</td>
                    <td className="num dr-prod">{tp != null ? (Math.round(tp * 10) / 10) : '—'}</td>
                    <td className="ca-row-actions">
                      {!viewer && <button className="ca-act ca-act-edit" onClick={() => editRow(r)}>{t('Edit')}</button>}
                      {admin && <button className="ca-act ca-act-del" title={t('Delete (admin)')} onClick={() => removeRow(r)}>✕</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {summary.length === 0 && <div className="cs-empty">{t('No data yet. Enter cable records, or register daily manpower above.')}</div>}
        </div>

        <p className="cm-note">
          {t('Manpower is registered once a day per vendor (not per cable). Saving the same Date and Vendor again updates it. Pulled length and termination points are summed automatically from Work Log by date and vendor and shown as productivity per person (m/person, pts/person).')}
        </p>
      </div>
    </div>
  )
}
