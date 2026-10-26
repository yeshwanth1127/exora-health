// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  Q: () => s
});
let n = ["animate", "circle", "defs", "desc", "ellipse", "g", "image", "line", "filter", "marker", "mask", "metadata", "path", "pattern", "polygon", "polyline", "rect", "stop", "switch", "symbol", "svg", "text", "tspan", "use", "view"];
function s(t) {
  if ("string" != typeof t || t.includes("-")) ;else if (n.indexOf(t) > -1 || /[A-Z]/u.test(t)) return !0;
  return !1;
}
