// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  Ib: () => c,
  ry: () => d,
  zs: () => u
});
let n = t => 180 * t / Math.PI,
  s = t => o(n(Math.atan2(t[1], t[0]))),
  r = {
    x: 4,
    y: 5,
    translateX: 4,
    translateY: 5,
    scaleX: 0,
    scaleY: 3,
    scale: t => (Math.abs(t[0]) + Math.abs(t[3])) / 2,
    rotate: s,
    rotateZ: s,
    skewX: t => n(Math.atan(t[1])),
    skewY: t => n(Math.atan(t[2])),
    skew: t => (Math.abs(t[1]) + Math.abs(t[2])) / 2
  },
  o = t => ((t %= 360) < 0 && (t += 360), t),
  a = t => Math.sqrt(t[0] * t[0] + t[1] * t[1]),
  l = t => Math.sqrt(t[4] * t[4] + t[5] * t[5]),
  h = {
    x: 12,
    y: 13,
    z: 14,
    translateX: 12,
    translateY: 13,
    translateZ: 14,
    scaleX: a,
    scaleY: l,
    scale: t => (a(t) + l(t)) / 2,
    rotateX: t => o(n(Math.atan2(t[6], t[5]))),
    rotateY: t => o(n(Math.atan2(-t[2], t[0]))),
    rotateZ: s,
    rotate: s,
    skewX: t => n(Math.atan(t[4])),
    skewY: t => n(Math.atan(t[1])),
    skew: t => (Math.abs(t[1]) + Math.abs(t[4])) / 2
  };
function u(t) {
  return +!!t.includes("scale");
}
function d(t, e) {
  let i, n;
  if (!t || "none" === t) return u(e);
  let s = t.match(/^matrix3d\(([-\d.e\s,]+)\)$/u);
  if (s) i = h, n = s;else {
    let e = t.match(/^matrix\(([-\d.e\s,]+)\)$/u);
    i = r, n = e;
  }
  if (!n) return u(e);
  let o = i[e],
    a = n[1].split(",").map(p);
  return "function" == typeof o ? o(a) : a[o];
}
let c = (t, e) => {
  let {
    transform: i = "none"
  } = getComputedStyle(t);
  return d(i, e);
};
function p(t) {
  return parseFloat(t.trim());
}
