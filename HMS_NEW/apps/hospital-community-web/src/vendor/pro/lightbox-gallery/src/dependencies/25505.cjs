// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  A: () => r
});
var n = require("./72025.cjs");
let s = (t, e, i) => (((1 - 3 * i + 3 * e) * t + (3 * i - 6 * e)) * t + 3 * e) * t;
function r(t, e, i, r) {
  return t === e && i === r ? n.l : n => 0 === n || 1 === n ? n : s(function (t, e, i, n, r) {
    let o,
      a,
      l = 0;
    do (o = s(a = e + (i - e) / 2, n, r) - t) > 0 ? i = a : e = a; while (Math.abs(o) > 1e-7 && ++l < 12);
    return a;
  }(n, 0, 1, t, i), e, r);
}
