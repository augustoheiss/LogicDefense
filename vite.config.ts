import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.{ts,tsx}'],
  },
  server: {
    watch: {
      ignored: [
        '**/Assistente-Moeda-App/**',
        '**/Sekundo/**',
        '**/venv/**',
        '**/.venv/**',
        '**/backend/**',
        '**/dist/**',
        '**/artifacts/**',
        '**/public/**',
      ],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
