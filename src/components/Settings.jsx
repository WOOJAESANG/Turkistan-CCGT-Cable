import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import {
  loadVendors, fetchAllVendors, addVendor, updateVendor, deleteVendor,
  fetchRecentActivity, fetchAllForExport,
} from '../lib/dataStore'

const TABS = [
  { id: 'password', label: 'Change Password' },
  { id: 'vendors',  label: 'Vendors' },
  { id: 'export',   label: 'Data Export' },
  { id: 'activity', label: 'Activity Log' },
]

function stamp() {
  const d = new Date(); const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// -------------------- Change Password --------------------
function PasswordTab({ session }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null)

  const submit = async e => {
    e.preventDefault()
    if (pw.length < 6) { setFlash({ type: 'err', msg: '비밀번호는 6자 이상이어야 합니다.' }); return }
    if (pw !== pw2)  { setFlash({ type: 'err', msg: '비밀번호가 일치하지 않습니다.' }); return }
    setBusy(true); setFlash(null)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setFlash({ type: 'err', msg: error.message || '변경 실패' })
    else {
      setPw(''); setPw2('')
      setFlash({ type: 'ok', msg: '비밀번호가 변경되었습니다.' })
      setTimeout(() => setFlash(null), 3000)
    }
  }

  return (
    <div className="st-panel">
      <div className="st-panel-head">
        <h3>Change Password</h3>
        <p className="st-panel-sub">현재 로그인한 계정 ({session?.user?.email})의 비밀번호를 변경합니다.</p>
      </div>
      <form className="st-form" onSubmit={submit}>
        <div className="ca-field">
          <label>New Password</label>
          <input className="ca-input" type="password" value={pw} onChange={e => setPw(e.target.value)}
            placeholder="6자 이상" autoComplete="new-password" />
        </div>
        <div className="ca-field">
          <label>Confirm New Password</label>
          <input className="ca-input" type="password" value={pw2} onChange={e => setPw2(e.target.value)}
            autoComplete="new-password" />
        </div>
        <div className="ca-actions">
          <button className="ca-btn ca-btn-save" type="submit" disabled={busy}>
            {busy ? 'Updating…' : 'Update Password'}
          </button>
          {flash && <span className={`ca-flash ${flash.type === 'ok' ? 'ok' : 'err'}`}>{flash.msg}</span>}
        </div>
      </form>
    </div>
  )
}

// -------------------- Vendors master --------------------
function VendorsTab() {
  const [vendors, setVendors] = useState(loadVendors)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    const h = () => setVendors([...loadVendors()])
    window.addEventListener('vendors-update', h)
    return () => window.removeEventListener('vendors-update', h)
  }, [])

  useEffect(() => { if (vendors.length === 0) fetchAllVendors() }, [])

  const add = async e => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true); setFlash(null)
    try { await addVendor(name); setName('') }
    catch (err) { setFlash({ type: 'err', msg: err.message?.includes('duplicate') ? '이미 등록된 업체입니다.' : (err.message || '추가 실패') }) }
    finally { setBusy(false) }
  }

  const toggle = async v => {
    try { await updateVendor(v.id, { active: !v.active }) }
    catch (err) { setFlash({ type: 'err', msg: err.message || '변경 실패' }) }
  }
  const remove = async v => {
    if (!window.confirm(`업체 "${v.name}" 을 삭제할까요? (기존 실적 데이터의 Vendor 필드에는 영향 없음)`)) return
    try { await deleteVendor(v.id) }
    catch (err) { setFlash({ type: 'err', msg: err.message || '삭제 실패' }) }
  }

  return (
    <div className="st-panel">
      <div className="st-panel-head">
        <h3>Vendors 관리</h3>
        <p className="st-panel-sub">업체명 마스터 리스트입니다. Work Log·Daily Report의 Vendor 입력 시 이 목록이 자동완성으로 제공됩니다.</p>
      </div>
      <form className="st-inline-form" onSubmit={add}>
        <input className="ca-input" type="text" placeholder="새 업체명 입력" value={name} onChange={e => setName(e.target.value)} />
        <button className="ca-btn ca-btn-save" type="submit" disabled={busy || !name.trim()}>Add</button>
      </form>
      {flash && <div className={`ca-flash ${flash.type === 'ok' ? 'ok' : 'err'} st-inline-flash`}>{flash.msg}</div>}
      <div className="cs-table-wrap">
        <table className="cs-table st-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th style={{ width: 100 }}>Active</th>
              <th style={{ width: 140 }}>Added</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {vendors.map(v => (
              <tr key={v.id}>
                <td className="st-vendor-name">{v.name}</td>
                <td>
                  <label className="st-switch">
                    <input type="checkbox" checked={v.active} onChange={() => toggle(v)} />
                    <span>{v.active ? 'Active' : 'Inactive'}</span>
                  </label>
                </td>
                <td className="ca-mono">{v.created_at ? new Date(v.created_at).toISOString().slice(0, 10) : '—'}</td>
                <td>
                  <button className="ca-act ca-act-del" onClick={() => remove(v)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {vendors.length === 0 && <div className="cs-empty">등록된 업체가 없습니다. 위에서 첫 업체를 추가하세요.</div>}
      </div>
    </div>
  )
}

// -------------------- Data Export --------------------
function ExportTab() {
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(null)
  const [master, setMaster] = useState(null)

  useEffect(() => {
    fetch('/cable-data.json').then(r => r.json()).then(setMaster).catch(() => setMaster([]))
  }, [])

  const run = async () => {
    setBusy(true); setFlash(null)
    try {
      const snap = await fetchAllForExport()
      const mmap = new Map((master || []).map(c => [c.n, c]))
      const wb = XLSX.utils.book_new()

      // Sheet 1: Cable Actuals (with joined master info)
      const caCols = ['Cable No.', 'Category', 'Spec', 'System', 'Design Length', 'Vendor',
        'Pulled Length', 'Used Drum', 'Pulled By', 'Pulling Date',
        'Term Date (From)', 'By (From)', 'Term Date (To)', 'By (To)',
        'Line Check', 'ACT No.', 'Updated At', 'Updated By']
      const caRows = snap.cableActuals.map(r => {
        const m = mmap.get(r.cable_no) || {}
        return [
          r.cable_no, m.g || '', m.s || '', m.sys || '', m.l ?? '',
          r.vendor || '', r.pulled_length || '', r.used_drum || '', r.pulled_by || '', r.pulling_date || '',
          r.term_date_from || '', r.term_by_from || '', r.term_date_to || '', r.term_by_to || '',
          r.lc || 'Pending', r.act || '', r.updated_at || '', r.updated_by || '',
        ]
      })
      const wsCa = XLSX.utils.aoa_to_sheet([caCols, ...caRows])
      wsCa['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: caCols.length - 1, r: caRows.length } }) }
      XLSX.utils.book_append_sheet(wb, wsCa, 'Work Log')

      // Sheet 2: Daily Manpower
      const dmCols = ['Date', 'Vendor', 'Pull Manpower', 'Term Manpower', 'Updated At', 'Updated By']
      const dmRows = snap.dailyManpower.map(r =>
        [r.work_date, r.vendor, r.pull_manpower || '', r.term_manpower || '', r.updated_at || '', r.updated_by || ''])
      const wsDm = XLSX.utils.aoa_to_sheet([dmCols, ...dmRows])
      wsDm['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: dmCols.length - 1, r: dmRows.length } }) }
      XLSX.utils.book_append_sheet(wb, wsDm, 'Daily Manpower')

      // Sheet 3: Vendors
      const vRows = snap.vendors.map(v => [v.name, v.active ? 'Active' : 'Inactive', v.created_at || ''])
      const wsV = XLSX.utils.aoa_to_sheet([['Vendor', 'Status', 'Added'], ...vRows])
      XLSX.utils.book_append_sheet(wb, wsV, 'Vendors')

      XLSX.writeFile(wb, `Turkistan_CCGT_Full_Export_${stamp()}.xlsx`)
      setFlash({ type: 'ok', msg: `내보내기 완료 — Work Log ${caRows.length} / Daily ${dmRows.length} / Vendors ${vRows.length}` })
    } catch (err) {
      setFlash({ type: 'err', msg: err.message || 'Export 실패' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="st-panel">
      <div className="st-panel-head">
        <h3>Data Export</h3>
        <p className="st-panel-sub">DB의 모든 실적·인원·업체 마스터를 하나의 Excel 파일(3 시트)로 백업합니다.</p>
      </div>
      <div className="st-export-card">
        <div className="st-export-sheets">
          <div><strong>Sheet 1 · Work Log</strong> — cable_actuals + 마스터 조인 (Category/Spec/System 포함)</div>
          <div><strong>Sheet 2 · Daily Manpower</strong> — 날짜·업체별 인원</div>
          <div><strong>Sheet 3 · Vendors</strong> — 등록된 업체 마스터</div>
        </div>
        <button className="ca-btn ca-btn-save st-big-btn" onClick={run} disabled={busy}>
          {busy ? 'Exporting…' : 'Download Full Backup (.xlsx)'}
        </button>
        {flash && <div className={`ca-flash ${flash.type === 'ok' ? 'ok' : 'err'}`}>{flash.msg}</div>}
      </div>
    </div>
  )
}

// -------------------- Activity Log --------------------
function ActivityTab() {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(true)

  const load = async () => {
    setBusy(true)
    setRows(await fetchRecentActivity(30))
    setBusy(false)
  }

  useEffect(() => {
    load()
    const h = () => load()
    window.addEventListener('cable-field-update', h)
    window.addEventListener('cable-daily-update', h)
    return () => {
      window.removeEventListener('cable-field-update', h)
      window.removeEventListener('cable-daily-update', h)
    }
  }, [])

  const fmt = t => t ? new Date(t).toLocaleString('ko-KR') : '—'

  return (
    <div className="st-panel">
      <div className="st-panel-head">
        <h3>Activity Log</h3>
        <p className="st-panel-sub">최근 30건의 변경 이력입니다. 새로고침 없이 자동 업데이트됩니다.</p>
      </div>
      <div className="cs-table-wrap">
        <table className="cs-table st-table">
          <thead>
            <tr>
              <th style={{ width: 90 }}>Kind</th>
              <th>Reference</th>
              <th>Vendor</th>
              <th style={{ width: 180 }}>Updated At</th>
              <th>Updated By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <span className={`st-kind-badge ${r.kind}`}>{r.kind === 'cable' ? 'Work Log' : 'Daily'}</span>
                </td>
                <td className="ca-mono">{r.ref}</td>
                <td>{r.vendor || '—'}</td>
                <td className="ca-mono">{fmt(r.at)}</td>
                <td>{r.by || <span className="cm-muted">unknown</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!busy && rows.length === 0 && <div className="cs-empty">아직 변경 이력이 없습니다.</div>}
        {busy && <div className="cs-loading">Loading…</div>}
      </div>
    </div>
  )
}

// -------------------- Settings shell --------------------
export default function Settings({ session }) {
  const [tab, setTab] = useState('password')
  const isAdmin = session?.user?.user_metadata?.role === 'admin'

  if (!isAdmin) {
    return (
      <div className="cs-page">
        <div className="cs-body">
          <div className="page-header"><h2>Settings</h2></div>
          <div className="st-denied">
            <div className="st-denied-icon">🔒</div>
            <div className="st-denied-title">Admin Only</div>
            <div className="st-denied-sub">이 페이지는 관리자만 접근할 수 있습니다.<br/>비밀번호 변경이 필요하면 관리자에게 요청하세요.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cs-page">
      <div className="cs-body">
        <div className="page-header">
          <div className="cm-header-left">
            <h2>Settings</h2>
            <div className="cm-subtitle">Account · Master Data · Export</div>
          </div>
        </div>

        <div className="st-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`st-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'password' && <PasswordTab session={session} />}
        {tab === 'vendors'  && <VendorsTab />}
        {tab === 'export'   && <ExportTab />}
        {tab === 'activity' && <ActivityTab />}
      </div>
    </div>
  )
}
