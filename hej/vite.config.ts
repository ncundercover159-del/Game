import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// `ARTIFACT=1 vite build` makes one self-contained page for claude.ai artifacts:
// no service worker, everything inlined by scripts/artifact.ts afterwards.
const ARTIFACT = process.env.ARTIFACT === '1';

export default defineConfig({
  base: './',
  define: ARTIFACT ? { 'import.meta.env.VITE_ARTIFACT': JSON.stringify('1') } : {},
  resolve: ARTIFACT ? { alias: { 'virtual:pwa-register': new URL('./src/pwa-stub.ts', import.meta.url).pathname } } : {},
  build: ARTIFACT
    ? { target: 'es2022', outDir: 'dist-artifact', assetsInlineLimit: 100_000_000, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } }
    : { target: 'es2022', chunkSizeWarningLimit: 2000 },
  plugins: ARTIFACT ? [] : [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['icons/*.png', 'audio/*.mp3', 'audio/manifest.json'],
      manifest: {
        name: 'Hej! — learn Danish in Aarhus',
        short_name: 'Hej!',
        description: 'A pixel-art life sim that takes you from zero to conversational Danish.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1b1f2a',
        theme_color: '#c8102e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json,mp3,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'node' },
} as any);
