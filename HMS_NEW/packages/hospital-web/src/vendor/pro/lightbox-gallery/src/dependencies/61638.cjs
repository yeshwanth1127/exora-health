// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  g: () => r
});
var n = require("./28153.cjs"),
  s = require("./51469.cjs");
function r(t, e) {
  let i = t.getValue("willChange");
  if ((0, s.S)(i) && i.add) return i.add(e);
  if (!i && n.W.WillChange) {
    let i = new n.W.WillChange("auto");
    t.addValue("willChange", i), i.add(e);
  }
}
