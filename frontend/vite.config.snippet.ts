// Merge into your existing vite.config.ts (keep your react() / tailwind plugins).
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages needed '/EducorePrototype/'; the Docker build serves from the site root, so make it configurable.
  base: process.env.VITE_BASE ?? '/',
  server: {
    // Dev: the browser talks only to :5173, Vite forwards /api to FastAPI => same-origin, no CORS setup needed.
    proxy: { '/api': 'http://localhost:8000' },
  },
});
