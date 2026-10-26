// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
function n(t) {
  let e = [{}, {}];
  return t?.values.forEach((t, i) => {
    e[0][i] = t.get(), e[1][i] = t.getVelocity();
  }), e;
}
function s(t, e, i, s) {
  if ("function" == typeof e) {
    let [r, o] = n(s);
    e = e(void 0 !== i ? i : t.custom, r, o);
  }
  if ("string" == typeof e && (e = t.variants && t.variants[e]), "function" == typeof e) {
    let [r, o] = n(s);
    e = e(void 0 !== i ? i : t.custom, r, o);
  }
  return e;
}
interop.d(exports, {
  a: () => s
});
