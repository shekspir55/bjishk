import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3015',
        changeOrigin: true,
      }
    }
  },
  // Add additional config for build
  build: {
    // Disable minification for easier debugging if needed
    // minify: false,
    // Bypass TypeScript errors
    typescript: {
      ignoreBuildErrors: true,
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  }
}) 