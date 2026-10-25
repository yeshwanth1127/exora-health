// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  x: () => o
});
var n = require("./51469.cjs"),
  s = require("./25952.cjs"),
  r = require("./43891.cjs");
function o(t, e, i) {
  let o = (0, r.x)(t, e, i);
  for (let i in t) ((0, n.S)(t[i]) || (0, n.S)(e[i])) && (o[-1 !== s.U.indexOf(i) ? "attr" + i.charAt(0).toUpperCase() + i.substring(1) : i] = t[i]);
  return o;
}
