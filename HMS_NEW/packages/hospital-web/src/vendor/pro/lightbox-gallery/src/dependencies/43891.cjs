// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  x: () => r
});
var n = require("./51469.cjs"),
  s = require("./19274.cjs");
function r(t, e, i) {
  let r = t.style,
    o = e?.style,
    a = {};
  if (!r) return a;
  for (let e in r) ((0, n.S)(r[e]) || o && (0, n.S)(o[e]) || (0, s.zK)(e, t) || i?.getValue(e)?.liveStyle !== void 0) && (a[e] = r[e]);
  return a;
}
