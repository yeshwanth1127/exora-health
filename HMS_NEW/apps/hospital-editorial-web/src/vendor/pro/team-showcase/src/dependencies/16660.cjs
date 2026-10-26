// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  i: () => d
});
var n = require("./8441.cjs"),
  s = require("./85843.cjs"),
  r = require("./72975.cjs"),
  o = require("./28153.cjs"),
  a = require("./94712.cjs"),
  l = require("./21649.cjs"),
  h = require("./86075.cjs"),
  u = require("./59337.cjs");
function d({
  duration: t = 300,
  keyframes: e,
  times: i,
  ease: c = "easeInOut"
}) {
  var p;
  let m = (0, s.h)(c) ? c.map(r.K) : (0, r.K)(c),
    f = {
      done: !1,
      value: e[0]
    };
  if (2 === e.length && !Array.isArray(m) && (!i || 2 !== i.length || 0 === i[0] && 1 === i[1])) {
    let [i, n] = e,
      s = i === n ? void 0 : (o.W.mix || h.j)(i, n);
    return {
      calculatedDuration: t,
      next: e => (f.value = s ? s(m(t > 0 ? (0, a.q)(0, 1, e / t) : 1)) : n, f.done = e >= t, f)
    };
  }
  let v = (p = i && i.length === e.length ? i : (0, u.Z)(e), p.map(e => e * t)),
    y = (0, l.G)(v, e, {
      ease: Array.isArray(m) ? m : e.map(() => m || n.am).splice(0, e.length - 1)
    });
  return {
    calculatedDuration: t,
    next: e => (f.value = y(e), f.done = e >= t, f)
  };
}
