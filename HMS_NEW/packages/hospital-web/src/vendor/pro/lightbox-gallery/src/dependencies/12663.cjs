// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  L: () => n
});
function n(t, e, i, s = 0, r = 1) {
  let o = Array.from(t).sort((t, e) => t.sortNodePosition(e)).indexOf(e),
    a = t.size,
    l = (a - 1) * s;
  return "function" == typeof i ? i(o, a) : 1 === r ? o * s : l - o * s;
}
