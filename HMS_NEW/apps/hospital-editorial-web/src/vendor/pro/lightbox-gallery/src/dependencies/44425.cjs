// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  B: () => a,
  W: () => o
});
var n = require("./54714.cjs");
let s = {
    offset: "stroke-dashoffset",
    array: "stroke-dasharray"
  },
  r = {
    offset: "strokeDashoffset",
    array: "strokeDasharray"
  },
  o = ["transform", "opacity", "offsetDistance", "offsetPath", "offsetRotate", "offsetAnchor"];
function a(t, {
  attrX: e,
  attrY: i,
  attrScale: l,
  pathLength: h,
  pathSpacing: u = 1,
  pathOffset: d = 0,
  ...c
}, p, m, f) {
  if ((0, n.O)(t, c, m), p) {
    t.style.viewBox && (t.attrs.viewBox = t.style.viewBox);
    return;
  }
  t.attrs = t.style, t.style = {};
  let {
    attrs: v,
    style: y
  } = t;
  for (let t of o) void 0 !== v[t] && (y[t] = v[t], delete v[t]);
  (y.transform || v.transformOrigin) && (y.transformOrigin = v.transformOrigin ?? "50% 50%", delete v.transformOrigin), y.transform && (y.transformBox = f?.transformBox ?? "fill-box", delete v.transformBox), void 0 !== e && (v.x = e), void 0 !== i && (v.y = i), void 0 !== l && (v.scale = l), void 0 !== h && function (t, e, i = 1, n = 0, o = !0) {
    t.pathLength = 1;
    let a = o ? s : r;
    t[a.offset] = `${-n}`, t[a.array] = `${e} ${i}`;
  }(v, h, u, d, !1);
}
