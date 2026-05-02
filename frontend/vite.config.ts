import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Expose to the network
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    // Split vendor libraries into separate cacheable chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — cached forever between deploys
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // i18n bundle
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          // Map libraries (heaviest single dependency)
          'vendor-maps': ['leaflet', 'react-leaflet'],
          // UI utilities
          'vendor-utils': ['axios', 'lucide-react', 'clsx', 'tailwind-merge'],
          // Data & storage
          'vendor-data': ['@supabase/supabase-js', 'localforage'],
        },
      },
    },
    // Warn at 250KB instead of default 500KB for stricter monitoring
    chunkSizeWarningLimit: 250,
  },
})
