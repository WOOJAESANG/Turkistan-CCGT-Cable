// Shared drum-tag grammar. Work Log stores whatever the field team typed;
// Drum Usage needs a canonical tag to match against the packing lists.

// Legacy AIS tags (before the packing-prefixed rename) → canonical prefixed tags.
const LEGACY_AIS_PK = { pocable: '0481', cocable: '0571', cc: '0585', cmcable: '0587' }

// A tag naming the cable type but not the packing it shipped under.
const SHORT_AIS_RE = /^AIS-(PoCable|CoCable|CC|CMcable)-(\d{1,3})$/i

// AIS cable types delivered under more than one packing list. A short tag cannot
// say which packing a drum came from, so it is a guess from the second packing's
// on-site date onward — before that date only one packing existed and the short
// form was provably unambiguous.
const MULTI_PACKING = {
  pocable: { packings: ['0481', '0570'], ambiguousFrom: '2026-07-20' },
}

// A PGU-DE-<packing>- prefix names the packing outright, so it wins over the
// legacy guess. Packing numbers are written both padded and bare (0571 / 571).
function split(tag) {
  const s = String(tag || '').trim()
  const m = s.match(/^PGU-DE-(\d+)-(.*)$/i)
  return m ? { pk: m[1].padStart(4, '0'), rest: m[2] } : { pk: null, rest: s }
}

export function canonDrum(tag) {
  const { pk, rest } = split(tag)
  const m = rest.match(SHORT_AIS_RE)
  if (!m) return rest
  const packing = pk || LEGACY_AIS_PK[m[1].toLowerCase()]
  return `AIS-${m[1]}-${packing}-${m[2].padStart(3, '0')}`
}

// Returns null when the tag resolves to exactly one drum, or details of the
// ambiguity when the packing number is missing and more than one packing is on
// site. pullingDate is optional — without it we cannot rule the ambiguity out.
export function ambiguousDrumTag(tag, pullingDate) {
  const { pk, rest } = split(tag)
  if (pk) return null // prefix already names the packing
  const m = rest.match(SHORT_AIS_RE)
  if (!m) return null
  const type = m[1].toLowerCase()
  const rule = MULTI_PACKING[type]
  if (!rule) return null
  if (pullingDate && pullingDate < rule.ambiguousFrom) return null
  const no = m[2].padStart(3, '0')
  return {
    no,
    assumed: `AIS-${m[1]}-${LEGACY_AIS_PK[type]}-${no}`,
    candidates: rule.packings.map(pk => `AIS-${m[1]}-${pk}-${no}`),
  }
}
