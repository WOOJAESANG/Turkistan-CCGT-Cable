// Append the per-deploy build id to public data-file URLs so a new deploy
// always bypasses the CDN (s-maxage) and browser cache for these JSONs.
const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'

export function dataUrl(path) {
  return `${path}?v=${BUILD}`
}
