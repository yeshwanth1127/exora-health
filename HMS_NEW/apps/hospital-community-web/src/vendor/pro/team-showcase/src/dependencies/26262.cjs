// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  X: () => r
});
var n = require("./38621.cjs"),
  s = require("./17964.cjs");
function r(t, e = 100, i) {
  let o = i({
      ...t,
      keyframes: [0, e]
    }),
    a = Math.min((0, s.t)(o), s.Y);
  return {
    type: "keyframes",
    ease: t => o.next(a * t).value / e,
    duration: (0, n.X)(a)
  };
}
