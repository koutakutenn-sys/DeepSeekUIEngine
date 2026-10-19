// Mathematical values independent of the renderer and its evaluator.
export const elementaryFunctions = [
  ['x', 2, 2], ['3', -2, 3], ['x^2', -3, 9], ['x^3', -2, -8],
  ['x^5-2*x+1', 2, 29], ['1/x', -2, -0.5], ['(x+1)/(x-1)', 3, 2],
  ['sqrt(x)', 4, 2], ['cbrt(x)', -8, -2], ['x^0.5', 4, 2],
  ['exp(x)', 0, 1], ['2^x', 3, 8], ['e^x', 1, Math.E], ['x^x', 2, 4],
  ['log(x)', Math.E, 1], ['ln(x)', 1, 0], ['log10(x)', 100, 2], ['log2(x)', 8, 3],
  ['sin(x)', Math.PI / 6, 0.5], ['cos(x)', Math.PI / 3, 0.5], ['tan(x)', Math.PI / 4, 1],
  ['asin(x)', 0.5, Math.PI / 6], ['acos(x)', 0.5, Math.PI / 3], ['atan(x)', 1, Math.PI / 4],
  ['sinh(x)', 0, 0], ['cosh(x)', 0, 1], ['tanh(x)', 0, 0],
  ['abs(x)', -2, 2], ['sin(x)+cos(2*x)', 0, 1], ['exp(-x^2)', 0, 1],
  ['sqrt(x^2-1)', 2, Math.sqrt(3)], ['sin(pi*x)', 0.5, 1],
] as const;
