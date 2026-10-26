// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  B: () => s
});
var n = require("./13031.cjs");
function s({
  keyframes: t,
  velocity: e = 0,
  power: i = .8,
  timeConstant: r = 325,
  bounceDamping: o = 10,
  bounceStiffness: a = 500,
  modifyTarget: l,
  min: h,
  max: u,
  restDelta: d = .5,
  restSpeed: c
}) {
  let p,
    m,
    f = t[0],
    v = {
      done: !1,
      value: f
    },
    y = i * e,
    g = f + y,
    x = void 0 === l ? g : l(g);
  x !== g && (y = x - f);
  let w = t => -y * Math.exp(-t / r),
    S = t => {
      let e = w(t);
      v.done = Math.abs(e) <= d, v.value = v.done ? x : x + e;
    },
    b = t => {
      let e;
      if ((e = v.value) < h || e > u) {
        var i;
        p = t, m = (0, n.o)({
          keyframes: [v.value, (i = v.value, void 0 === h ? u : void 0 === u || Math.abs(h - i) < Math.abs(u - i) ? h : u)],
          velocity: -w(t) / r * 1e3,
          damping: o,
          stiffness: a,
          restDelta: d,
          restSpeed: c
        });
      }
    };
  return b(0), {
    calculatedDuration: null,
    next: t => {
      let e = !1;
      return (m || void 0 !== p || (e = !0, S(t), b(t)), void 0 !== p && t >= p) ? m.next(t - p) : (e || S(t), v);
    }
  };
}
