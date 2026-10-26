// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  G: () => u
});
var n = require("./28153.cjs"),
  s = require("./72025.cjs"),
  r = require("./34017.cjs"),
  o = require("./5556.cjs"),
  a = require("./18844.cjs"),
  l = require("./94712.cjs"),
  h = require("./86075.cjs");
function u(t, e, {
  clamp: i = !0,
  ease: d,
  mixer: c
} = {}) {
  let p = t.length;
  if ((0, o.V)(p === e.length, "Both input and output ranges must be the same length", "range-length"), 1 === p) return () => e[0];
  if (2 === p && e[0] === e[1]) return () => e[1];
  let m = t[0] === t[1];
  t[0] > t[p - 1] && (t = [...t].reverse(), e = [...e].reverse());
  let f = function (t, e, i) {
      let o = [],
        a = i || n.W.mix || h.j,
        l = t.length - 1;
      for (let i = 0; i < l; i++) {
        let n = a(t[i], t[i + 1]);
        if (e) {
          let t = Array.isArray(e) ? e[i] || s.l : e;
          n = (0, r.F)(t, n);
        }
        o.push(n);
      }
      return o;
    }(e, d, c),
    v = f.length,
    y = i => {
      if (m && i < t[0]) return e[0];
      let n = 0;
      if (v > 1) for (; n < t.length - 2 && !(i < t[n + 1]); n++);
      let s = (0, a.q)(t[n], t[n + 1], i);
      return f[n](s);
    };
  return i ? e => y((0, l.q)(t[0], t[p - 1], e)) : y;
}
