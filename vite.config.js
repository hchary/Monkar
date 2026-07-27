import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildId = String(Date.now())

function versionFilePlugin() {
  return {
    name: 'version-file',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionFilePlugin()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
})
