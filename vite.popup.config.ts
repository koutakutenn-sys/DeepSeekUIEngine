import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { licenseModules } from './scripts/license-modules';

export default defineConfig({
  plugins: [react(), licenseModules('popup')],
  publicDir: false,
  base: './',
  build: {
    target: 'chrome120',
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: { input: 'popup.html' },
  },
});
