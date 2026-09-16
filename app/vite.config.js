import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      // Match index.html — WKWebView in `tauri dev` needs a Referer on the
      // YouTube iframe or playback dies with Error 153.
      'Referrer-Policy': 'origin',
    },
  },
})
