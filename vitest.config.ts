import { defineConfig } from 'vitest/config';
import { plotAliases } from './plot-aliases';

export default defineConfig({
  resolve: { alias: plotAliases },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
  },
});
