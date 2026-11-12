import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The dev server forwards `/api` to the Python service, so the browser sees one
// origin in development as it does when the service serves the build.
const apiUrl = process.env.WRITING_API_URL ?? 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': apiUrl },
  },
})
