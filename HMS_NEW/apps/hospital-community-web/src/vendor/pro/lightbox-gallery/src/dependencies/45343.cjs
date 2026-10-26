// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  Y: () => s
});
var n = require("./79537.cjs");
function s(t, e, i = 0) {
  var r, o;
  let a;
  return e <= 0 ? i : t.velocity ? t.velocity(e) : (r = e => t.next(e).value, o = t.next(e).value, a = Math.max(e - 5, 0), (0, n.f)(o - r(a), e - a));
}
