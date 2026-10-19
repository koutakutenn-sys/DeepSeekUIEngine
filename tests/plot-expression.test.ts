import { describe, expect, it } from 'vitest';
import { createPlotEvaluator, validateExpression } from '../src/math/plot-expression';
import { parsePayload } from '../src/protocol';
import { payload, quadratic } from './fixtures';
import { elementaryFunctions } from './elementary-functions';
import rawCompiler from '../src/math/function-plot-evaluator';

describe('safe elementary expressions for function-plot', () => {
  it('blocks the upstream raw string compilation entry point', () => {
    expect(() => rawCompiler()).toThrow('Use a validated plot callback');
  });
  it.each(elementaryFunctions)('%s has the mathematical value at %s', (expression, x, expected) => {
    const evaluate = createPlotEvaluator(expression, {});
    expect(evaluate({ x })).toBeCloseTo(expected, 10);
    const result = evaluate({ x: { lo: x - 1e-8, hi: x + 1e-8 } });
    expect(result.lo).toBeLessThanOrEqual(expected + 1e-10);
    expect(result.hi).toBeGreaterThanOrEqual(expected - 1e-10);
    expect(result.hi - result.lo).toBeLessThan(0.001);
    expect(parsePayload(payload([{ ...quadratic, preset: 'expression', expression, parameters: [] }]))).not.toBeNull();
  });
  it('uses only declared bounded parameters', () => {
    expect(createPlotEvaluator('a*sin(x)+b', { a: 2, b: 3 })({ x: Math.PI / 2 })).toBe(5);
    expect(validateExpression('a*x', [])).toBe(false);
    expect(validateExpression('a*x', ['a'])).toBe(true);
  });
  it.each(['window', 'globalThis', 'constructor', 'x.constructor', 'x[0]', 'x=2', 'f(x)=x',
    'import("a")', 'evaluate("1")', '[1,2]', '1:100000', 'sin(x);cos(x)', 'x ? 1 : 2',
    'random()', 'factorial(100)', 'sin(x,x)', '"hello"', 'Infinity', '1e999', 'y',
    'x!','x%2', '2 cm', 'a'.repeat(257), 'sin('.repeat(30) + 'x' + ')'.repeat(30)])('rejects %s', (expression) => {
    expect(validateExpression(expression, [])).toBe(false);
    expect(parsePayload(payload([{ ...quadratic, preset: 'expression', expression, parameters: [] }]))).toBeNull();
  });
  it('preserves holes and poles for the upstream interval sampler', () => {
    expect(createPlotEvaluator('abs(x)', {})({ x: { lo: 1, hi: 2 } })).toMatchObject({ lo: 1, hi: 2 });
    const hole = createPlotEvaluator('sqrt(x^2-1)', {})({ x: { lo: -0.5, hi: 0.5 } });
    expect(hole.lo).toBeGreaterThan(hole.hi);
    const pole = createPlotEvaluator('1/x', {})({ x: { lo: -0.01, hi: 0.01 } });
    expect(pole).toMatchObject({ lo: -Infinity, hi: Infinity });
    expect(Number.isNaN(createPlotEvaluator('log(x)', {})({ x: -1 }))).toBe(true);
  });
  it.each(['exp(1000)', 'sinh(1000)', '-exp(1000)', '1e308*1e308'])('does not turn %s overflow into a full-height curve', (expression) => {
    const result = createPlotEvaluator(expression, {})({ x: { lo: -1, hi: 1 } });
    expect(result.lo).toBeGreaterThan(result.hi);
  });
});
