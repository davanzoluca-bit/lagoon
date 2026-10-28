import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
  },
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', coverage: { reporter: ['text', 'html'], include: ['src/**/*.{ts,tsx}'], exclude: ['src/main.tsx', 'src/test-setup.ts'] } },
})
