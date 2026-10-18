import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  publicDir: false,
  build: {
    target: 'chrome120',
    outDir: '.cache/e2e-fixture',
    emptyOutDir: true,
    lib: { entry: 'tests/e2e/composer-fixture.tsx', name: 'ControlledComposerFixture', formats: ['iife'], fileName: () => 'composer.js' },
  },
});
