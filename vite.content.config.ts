import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { plotAliases } from './plot-aliases';
import { licenseModules } from './scripts/license-modules';
import { zodNoCodegen } from './scripts/zod-no-codegen';

export default defineConfig({
  plugins: [zodNoCodegen(), react(), licenseModules('content')],
  resolve: { alias: plotAliases },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  publicDir: 'public',
  build: {
    target: 'chrome120',
    outDir: 'dist',
    emptyOutDir: true,
    lib: { entry: 'src/content/index.tsx', name: 'DSUI', formats: ['iife'], fileName: () => 'content.js' },
    sourcemap: false,
  },
});
