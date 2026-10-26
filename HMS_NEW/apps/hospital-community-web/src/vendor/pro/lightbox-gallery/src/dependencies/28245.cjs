// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  d: () => i
});
var r = require("./6900.cjs"),
  o = require("react"),
  l = require("./24866.cjs"),
  u = require("./28819.cjs");
function i(e) {
  let t = (0, u.M)(() => (0, r.OQ)(e)),
    {
      isStatic: n
    } = (0, o.useContext)(l.Q);
  if (n) {
    let [, n] = (0, o.useState)(e);
    (0, o.useEffect)(() => t.on("change", n), []);
  }
  return t;
}
