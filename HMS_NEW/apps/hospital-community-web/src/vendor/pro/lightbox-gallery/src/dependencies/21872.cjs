// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  H: () => h
});
var n = require("./33177.cjs"),
  s = require("./11048.cjs");
function r(t, e) {
  return e.max === e.min ? 0 : t / (e.max - e.min) * 100;
}
let o = {
  correct: (t, e) => {
    if (!e.target) return t;
    if ("string" == typeof t) if (!s.px.test(t)) return t;else t = parseFloat(t);
    let i = r(t, e.target.x),
      n = r(t, e.target.y);
    return `${i}% ${n}%`;
  }
};
var a = require("./83399.cjs"),
  l = require("./56260.cjs");
let h = {
  borderRadius: {
    ...o,
    applyTo: [...n.S]
  },
  borderTopLeftRadius: o,
  borderTopRightRadius: o,
  borderBottomLeftRadius: o,
  borderBottomRightRadius: o,
  boxShadow: {
    correct: (t, {
      treeScale: e,
      projectionDelta: i
    }) => {
      let n = a.f.parse(t);
      if (n.length > 5) return t;
      let s = a.f.createTransformer(t),
        r = +("number" != typeof n[0]),
        o = i.x.scale * e.x,
        h = i.y.scale * e.y;
      n[0 + r] /= o, n[1 + r] /= h;
      let u = (0, l.k)(o, h, .5);
      return "number" == typeof n[2 + r] && (n[2 + r] /= u), "number" == typeof n[3 + r] && (n[3 + r] /= u), s(n);
    }
  }
};
