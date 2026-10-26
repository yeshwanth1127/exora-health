// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  d: () => s
});
var n = require("./83399.cjs");
let s = {
  ...n.f,
  getAnimatableNone: t => {
    let e = n.f.parse(t);
    return n.f.createTransformer(t)(e.map(t => "number" == typeof t ? 0 : "object" == typeof t ? {
      ...t,
      alpha: 1
    } : t));
  }
};
