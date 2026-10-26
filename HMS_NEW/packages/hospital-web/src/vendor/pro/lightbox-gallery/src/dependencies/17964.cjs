// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  Y: () => n,
  t: () => s
});
let n = 2e4;
function s(t, e = 50, i = n, r) {
  let o = 0,
    a = t.next(o);
  for (r?.push(a.value); !a.done && o < i;) o += e, a = t.next(o), r?.push(a.value);
  return o >= i ? 1 / 0 : o;
}
