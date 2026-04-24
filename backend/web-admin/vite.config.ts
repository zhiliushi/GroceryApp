import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // PWA is PROD-ONLY. In dev, Vite regenerates the SW on every file change,
      // and registerType:'autoUpdate' sees a "new SW" each time and forces a
      // reload — causing an infinite refresh loop that hides real errors.
      // Test the PWA via `npm run build && npm run preview` instead.
      devOptions: { enabled: false },
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-mask.png'],
      manifest: {
        name: 'GroceryApp',
        short_name: 'Grocery',
        description: 'Waste-prevention grocery tracker',
        start_url: '/dashboard',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#3B82F6',
        background_color: '#F8F8F8',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-mask.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // SPA routing: any nav that misses a cached asset falls back to index.html
        navigateFallback: '/index.html',
        // Never serve index.html for API paths (they must hit backend) — the
        // runtime caching rules below decide per-endpoint behaviour.
        navigateFallbackDenylist: [/^\/api\//, /^\/health$/],
        // Precache everything Vite emits into /dist; vite-plugin-pwa picks these up.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Public flags — OK to read stale, refresh in background
            urlPattern: /^.*\/api\/features\/public$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'gc-features-public',
              expiration: { maxAgeSeconds: 60 * 60 }, // 1 h
            },
          },
          {
            // Read-mostly: catalog list + purchases list + waste aggregates
            urlPattern: /^.*\/api\/(catalog|purchases|waste)\b.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gc-user-data',
              networkTimeoutSeconds: 3,
              expiration: { maxAgeSeconds: 5 * 60, maxEntries: 100 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Everything else under /api/* is auth/mutations — never cache.
            urlPattern: /^.*\/api\/.*/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: '../static/spa',
    emptyOutDir: true,
  },
  server: {
    // Pin the port so Luqman (also Vite, pinned to 1420) and Grocery never
    // silently swap onto each other's default. strictPort: true fails fast
    // instead of auto-incrementing to 5174 when something else holds 5173.
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:8000',
      // Exact-match — a bare `/health` prefix-matches SPA routes like `/health-score`,
      // which proxies them to the backend, 404s, and falls back to raw index.html
      // (no HMR shell) — the page silently blanks. Regex with ^...$ fixes it.
      '^/health$': 'http://localhost:8000',
    },
  },
})
