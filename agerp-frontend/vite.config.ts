import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // O Vite de desenvolvimento roda a partir de agerp-frontend; o .env fica na raiz.
  const local = loadEnv(mode, '..', 'AGERP_')
  const port = Number(local.AGERP_DEV_PORT || 5173)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('AGERP_DEV_PORT deve ser uma porta entre 1 e 65535')
  }
  const allowedHosts = (local.AGERP_DEV_ALLOWED_HOSTS || '').split(',').map(x => x.trim()).filter(Boolean)
  if (allowedHosts.some(x => !/^[a-zA-Z0-9.-]+$/.test(x))) {
    throw new Error('AGERP_DEV_ALLOWED_HOSTS deve conter apenas nomes DNS explicitos')
  }
  return {
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    host: local.AGERP_DEV_BIND_ADDRESS || '0.0.0.0',
    port,
    strictPort: true,
    allowedHosts,
    // Vite e o backend executados no host (fora do Docker) durante o desenvolvimento.
    // Em producao, o Nginx do frontend usa o DNS interno backend-api:8080.
    proxy: {
      '/api': {
        target: local.AGERP_DEV_PROXY_TARGET || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  }
})
