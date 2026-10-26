// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  K: () => c
});
var n = require("./5556.cjs"),
  s = require("./72025.cjs"),
  r = require("./25903.cjs"),
  o = require("./1406.cjs"),
  a = require("./89722.cjs"),
  l = require("./25505.cjs"),
  h = require("./8441.cjs"),
  u = require("./9331.cjs");
let d = {
    linear: s.l,
    easeIn: h.a6,
    easeInOut: h.am,
    easeOut: h.vT,
    circIn: a.po,
    circInOut: a.tn,
    circOut: a.yT,
    backIn: o.dg,
    backInOut: o.ZZ,
    backOut: o.Sz,
    anticipate: r.b
  },
  c = t => {
    if ((0, u.D)(t)) {
      (0, n.V)(4 === t.length, "Cubic bezier arrays must contain four numerical values.", "cubic-bezier-length");
      let [e, i, s, r] = t;
      return (0, l.A)(e, i, s, r);
    }
    return "string" == typeof t ? ((0, n.V)(void 0 !== d[t], `Invalid easing type '${t}'`, "invalid-easing-type"), d[t]) : t;
  };
