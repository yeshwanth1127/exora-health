// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  O: () => a,
  e: () => o
});
var n = require("./26087.cjs"),
  s = require("./63290.cjs"),
  r = require("./51129.cjs");
function o(t) {
  if ((0, n.N)(t.animate)) return !0;
  for (let e = 0; e < r._.length; e++) if ((0, s.w)(t[r._[e]])) return !0;
  return !1;
}
function a(t) {
  return !!(o(t) || t.variants);
}
