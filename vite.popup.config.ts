import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { licenseModules } from './scripts/license-modules';
import { zodNoCodegen } from './scripts/zod-no-codegen';

export default defineConfig({
  plugins: [zodNoCodegen(), react(), licenseModules('popup')],
  publicDir: false,
  base: './',
  build: {
    modulePreload: { polyfill: false },
    target: 'chrome120',
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: { input: 'popup.html' },
  },
});
