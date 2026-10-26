// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  j4: () => s,
  pG: () => o,
  rm: () => l
});
let n = t => e => "string" == typeof e && e.startsWith(t),
  s = n("--"),
  r = n("var(--"),
  o = t => !!r(t) && a.test(t.split("/*")[0].trim()),
  a = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;
function l(t) {
  return "string" == typeof t && t.split("/*")[0].includes("var(--");
}
