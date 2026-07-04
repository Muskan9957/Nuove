import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Append build date so CDN cache always busts on deploy
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      }
    }
  },
  server: {
    // PORT env lets preview harnesses assign a free port; defaults to 3000 for local dev
    port: Number(process.env.PORT) || 3000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:6003',
        changeOrigin: true,
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      }
    }
  }
})
