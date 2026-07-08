import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // stamped into data-file URLs (?v=...) so each deploy busts the CDN/browser
  // cache for public/*.json, which otherwise serve stale for s-maxage
  define: {
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
})
