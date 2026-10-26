// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
let n;
interop.d(exports, {
  k: () => a
});
var s = require("./28153.cjs"),
  r = require("./27933.cjs");
function o() {
  n = void 0;
}
let a = {
  now: () => (void 0 === n && a.set(r.uv.isProcessing || s.W.useManualTiming ? r.uv.timestamp : performance.now()), n),
  set: t => {
    n = t, queueMicrotask(o);
  }
};
