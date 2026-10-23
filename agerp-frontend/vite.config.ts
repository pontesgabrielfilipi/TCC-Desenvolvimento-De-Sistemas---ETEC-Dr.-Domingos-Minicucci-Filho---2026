import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'noname.tailf69801.ts.net'
    ],
    // Vite e o backend executados no host (fora do Docker) durante o desenvolvimento.
    // Em producao, o Nginx do frontend usa o DNS interno backend-api:8080.
    proxy: {
      '/api': {
        target: process.env.AGERP_DEV_PROXY_TARGET || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
