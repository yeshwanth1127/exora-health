// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  X: () => s
});
let n = t => null !== t;
function s(t, {
  repeat: e,
  repeatType: i = "loop"
}, r, o = 1) {
  let a = t.filter(n),
    l = o < 0 || e && "loop" !== i && e % 2 == 1 ? 0 : a.length - 1;
  return l && void 0 !== r ? r : a[l];
}
