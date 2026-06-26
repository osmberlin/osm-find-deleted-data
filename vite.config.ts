/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// Project GitHub Pages site is served from /<repo>/.
// Locally (dev, tests) we serve from root for simplicity.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/osm-find-deleted-data/' : '/',
  plugins: [
    // Router plugin must run before the React plugin.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // E2E specs run under Playwright, not Vitest.
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
}))
