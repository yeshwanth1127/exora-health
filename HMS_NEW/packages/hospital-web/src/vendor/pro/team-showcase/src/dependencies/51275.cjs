// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
let n, s;
interop.d(exports, {
  X: () => m
});
var r = require("./69028.cjs"),
  o = require("./58392.cjs");
let a = new WeakMap(),
  l = (t, e, i) => (n, s) => s && s[0] ? s[0][t + "Size"] : (0, r.x)(n) && "getBBox" in n ? n.getBBox()[e] : n[i],
  h = l("inline", "width", "offsetWidth"),
  u = l("block", "height", "offsetHeight");
function d({
  target: t,
  borderBoxSize: e
}) {
  a.get(t)?.forEach(i => {
    i(t, {
      get width() {
        return h(t, e);
      },
      get height() {
        return u(t, e);
      }
    });
  });
}
function c(t) {
  t.forEach(d);
}
let p = new Set();
function m(t, e) {
  let i;
  return "function" == typeof t ? (p.add(t), s || (s = () => {
    let t = {
      get width() {
        return window.innerWidth;
      },
      get height() {
        return window.innerHeight;
      }
    };
    p.forEach(e => e(t));
  }, window.addEventListener("resize", s)), () => {
    p.delete(t), p.size || "function" != typeof s || (window.removeEventListener("resize", s), s = void 0);
  }) : (!n && "u" > typeof ResizeObserver && (n = new ResizeObserver(c)), (i = (0, o.K)(t)).forEach(t => {
    let i = a.get(t);
    i || (i = new Set(), a.set(t, i)), i.add(e), n?.observe(t);
  }), () => {
    i.forEach(t => {
      let i = a.get(t);
      i?.delete(e), i?.size || n?.unobserve(t);
    });
  });
}
