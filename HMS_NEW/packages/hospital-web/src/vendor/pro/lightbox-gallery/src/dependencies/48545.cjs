// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  p: () => l
});
var n = require("./83399.cjs"),
  s = require("./21620.cjs");
let r = new Set(["brightness", "contrast", "saturate", "opacity"]);
function o(t) {
  let [e, i] = t.slice(0, -1).split("(");
  if ("drop-shadow" === e) return t;
  let [n] = i.match(s.S) || [];
  if (!n) return t;
  let o = i.replace(n, ""),
    a = +!!r.has(e);
  return n !== i && (a *= 100), e + "(" + a + o + ")";
}
let a = /\b([a-z-]*)\(.*?\)/gu,
  l = {
    ...n.f,
    getAnimatableNone: t => {
      let e = t.match(a);
      return e ? e.map(o).join(" ") : t;
    }
  };
