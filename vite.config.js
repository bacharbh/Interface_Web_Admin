import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import viteCompression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Gzip Compression to reduce initial load size
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // Compress files larger than 10KB
    }),
    // Bundle visualizer (creates stats.html in the root or dist on build)
    visualizer({
      open: false,
      filename: 'stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'sheep-logo.png'],
      manifest: {
        name: 'Smart Shepherd AI Dashboard',
        short_name: 'SmartShepherd',
        description: 'Système expert de surveillance de troupeau.',
        theme_color: '#10B981',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // <== 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // 1. Isolate TensorFlow to prevent it from blocking the main thread
          if (id.includes('@tensorflow')) {
            return 'tensorflow';
          }

          // 2. React Core
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'react-vendor';
          }

          // 3. Mapping libraries
          if (id.includes('react-leaflet') || id.includes('leaflet')) {
            return 'map-vendor';
          }

          // 4. Charts & Data visualization
          if (id.includes('chart.js') || id.includes('react-chartjs-2') || id.includes('chartjs-plugin-annotation')) {
            return 'chart-vendor';
          }

          // 5. Real-time & Data Fetching
          if (id.includes('mqtt')) {
            return 'mqtt-vendor';
          }

          if (id.includes('framer-motion')) {
            return 'motion-vendor';
          }

          if (id.includes('lucide-react')) {
            return 'icons-vendor';
          }

          if (id.includes('axios') || id.includes('@tanstack/react-query')) {
            return 'data-vendor';
          }

          return 'vendor';
        }
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
      },
    }
  }
});