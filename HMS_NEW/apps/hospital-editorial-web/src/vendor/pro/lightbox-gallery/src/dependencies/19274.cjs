// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  zK: () => r
});
var n = require("./25952.cjs"),
  s = require("./21872.cjs");
function r(t, {
  layout: e,
  layoutId: i
}) {
  return n.f.has(t) || t.startsWith("origin") || (e || void 0 !== i) && (!!s.H[t] || "opacity" === t);
}
