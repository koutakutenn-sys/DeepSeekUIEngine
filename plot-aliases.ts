import { fileURLToPath } from 'node:url';

export const plotAliases = ['built-in-math-eval', 'interval-arithmetic-eval'].map((name) => ({
  find: name, replacement: fileURLToPath(new URL('./src/math/function-plot-evaluator.ts', import.meta.url)),
}));
