import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  base: './',
  build: {
    target: 'chrome120',
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: { input: 'popup.html' },
  },
});
