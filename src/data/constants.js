// Shared domain constants (deduplicated from per-component copies).

// Category label → internal id used across charts and rollups.
export const CAT_ID_BY_LABEL = { Power: 'power', Control: 'control', 'I&C': 'iac', PKG: 'pkg' }

// Project trend-chart date range (Monthly/Weekly charts).
export const CHART_START = { y: 2026, m: 7 }
export const CHART_END = { y: 2027, m: 12 }
