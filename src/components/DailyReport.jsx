import { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { loadFieldData, loadDaily, saveDailyEntry, deleteDailyEntry, loadVendors } from '../lib/dataStore'

const DATE_MIN = '2026-07-01'
const DATE_MAX = '2028-12-31'
const NO_VENDOR = '(미지정)'

const num = v => { const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n }
function stamp() {
  const d = new Date(); const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const EMPTY = { date: '', vendor: '', pullManpower: '', termManpower: '' }

export default function DailyReport() {
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
    const date = form.date.trim(); const vendor = form.vendor.trim()
    if (!date || !vendor) { setFlash({ type: 'err', msg: '필수 항목을 입력하세요 — Date, Vendor' }); return }
    saveDailyEntry(date, vendor, { pullManpower: form.pullManpower.trim(), termManpower: form.termManpower.trim() })
    setFlash({ type: 'ok', msg: `저장 완료 · ${date} · ${vendor}` })
    setTimeout(() => setFlash(null), 2600)
  }
  const clear = () => { setForm(EMPTY); setFlash(null) }
  const editRow = r => {
    setForm({ date: r.date, vendor: r.vendor, pullManpower: String(r.pullMan ?? ''), termManpower: String(r.termMan ?? '') })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const removeRow = r => {
    if (!window.confirm(`${r.date} · ${r.vendor} 인원 기록을 삭제할까요? (케이블 실적은 유지됩니다)`)) return
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
            <h2>Daily Report</h2>
            <div className="cm-subtitle">작업조 · 생산성</div>
          </div>
          <span className="cs-total">{summary.length} day-vendor rows</span>
        </div>

        {/* ---- Daily manpower entry (once per day per vendor) ---- */}
        <div className="ca-form dr-form">
          <div className="dr-entry-grid">
            <div className="ca-field">
              <label>Date <span className="ca-req">*</span></label>
              <input className="ca-input" type="date" min={DATE_MIN} max={DATE_MAX}
                value={form.date} onChange={e => setField('date', e.target.value)} />
            </div>
            <div className="ca-field">
              <label>Vendor (업체명) <span className="ca-req">*</span></label>
              <input className="ca-input" type="text" list="dr-vendors" placeholder="업체명"
                value={form.vendor} onChange={e => setField('vendor', e.target.value)} />
              <datalist id="dr-vendors">{vendors.map(v => <option key={v} value={v} />)}</datalist>
            </div>
            <div className="ca-field">
              <label>Pulling Manpower (인원)</label>
              <input className="ca-input" type="text" inputMode="numeric" placeholder="명"
                value={form.pullManpower} onChange={e => setField('pullManpower', e.target.value)} />
            </div>
            <div className="ca-field">
              <label>Termination Manpower (인원)</label>
              <input className="ca-input" type="text" inputMode="numeric" placeholder="명"
                value={form.termManpower} onChange={e => setField('termManpower', e.target.value)} />
            </div>
          </div>
          <div className="ca-actions">
            <button className="ca-btn ca-btn-save" onClick={save}>Save Manpower</button>
            <button className="ca-btn ca-btn-clear" onClick={clear}>Clear</button>
            {flash && <span className={`ca-flash ${flash.type === 'ok' ? 'ok' : 'err'}`}>{flash.msg}</span>}
          </div>
        </div>

        {/* ---- Daily summary (auto) ---- */}
        <div className="cs-toolbar ca-records-bar">
          <span className="dr-hint">풀링 길이·포인트는 케이블 실적에서 자동 합산, 인원은 위에서 입력 → 인당 생산성 자동 계산</span>
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
                <th>Date</th>
                <th>Vendor</th>
                <th className="ca-th-pull">Pull Cables</th>
                <th className="ca-th-pull">Pull Length(m)</th>
                <th className="ca-th-pull">Pull 인원</th>
                <th className="ca-th-pull">m / 인</th>
                <th className="ca-th-term">Term Points</th>
                <th className="ca-th-term">Term 인원</th>
                <th className="ca-th-term">P / 인</th>
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
                    <td className="dr-vendor">{r.vendor}</td>
                    <td className="num">{r.pullCables || '—'}</td>
                    <td className="num">{r.pullLength ? fmt(r.pullLength) : '—'}</td>
                    <td className="num">{r.pullMan || <span className="dr-need">입력</span>}</td>
                    <td className="num dr-prod">{pp != null ? fmt(pp) : '—'}</td>
                    <td className="num">{r.termPoints || '—'}</td>
                    <td className="num">{r.termMan || <span className="dr-need">입력</span>}</td>
                    <td className="num dr-prod">{tp != null ? (Math.round(tp * 10) / 10) : '—'}</td>
                    <td className="ca-row-actions">
                      <button className="ca-act ca-act-edit" onClick={() => editRow(r)}>Edit</button>
                      <button className="ca-act ca-act-del" onClick={() => removeRow(r)}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {summary.length === 0 && <div className="cs-empty">아직 데이터가 없습니다. 케이블 실적을 입력하거나 위에서 일자별 인원을 등록하세요.</div>}
        </div>

        <p className="cm-note">
          인원은 <strong>하루 한 번, 업체별로</strong> 등록합니다 (케이블마다 입력하지 않음). 같은 Date·Vendor를 다시 저장하면 갱신됩니다.
          풀링 길이/터미네이션 포인트는 Cable Actuals에 입력된 날짜·업체 기준으로 자동 집계되어 <strong>인당 생산성(m/인, P/인)</strong>으로 표시됩니다.
        </p>
      </div>
    </div>
  )
}
