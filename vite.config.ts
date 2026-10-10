import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `base: './'` keeps asset paths relative, so the production build also
// works when opened from a sub-folder or any static host.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
