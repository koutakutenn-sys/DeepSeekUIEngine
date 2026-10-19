import { parse, type MathNode, type ConstantNode, type SymbolNode, type OperatorNode, type FunctionNode, type ParenthesisNode } from 'mathjs/number';
import Interval from 'interval-arithmetic';

export type Bounds = { lo: number; hi: number };
type Value = number | Bounds;
type Operation = { number: (...args: number[]) => number; interval: (...args: Bounds[]) => Bounds; arity: number };
const unary = (number: (x: number) => number, interval: (x: Bounds) => Bounds): Operation => ({ number, interval, arity: 1 });
const binary = (number: (x: number, y: number) => number, interval: (x: Bounds, y: Bounds) => Bounds): Operation => ({ number, interval, arity: 2 });
const power = (x: Bounds, y: Bounds): Bounds => {
  if (y.lo === y.hi && Number.isSafeInteger(y.lo)) return Interval.pow(x, y.lo);
  // interval-arithmetic's integer-only pow cannot handle exponential/fractional powers.
  // Compose its real-domain log/exp operations for nonnegative bases instead.
  return Interval.exp(Interval.mul(Interval.log(x), y));
};
const operators: Record<string, Operation> = {
  add: binary((a, b) => a + b, Interval.add), subtract: binary((a, b) => a - b, Interval.sub),
  multiply: binary((a, b) => a * b, Interval.mul), divide: binary((a, b) => a / b, Interval.div),
  pow: binary(Math.pow, power), unaryMinus: unary((x) => -x, Interval.negative), unaryPlus: unary((x) => x, Interval.positive),
};
const functions: Record<string, Operation> = Object.fromEntries([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
  'exp', 'log', 'log10', 'log2', 'sqrt', 'abs',
].map((name) => [name, unary(Math[name as keyof Math] as (x: number) => number, Interval[name])]));
functions.ln = functions.log;
functions.cbrt = unary(Math.cbrt, (x) => Interval.nthRoot(x, 3));
const constants: Record<string, number> = { pi: Math.PI, e: Math.E };
type Scope = { x: Value; interval: boolean };
type Evaluate = (scope: Scope) => Value;

/** mathjs supplies the parser. Only this bounded numeric AST subset is interpreted;
 * no mathjs evaluate/compile, object access, model-provided code or dynamic codegen. */
function prepare(expression: string, parameters: Record<string, number>): Evaluate {
  if (expression.length < 1 || expression.length > 256 || !/^[\da-zA-Z+\-*/^().,\s]+$/.test(expression)
    || Object.keys(parameters).some((key) => !/^[a-dpq]$/.test(key))
    || Object.values(parameters).some((value) => !Number.isFinite(value) || Math.abs(value) > 10_000)) throw new Error('Invalid expression');
  let count = 0;
  const visit = (node: MathNode, depth: number): Evaluate => {
    if (++count > 64 || depth > 16) throw new Error('Expression is too complex');
    if (node.type === 'ConstantNode') {
      const value = (node as ConstantNode).value;
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Only finite numeric constants are supported');
      return (scope) => scope.interval ? Interval.factory(value) : value;
    }
    if (node.type === 'SymbolNode') {
      const name = (node as SymbolNode).name;
      if (name === 'x') return (scope) => scope.x;
      const value = Object.hasOwn(constants, name) ? constants[name] : Object.hasOwn(parameters, name) ? parameters[name] : undefined;
      if (value === undefined) throw new Error('Unknown variable');
      return (scope) => scope.interval ? Interval.factory(value) : value;
    }
    if (node.type === 'ParenthesisNode') return visit((node as ParenthesisNode).content, depth + 1);
    let operation: Operation | undefined; let args: MathNode[];
    if (node.type === 'OperatorNode') {
      const operator = node as OperatorNode;
      operation = Object.hasOwn(operators, operator.fn) ? operators[operator.fn] : undefined;
      args = operator.args;
    } else if (node.type === 'FunctionNode') {
      const fn = node as FunctionNode;
      const name = fn.fn.type === 'SymbolNode' ? (fn.fn as SymbolNode).name : '';
      operation = Object.hasOwn(functions, name) ? functions[name] : undefined;
      args = fn.args;
    } else throw new Error('Unsupported mathematical syntax');
    if (!operation || args.length !== operation.arity) throw new Error('Unsupported function or operator');
    const evaluate = args.map((arg) => visit(arg, depth + 1));
    const op = operation;
    return (scope) => {
      const values = evaluate.map((fn) => fn(scope));
      return scope.interval ? op.interval(...values as Bounds[]) : op.number(...values as number[]);
    };
  };
  return visit(parse(expression), 0);
}

export function validateExpression(expression: string, keys: string[]): boolean {
  try { prepare(expression, Object.fromEntries(keys.map((key) => [key, 0]))); return true; }
  catch { return false; }
}

export interface PlotEvaluator {
  (scope: { x: number }): number;
  (scope: { x: Bounds }): Bounds;
}
export function createPlotEvaluator(expression: string, parameters: Record<string, number>): PlotEvaluator {
  const evaluate = prepare(expression, parameters);
  return (({ x }: { x: Value }) => {
    const result = evaluate({ x: typeof x === 'number' ? x : Interval.factory(x.lo, x.hi), interval: typeof x !== 'number' });
    // Upstream treats nonfinite lower/upper bounds as opposite infinities when
    // clipping. A same-sign overflow contains no representable real ordinate.
    if (typeof result !== 'number' && result.lo === result.hi && !Number.isFinite(result.lo)) return Interval.EMPTY;
    return result;
  }) as PlotEvaluator;
}
