// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  $: () => r,
  q: () => o
});
var n = require("./21620.cjs");
let s = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu,
  r = (t, e) => i => !!("string" == typeof i && s.test(i) && i.startsWith(t) || e && null != i && Object.prototype.hasOwnProperty.call(i, e)),
  o = (t, e, i) => s => {
    if ("string" != typeof s) return s;
    let [r, o, a, l] = s.match(n.S);
    return {
      [t]: parseFloat(r),
      [e]: parseFloat(o),
      [i]: parseFloat(a),
      alpha: void 0 !== l ? parseFloat(l) : 1
    };
  };
