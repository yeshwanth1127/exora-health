// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  j: () => n
});
var a = require("./27933.cjs"),
  r = require("./65239.cjs"),
  i = require("./28245.cjs");
function n(e, t) {
  let o = (0, i.d)(t()),
    n = () => o.set(t());
  return n(), (0, r.E)(() => {
    let t = () => a.Gt.preRender(n, !1, !0),
      o = e.map(e => e.on("change", t));
    return () => {
      o.forEach(e => e()), (0, a.WG)(n);
    };
  }), o;
}
