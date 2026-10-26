// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  Uu: () => r
});
var n = require("./25620.cjs");
let s = "u" > typeof window;
function r() {
  if (n.r.current = !0, s) if (window.matchMedia) {
    let t = window.matchMedia("(prefers-reduced-motion)"),
      e = () => n.O.current = t.matches;
    t.addEventListener("change", e), e();
  } else n.O.current = !1;
}
