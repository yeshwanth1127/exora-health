// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  L: () => o,
  m: () => r
});
var n = require("./27669.cjs"),
  s = require("./2988.cjs");
function r(t, e) {
  return (0, n.FY)((0, n.bS)(t.getBoundingClientRect(), e));
}
function o(t, e, i) {
  let n = r(t, i),
    {
      scroll: o
    } = e;
  return o && ((0, s.Ql)(n.x, o.offset.x), (0, s.Ql)(n.y, o.offset.y)), n;
}
