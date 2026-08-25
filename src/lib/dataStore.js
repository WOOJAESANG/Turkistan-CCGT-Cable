// Data store: Supabase-backed, in-memory cache, sync read API for components.
// Preserves the existing localStorage-style contract:
//   loadFieldData() / loadDaily() are SYNCHRONOUS reads from the cache,
//   writes are async (upsert/delete) + optimistic cache update + event dispatch.
// Realtime channels keep every browser in sync with other users' edits.

import { supabase } from './supabase'

function currentEmail() {
  const s = supabase.auth.getSession
  // sync accessor via session cached on client
  return supabase.auth._acqCache?.session?.user?.email
    || (typeof window !== 'undefined' && window.__supabaseUserEmail)
    || null
}
export function setCurrentEmail(email) {
  if (typeof window !== 'undefined') window.__supabaseUserEmail = email || null
}

// =========================================================
// cable_actuals
// =========================================================
let cableCache = {}
let cableLoaded = false

function rowToEntry(r) {
  return {
    vendor: (r.vendor || '').trim(),
    pulledLength: r.pulled_length || '',
    usedDrum: r.used_drum || '',
    pulledBy: r.pulled_by || '',
    pullingDate: r.pulling_date || '',
    termDateFrom: r.term_date_from || '',
    termByFrom: r.term_by_from || '',
    termDateTo: r.term_date_to || '',
    termByTo: r.term_by_to || '',
    lc: r.lc || 'Pending',
    act: r.act || '',
    updatedAt: r.updated_at || null,
    updatedBy: r.updated_by || null,
  }
}

function entryToRow(cableNo, e) {
  const dn = v => { const s = v != null ? String(v).trim() : ''; return s || null }
  const tn = v => { const s = v != null ? String(v).trim() : ''; return s || null }
  return {
    cable_no: cableNo,
    vendor: tn(e.vendor),
    pulled_length: tn(e.pulledLength),
    used_drum: tn(e.usedDrum),
    pulled_by: tn(e.pulledBy),
    pulling_date: dn(e.pullingDate),
    term_date_from: dn(e.termDateFrom),
    term_by_from: tn(e.termByFrom),
    term_date_to: dn(e.termDateTo),
    term_by_to: tn(e.termByTo),
    lc: e.lc || 'Pending',
    act: tn(e.act),
    updated_by: currentEmail(),
  }
}

export function loadFieldData() {
  return cableCache
}
export function isFieldDataLoaded() {
  return cableLoaded
}

// PostgREST caps a select at 1000 rows, so a plain select('*') silently returns only the
// first page once a table passes that — the rest of the table reads as if it were empty.
// Every full-table read has to page through explicitly.
export async function fetchAllRows(table, orderBy) {
  const PAGE = 1000
  const out = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select('*').range(from, from + PAGE - 1)
    if (orderBy) q = q.order(orderBy)
    const { data, error } = await q
    if (error) { console.error(`[fetchAllRows] ${table}`, error); return { data: null, error } }
    out.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return { data: out, error: null }
}

export async function fetchAllFieldData() {
  const { data, error } = await fetchAllRows('cable_actuals', 'cable_no')
  if (error) { console.error('[fetchAllFieldData]', error); return }
  const next = {}
  for (const r of data || []) next[r.cable_no] = rowToEntry(r)
  cableCache = next
  cableLoaded = true
  window.dispatchEvent(new CustomEvent('cable-field-update', { detail: { source: 'fetch' } }))
}

export async function updateFieldEntry(cno, patch) {
  const merged = { ...(cableCache[cno] || {}), ...patch }
  cableCache = { ...cableCache, [cno]: merged }
  window.dispatchEvent(new CustomEvent('cable-field-update', { detail: { cno, data: merged } }))
  const { error } = await supabase.from('cable_actuals').upsert(entryToRow(cno, merged))
  if (error) { console.error('[updateFieldEntry]', error); throw error }
}

// Bulk import path. Writing 500 rows as 500 separate requests trips Supabase's rate limit
// partway through — the failures are the connection being refused, not the data — so rows
// go up in chunks, each retried as a unit.
//
// Column each import field writes to; a field the file omits is left at whatever the
// server currently holds.
const IMPORT_COLUMNS = {
  vendor: 'vendor', pulledLength: 'pulled_length', usedDrum: 'used_drum',
  pulledBy: 'pulled_by', pullingDate: 'pulling_date', termDateFrom: 'term_date_from',
  termByFrom: 'term_by_from', termDateTo: 'term_date_to', termByTo: 'term_by_to',
  lc: 'lc', act: 'act',
}

export async function bulkUpsertFieldEntries(items, onProgress) {
  const CHUNK = 100

  // Re-read first, so the local view of these cables matches the server before we touch
  // them and the caller's verification compares against reality.
  await fetchAllFieldData()

  // An upsert replaces the whole row, so a column the file omits would come back as its
  // default — that is what blanked entries made from another tab. Each row is therefore
  // built from the values just fetched, with only the file's own fields laid over the top,
  // and still goes up in batches (per-row PATCHes would hit the rate limit again).
  const rows = items.map(({ cno, patch }) => {
    const server = cableCache[cno] || {}
    const row = { ...entryToRow(cno, server), updated_by: currentEmail() }
    for (const [field, column] of Object.entries(IMPORT_COLUMNS)) {
      if (!(field in patch)) continue
      const s = patch[field] != null ? String(patch[field]).trim() : ''
      row[column] = s || null
    }
    return row
  })
  // Only reflect the file locally once the request for it has gone out successfully.
  const applyToCache = slice => {
    for (const r of slice) {
      const item = items.find(x => x.cno === r.cable_no)
      if (item) cableCache = { ...cableCache, [r.cable_no]: { ...(cableCache[r.cable_no] || {}), ...item.patch } }
    }
  }

  const failed = []
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    let ok = false
    for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
      const { error } = await supabase.from('cable_actuals').upsert(slice)
      if (!error) { ok = true; break }
      console.error(`[bulkUpsert] chunk ${i / CHUNK + 1} attempt ${attempt}`, error)
      if (attempt < 4) await new Promise(r => setTimeout(r, 600 * attempt))
    }
    if (ok) applyToCache(slice)
    else failed.push(...slice.map(r => r.cable_no))
    onProgress?.(Math.min(i + CHUNK, rows.length), rows.length)
  }
  window.dispatchEvent(new CustomEvent('cable-field-update', { detail: { source: 'bulk' } }))
  return failed
}

export async function deleteFieldEntry(cno) {
  if (!(cno in cableCache)) return
  const next = { ...cableCache }
  delete next[cno]
  cableCache = next
  window.dispatchEvent(new CustomEvent('cable-field-update', { detail: { cno, data: null } }))
  const { error } = await supabase.from('cable_actuals').delete().eq('cable_no', cno)
  if (error) console.error('[deleteFieldEntry]', error)
}

// =========================================================
// daily_manpower (date × vendor)
// =========================================================
let dailyCache = {}
let dailyLoaded = false

function dailyRowToEntry(r) {
  return {
    date: r.work_date,
    vendor: r.vendor,
    pullManpower: r.pull_manpower || '',
    termManpower: r.term_manpower || '',
    updatedAt: r.updated_at || null,
    updatedBy: r.updated_by || null,
    _id: r.id,
  }
}

export function loadDaily() {
  return dailyCache
}
export function isDailyLoaded() {
  return dailyLoaded
}

export async function fetchAllDaily() {
  const { data, error } = await fetchAllRows('daily_manpower', 'work_date')
  if (error) { console.error('[fetchAllDaily]', error); return }
  const next = {}
  for (const r of data || []) next[`${r.work_date}|${r.vendor}`] = dailyRowToEntry(r)
  dailyCache = next
  dailyLoaded = true
  window.dispatchEvent(new CustomEvent('cable-daily-update', { detail: { source: 'fetch' } }))
}

export async function saveDailyEntry(date, vendor, patch) {
  const key = `${date}|${vendor}`
  const prev = dailyCache[key] || { date, vendor, pullManpower: '', termManpower: '' }
  const merged = { ...prev, date, vendor, ...patch }
  dailyCache = { ...dailyCache, [key]: merged }
  window.dispatchEvent(new CustomEvent('cable-daily-update', { detail: { key } }))
  const row = {
    work_date: date,
    vendor,
    pull_manpower: merged.pullManpower || null,
    term_manpower: merged.termManpower || null,
    updated_by: currentEmail(),
  }
  const { error } = await supabase.from('daily_manpower').upsert(row, { onConflict: 'work_date,vendor' })
  if (error) { console.error('[saveDailyEntry]', error); throw error }
}

export async function deleteDailyEntry(key) {
  const entry = dailyCache[key]
  if (!entry) return
  const next = { ...dailyCache }; delete next[key]
  dailyCache = next
  window.dispatchEvent(new CustomEvent('cable-daily-update', { detail: { key, deleted: true } }))
  const { error } = await supabase.from('daily_manpower').delete().eq('work_date', entry.date).eq('vendor', entry.vendor)
  if (error) console.error('[deleteDailyEntry]', error)
}

// =========================================================
// Realtime subscriptions
// =========================================================
let channel = null

export function subscribeRealtime() {
  if (channel) return
  channel = supabase
    .channel('cable-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cable_actuals' }, payload => {
      if (payload.eventType === 'DELETE') {
        const cno = payload.old?.cable_no
        if (cno && cableCache[cno]) {
          const next = { ...cableCache }; delete next[cno]; cableCache = next
          window.dispatchEvent(new CustomEvent('cable-field-update', { detail: { cno, data: null, remote: true } }))
        }
      } else if (payload.new) {
        const r = payload.new
        cableCache = { ...cableCache, [r.cable_no]: rowToEntry(r) }
        window.dispatchEvent(new CustomEvent('cable-field-update', { detail: { cno: r.cable_no, remote: true } }))
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_manpower' }, payload => {
      if (payload.eventType === 'DELETE') {
        const r = payload.old
        if (r) {
          const key = `${r.work_date}|${r.vendor}`
          if (dailyCache[key]) {
            const next = { ...dailyCache }; delete next[key]; dailyCache = next
            window.dispatchEvent(new CustomEvent('cable-daily-update', { detail: { key, remote: true } }))
          }
        }
      } else if (payload.new) {
        const r = payload.new
        const key = `${r.work_date}|${r.vendor}`
        dailyCache = { ...dailyCache, [key]: dailyRowToEntry(r) }
        window.dispatchEvent(new CustomEvent('cable-daily-update', { detail: { key, remote: true } }))
      }
    })
    .subscribe()
}

export function unsubscribeRealtime() {
  if (channel) { supabase.removeChannel(channel); channel = null }
}

export function resetCaches() {
  cableCache = {}; dailyCache = {}; cableLoaded = false; dailyLoaded = false
  vendorCache = []; vendorLoaded = false
  targetCache = {}; targetLoaded = false
}

// =========================================================
// milestone_targets (Cable Master Plan — editable target dates)
// Falls back to this browser's localStorage until the Supabase
// table exists, so the page works either way.
// =========================================================
let targetCache = {}
let targetLoaded = false
const TARGET_LS_KEY = 'milestone-targets'

function readTargetLS() {
  try { return JSON.parse(localStorage.getItem(TARGET_LS_KEY)) || {} } catch { return {} }
}
function writeTargetLS() {
  try { localStorage.setItem(TARGET_LS_KEY, JSON.stringify(targetCache)) } catch { /* ignore */ }
}

export function loadMilestoneTargets() { return targetCache }
export function isMilestoneTargetsLoaded() { return targetLoaded }

export async function fetchAllMilestoneTargets() {
  const { data, error } = await fetchAllRows('milestone_targets')
  if (error) {
    targetCache = readTargetLS()
  } else {
    const next = {}
    for (const r of data || []) next[r.milestone] = r.target_date
    targetCache = next
  }
  targetLoaded = true
  window.dispatchEvent(new CustomEvent('milestone-targets-update'))
}

export async function saveMilestoneTarget(milestone, date) {
  targetCache = { ...targetCache, [milestone]: date }
  writeTargetLS()
  window.dispatchEvent(new CustomEvent('milestone-targets-update'))
  const { error } = await supabase.from('milestone_targets').upsert({
    milestone,
    target_date: date,
    updated_by: currentEmail(),
    updated_at: new Date().toISOString(),
  })
  if (error) console.error('[saveMilestoneTarget] saved locally only:', error.message)
}

export async function resetMilestoneTarget(milestone) {
  const next = { ...targetCache }
  delete next[milestone]
  targetCache = next
  writeTargetLS()
  window.dispatchEvent(new CustomEvent('milestone-targets-update'))
  const { error } = await supabase.from('milestone_targets').delete().eq('milestone', milestone)
  if (error) console.error('[resetMilestoneTarget] removed locally only:', error.message)
}

// =========================================================
// vendors (Settings → 업체 마스터)
// =========================================================
let vendorCache = []
let vendorLoaded = false

export function loadVendors() { return vendorCache }
export function isVendorsLoaded() { return vendorLoaded }
export function activeVendorNames() {
  return vendorCache.filter(v => v.active).map(v => v.name)
}

export async function fetchAllVendors() {
  const { data, error } = await fetchAllRows('vendors', 'name')
  if (error) { console.error('[fetchAllVendors]', error); return }
  vendorCache = data || []
  vendorLoaded = true
  window.dispatchEvent(new CustomEvent('vendors-update'))
}

export async function addVendor(name) {
  const clean = String(name || '').trim()
  if (!clean) throw new Error('업체명을 입력하세요')
  const { data, error } = await supabase.from('vendors').insert({ name: clean }).select().single()
  if (error) throw error
  vendorCache = [...vendorCache, data].sort((a, b) => a.name.localeCompare(b.name))
  window.dispatchEvent(new CustomEvent('vendors-update'))
  return data
}

export async function updateVendor(id, patch) {
  const { data, error } = await supabase.from('vendors').update(patch).eq('id', id).select().single()
  if (error) throw error
  vendorCache = vendorCache.map(v => v.id === id ? data : v)
  window.dispatchEvent(new CustomEvent('vendors-update'))
}

export async function deleteVendor(id) {
  const { error } = await supabase.from('vendors').delete().eq('id', id)
  if (error) throw error
  vendorCache = vendorCache.filter(v => v.id !== id)
  window.dispatchEvent(new CustomEvent('vendors-update'))
}

// =========================================================
// Activity log (recent edits across both tables)
// =========================================================
export async function fetchRecentActivity(limit = 30) {
  const [{ data: c }, { data: d }] = await Promise.all([
    supabase.from('cable_actuals')
      .select('cable_no, vendor, updated_at, updated_by')
      .order('updated_at', { ascending: false }).limit(limit),
    supabase.from('daily_manpower')
      .select('work_date, vendor, updated_at, updated_by')
      .order('updated_at', { ascending: false }).limit(limit),
  ])
  const rows = []
  for (const r of c || []) rows.push({ kind: 'cable', ref: r.cable_no, vendor: r.vendor, at: r.updated_at, by: r.updated_by })
  for (const r of d || []) rows.push({ kind: 'daily', ref: `${r.work_date} · ${r.vendor}`, vendor: r.vendor, at: r.updated_at, by: r.updated_by })
  rows.sort((a, b) => (b.at || '').localeCompare(a.at || ''))
  return rows.slice(0, limit)
}

// =========================================================
// Full snapshot fetch (Data Export)
// =========================================================
export async function fetchAllForExport() {
  const [ca, dm, v] = await Promise.all([
    fetchAllRows('cable_actuals', 'cable_no'),
    fetchAllRows('daily_manpower', 'work_date'),
    fetchAllRows('vendors', 'name'),
  ])
  return {
    cableActuals: ca.data || [],
    dailyManpower: dm.data || [],
    vendors: v.data || [],
  }
}
