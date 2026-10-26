// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  K: () => n
});
function n(t, e, i) {
  if (null == t) return [];
  if (t instanceof EventTarget) return [t];
  if ("string" == typeof t) {
    let n = document;
    e && (n = e.current);
    let s = i?.[t] ?? n.querySelectorAll(t);
    return s ? Array.from(s) : [];
  }
  return Array.from(t).filter(t => null != t);
}
