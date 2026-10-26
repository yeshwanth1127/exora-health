// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  K: () => n
});
let n = (t, e, i = 10) => {
  let n = "",
    s = Math.max(Math.round(e / i), 2);
  for (let e = 0; e < s; e++) n += Math.round(1e4 * t(e / (s - 1))) / 1e4 + ", ";
  return `linear(${n.substring(0, n.length - 2)})`;
};
