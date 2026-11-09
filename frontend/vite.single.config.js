import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Builds the whole dashboard into one self-contained HTML file (LeadPilot.html).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-single', emptyOutDir: true, chunkSizeWarningLimit: 5000 },
})
