import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages serves from a sub-path (set VITE_BASE=/EducorePrototype/); the Docker build serves from the site root.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  server: {
    // Dev: the browser talks only to :5173 and Vite forwards /api to FastAPI, so there is no CORS to set up.
    proxy: { '/api': 'http://localhost:8000' },
  },
})
