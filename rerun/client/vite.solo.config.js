import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Paths are relative to this file (client/), pointing into ../artifact.
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// Builds the whole game — client, shared simulation and the server Room —
// into one IIFE with no imports, so it can be inlined into a single page.
export default defineConfig({
  // Pinned so the build is identical wherever it is invoked from — in
  // particular it must never write into the multiplayer client's dist/.
  root: here('../artifact'),
  resolve: {
    alias: {
      '@shared': here('../shared'),
      '@transport': here('../artifact/src/loopback.js'),
    },
  },
  define: {
    // The server reads this for the lobby minimum. There is one of you.
    'process.env.RERUN_MIN_PLAYERS': '"1"',
  },
  build: {
    target: 'es2020',
    outDir: here('../artifact/dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    lib: {
      entry: here('../artifact/src/entry.js'),
      formats: ['iife'],
      name: 'RERUN',
      fileName: () => 'rerun.js',
      cssFileName: 'rerun',
    },
  },
});
