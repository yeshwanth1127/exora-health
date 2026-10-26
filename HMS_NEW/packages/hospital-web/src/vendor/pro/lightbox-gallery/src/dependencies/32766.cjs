// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  E4: () => a,
  Hr: () => p,
  W9: () => u,
  dB: () => d
});
var n = require("./11698.cjs"),
  s = require("./25952.cjs"),
  r = require("./49637.cjs"),
  o = require("./11048.cjs");
let a = t => t === r.ai || t === o.px,
  l = new Set(["x", "y", "z"]),
  h = s.U.filter(t => !l.has(t));
function u(t) {
  let e = [];
  return h.forEach(i => {
    let n = t.getValue(i);
    if (void 0 !== n) {
      let t = n.get(),
        s = +!!i.startsWith("scale");
      if (t === s) return;
      e.push([i, t]), n.set(s);
    }
  }), e;
}
let d = new Set(["bottom", "right"]);
function c(t, e, i, n, s, r) {
  let o = parseFloat(t);
  if (!isNaN(o)) return o;
  let {
      min: a,
      max: l
    } = e()[i],
    h = l - a;
  return "border-box" === r ? h : h - parseFloat(n) - parseFloat(s);
}
let p = {
  width: ({
    width: t,
    paddingLeft: e = "0",
    paddingRight: i = "0",
    boxSizing: n
  }, s) => c(t, s, "x", e, i, n),
  height: ({
    height: t,
    paddingTop: e = "0",
    paddingBottom: i = "0",
    boxSizing: n
  }, s) => c(t, s, "y", e, i, n),
  top: ({
    top: t
  }) => parseFloat(t),
  left: ({
    left: t
  }) => parseFloat(t),
  bottom: ({
    top: t
  }, e) => {
    let {
      y: i
    } = e();
    return parseFloat(t) + (i.max - i.min);
  },
  right: ({
    left: t
  }, e) => {
    let {
      x: i
    } = e();
    return parseFloat(t) + (i.max - i.min);
  },
  x: ({
    transform: t
  }) => (0, n.ry)(t, "x"),
  y: ({
    transform: t
  }) => (0, n.ry)(t, "y")
};
p.translateX = p.x, p.translateY = p.y;
