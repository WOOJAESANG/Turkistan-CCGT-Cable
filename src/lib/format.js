// Shared formatting helpers (deduplicated from per-component copies).

// Korean-locale thousands separator. Note: does not round — callers that need
// rounding (e.g. PieChartSection) round before calling.
export function formatNumber(n) {
  return n.toLocaleString('ko-KR')
}

// Today's date as YYYY-MM-DD (local time).
export function stamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Parse a possibly-formatted numeric string; strips non-numeric chars, 0 on failure.
export function num(v) {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}
