import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// The client imports the simulation straight out of ../shared so local
// prediction and the server run identical code. Vite needs permission to read
// above the project root for that.
const shared = fileURLToPath(new URL('../shared', import.meta.url));

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      // `npm run dev` here + `npm start` at ../ gives you the whole game.
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  resolve: {
    alias: { '@shared': shared },
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 8192,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
