// Which unit (GT train) a cable belongs to. Searching "GT11" also hits GT12/21/22 and
// misses "GTG #11" / "HRSG #11" / "11BFA…", so the unit is derived once here instead.
//
// Order matters: the system name is the most reliable signal, then the KKS prefix of the
// cable or its ends (11/12/21/22 = GT unit), then the block prefix (B1/B2/B0) for
// cables shared by both GTs of a block or by the whole plant.
export const UNITS = [
  { code: 'GT11', label: 'GT #11 (Block 1)' },
  { code: 'GT12', label: 'GT #12 (Block 1)' },
  { code: 'B1', label: 'Block 1 Common' },
  { code: 'GT21', label: 'GT #21 (Block 2)' },
  { code: 'GT22', label: 'GT #22 (Block 2)' },
  { code: 'B2', label: 'Block 2 Common' },
  { code: 'B0', label: 'Plant Common (B0)' },
  { code: 'AIS', label: 'AIS / Substation' },
  { code: 'OTHER', label: 'Other' },
]

const SYS_UNIT = [
  // GTG #11, GT#11, GT PKG #11, HRSG #11, HSRG #11, DMPR #11, GTG11, HOT WATER #GT 11
  [/(?:GTG|GT|HRSG|HSRG|DMPR)\s*(?:PKG\s*)?#?\s*(1[12]|2[12])\b/i, m => `GT${m[1]}`],
  [/#\s*GT\s*(1[12]|2[12])\b/i, m => `GT${m[1]}`],
  // BLK #1 GTG #2 → GT12
  [/BLK\s*#\s*(\d)\s*GTG\s*#\s*(\d)/i, m => `GT${m[1]}${m[2]}`],
  // 0.4kV SWGR FOR GT/HRSG#2A FOR BLOCK#1 → GT12
  [/GT\/HRSG\s*#\s*(\d)[AB]\s*FOR\s*BLOCK\s*#\s*(\d)/i, m => `GT${m[2]}${m[1]}`],
]
const KKS_UNIT = /^(1[12]|2[12])[A-Z]{2,3}\d/
const BLOCK = /^B([012])-/

export function unitOf(c) {
  const sys = c.sys || ''
  for (const [re, fn] of SYS_UNIT) {
    const m = sys.match(re)
    if (m) return fn(m)
  }
  const ends = [c.n || '', c.f || '', c.t || '']
  for (const v of ends) {
    const m = v.match(KKS_UNIT)
    if (m) return `GT${m[1]}`
  }
  if (sys.startsWith('AIS')) return 'AIS'
  for (const v of ends) {
    const m = v.match(BLOCK)
    if (m) return `B${m[1]}`
  }
  return 'OTHER'
}

export const unitLabel = code => UNITS.find(u => u.code === code)?.label || code
