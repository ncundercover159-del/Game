import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// The client reads ../shared directly — the level data, the prop catalogue and
// the wire codec are the same files the server runs. Anything less and the two
// halves of the game would eventually disagree about where a wall is. Vite has
// to be told it may read above the project root for that.
const shared = fileURLToPath(new URL('../shared', import.meta.url));

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    fs: { allow: ['..'] },
    // `npm run dev` here + `npm start` at ../ gives you the whole game.
    proxy: { '/ws': { target: 'ws://localhost:8787', ws: true } },
  },
  preview: {
    port: 4173,
    proxy: { '/ws': { target: 'ws://localhost:8787', ws: true } },
  },
  resolve: {
    alias: { '@shared': shared },
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 8192,
    rollupOptions: {
      // three is most of the bytes and never changes; keeping it in its own
      // chunk means a client patch is a few KB rather than a megabyte.
      output: { manualChunks: { three: ['three'] } },
    },
  },
});
