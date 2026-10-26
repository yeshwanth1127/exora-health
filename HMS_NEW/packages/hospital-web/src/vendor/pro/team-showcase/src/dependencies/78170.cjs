// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
function n(t, e) {
  -1 === t.indexOf(e) && t.push(e);
}
function s(t, e) {
  let i = t.indexOf(e);
  i > -1 && t.splice(i, 1);
}
function r([...t], e, i) {
  let n = e < 0 ? t.length + e : e;
  if (n >= 0 && n < t.length) {
    let n = i < 0 ? t.length + i : i,
      [s] = t.splice(e, 1);
    t.splice(n, 0, s);
  }
  return t;
}
interop.d(exports, {
  Ai: () => s,
  Kq: () => n,
  Pe: () => r
});
