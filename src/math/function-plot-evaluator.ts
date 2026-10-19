import Interval from 'interval-arithmetic';

// function-plot accepts trusted callbacks. Exclude its unused string-to-JS
// compilers from the extension bundle rather than relaxing MV3's CSP.
function rejectStringCompilation(): never { throw new Error('Use a validated plot callback'); }
const evaluator = Object.assign(rejectStringCompilation, {
  Interval,
  policies: { disableRounding: () => Interval.round.disable(), enableRounding: () => Interval.round.enable() },
});
export { Interval };
export default evaluator;
