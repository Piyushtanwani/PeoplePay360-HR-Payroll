/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/.well-known': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        /**
         * Libraries are split from application code so a deploy that changes a page does not
         * invalidate the cached copy of React and the chart library along with it. Charts are
         * separated again because only the payroll dashboards load them.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) return 'react'
          if (id.includes('@radix-ui') || id.includes('@tanstack')) return 'ui'
          return 'vendor'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    // Tests talk to the in-process mock backend on the jsdom origin, so the base URL must be empty.
    env: { VITE_API_BASE_URL: '' },
  },
})
