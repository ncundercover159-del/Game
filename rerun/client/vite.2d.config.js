import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Paths are relative to this file (rerun/client/), pointing at ../../rerun2d.
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// No Three.js, no dependencies at all — the 2D build is canvas and arithmetic.
// It does share the simulation, though: the top-down view needs the same X/Z
// physics with a height axis that the 3D game already runs, so ../shared is
// the level and the maths, and rerun2d/ is purely how it looks.
export default defineConfig({
  root: here('../../rerun2d'),
  resolve: {
    alias: { '@shared': here('../shared') },
  },
  build: {
    target: 'es2020',
    outDir: here('../../rerun2d/dist'),
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    lib: {
      entry: here('../../rerun2d/src/main.js'),
      formats: ['iife'],
      name: 'RERUN2D',
      fileName: () => 'rerun2d.js',
      cssFileName: 'rerun2d',
    },
  },
});
