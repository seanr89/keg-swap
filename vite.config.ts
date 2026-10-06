import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Caches the app shell for offline use. Event, drink and review data is cached by
    // Firestore's own persistence (see src/firebase.ts), so it is deliberately not
    // intercepted here.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Keg Swap',
        short_name: 'Keg Swap',
        description: 'Track beer and ale events, rate drinks and swap tasting notes.',
        theme_color: '#0f172a',
        background_color: '#0c0a09',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__\//],
        runtimeCaching: [
          {
            // Drink and review photos: cache-first so venues with poor signal still show them
            urlPattern: ({ url }) => url.hostname === 'firebasestorage.googleapis.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'event-images',
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // The Firestore SDK (with offline persistence) is ~560 kB on its own; app code is ~60 kB.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Vendor libraries change far less often than app code, so keep them in
        // separate long-lived chunks that browsers can cache across deploys.
        codeSplitting: {
          groups: [
            { name: 'firebase-firestore', test: /node_modules[\\/](@firebase[\\/]firestore|firebase[\\/]firestore)/, priority: 30 },
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/, priority: 20 },
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
