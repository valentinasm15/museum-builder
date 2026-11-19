import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/museum-builder/',
  plugins: [react()],
  assetsInclude: ['**/*.xlsx'],
  test: { testTimeout: 60000 }, // the greedy benchmark takes several seconds per call, more when suites run in parallel
})
