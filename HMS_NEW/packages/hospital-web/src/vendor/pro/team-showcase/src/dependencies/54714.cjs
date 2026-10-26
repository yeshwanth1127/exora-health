// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  O: () => h
});
var n = require("./87546.cjs"),
  s = require("./29543.cjs"),
  r = require("./25952.cjs"),
  o = require("./39896.cjs");
let a = {
    x: "translateX",
    y: "translateY",
    z: "translateZ",
    transformPerspective: "perspective"
  },
  l = r.U.length;
function h(t, e, i) {
  let {
      style: h,
      vars: u,
      transformOrigin: d
    } = t,
    c = !1,
    p = !1;
  for (let t in e) {
    let i = e[t];
    if (r.f.has(t)) {
      c = !0;
      continue;
    }
    if ((0, o.j4)(t)) {
      u[t] = i;
      continue;
    }
    {
      let e = (0, n.e)(i, s.W[t]);
      t.startsWith("origin") ? (p = !0, d[t] = e) : h[t] = e;
    }
  }
  if (!e.transform && (c || i ? h.transform = function (t, e, i) {
    let o = "",
      h = !0;
    for (let u = 0; u < l; u++) {
      let l = r.U[u],
        d = t[l];
      if (void 0 === d) continue;
      let c = !0;
      if ("number" == typeof d) c = d === +!!l.startsWith("scale");else {
        let t = parseFloat(d);
        c = l.startsWith("scale") ? 1 === t : 0 === t;
      }
      if (!c || i) {
        let t = (0, n.e)(d, s.W[l]);
        if (!c) {
          h = !1;
          let e = a[l] || l;
          o += `${e}(${t}) `;
        }
        i && (e[l] = t);
      }
    }
    let u = t.pathRotation;
    return u && (h = !1, o += `rotate(${(0, n.e)(u, s.W.pathRotation)}) `), o = o.trim(), i ? o = i(e, h ? "" : o) : h && (o = "none"), o;
  }(e, t.transform, i) : h.transform && (h.transform = "none")), p) {
    let {
      originX: t = "50%",
      originY: e = "50%",
      originZ: i = 0
    } = d;
    h.transformOrigin = `${t} ${e} ${i}`;
  }
}
