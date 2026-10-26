// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  G: () => function e(t, o, l, h) {
    if ("function" == typeof t) {
      let e;
      return n.bt.current = [], t(), e = (0, i.j)(n.bt.current, t), n.bt.current = void 0, e;
    }
    if (void 0 !== l && !Array.isArray(l) && "function" != typeof o) {
      var c = t,
        d = o,
        u = l,
        p = h;
      let a = (0, r.M)(() => Object.keys(u)),
        i = (0, r.M)(() => ({}));
      for (let t of a) i[t] = e(c, d, u[t], p);
      return i;
    }
    let g = "function" == typeof o ? o : function (...e) {
        let t = !Array.isArray(e[0]),
          o = t ? 0 : -1,
          r = e[0 + o],
          i = e[1 + o],
          n = e[2 + o],
          s = e[3 + o],
          l = (0, a.G)(i, n, s);
        return t ? l(r) : l;
      }(o, l, h),
      y = Array.isArray(t) ? s(t, g) : s([t], ([e]) => g(e)),
      m = Array.isArray(t) ? void 0 : t.accelerate;
    return m && !m.isTransformed && "function" != typeof o && Array.isArray(l) && h?.clamp !== !1 && (y.accelerate = {
      ...m,
      times: o,
      keyframes: l,
      isTransformed: !0,
      ...(h?.ease ? {
        ease: h.ease
      } : {})
    }), y;
  }
});
var a = require("./21649.cjs"),
  r = require("./28819.cjs"),
  i = require("./71013.cjs"),
  n = require("./6900.cjs");
function s(e, t) {
  let o = (0, r.M)(() => []);
  return (0, i.j)(e, () => {
    o.length = 0;
    let a = e.length;
    for (let t = 0; t < a; t++) o[t] = e[t].get();
    return t(o);
  });
}
