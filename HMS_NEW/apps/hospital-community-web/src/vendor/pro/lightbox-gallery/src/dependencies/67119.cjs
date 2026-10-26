// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  U: () => o
});
var n = require("./6900.cjs"),
  s = require("./33140.cjs"),
  r = require("./91909.cjs");
function o(t, e) {
  let {
    transitionEnd: i = {},
    transition: o = {},
    ...a
  } = (0, s.K)(t, e) || {};
  for (let e in a = {
    ...a,
    ...i
  }) {
    var l;
    let i = (l = a[e], (0, r.p)(l) ? l[l.length - 1] || 0 : l);
    t.hasValue(e) ? t.getValue(e).set(i) : t.addValue(e, (0, n.OQ)(i));
  }
}
