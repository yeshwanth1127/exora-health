// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  y: () => o
});
var n = require("./30281.cjs"),
  s = require("./88158.cjs"),
  r = require("./27994.cjs");
let o = {
  test: t => r.B.test(t) || n.u.test(t) || s.V.test(t),
  parse: t => r.B.test(t) ? r.B.parse(t) : s.V.test(t) ? s.V.parse(t) : n.u.parse(t),
  transform: t => "string" == typeof t ? t : t.hasOwnProperty("red") ? r.B.transform(t) : s.V.transform(t),
  getAnimatableNone: t => {
    let e = o.parse(t);
    return e.alpha = 0, o.transform(e);
  }
};
