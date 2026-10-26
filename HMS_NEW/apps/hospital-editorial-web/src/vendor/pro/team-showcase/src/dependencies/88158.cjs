// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  V: () => a
});
var n = require("./49637.cjs"),
  s = require("./11048.cjs"),
  r = require("./71939.cjs"),
  o = require("./82163.cjs");
let a = {
  test: (0, o.$)("hsl", "hue"),
  parse: (0, o.q)("hue", "saturation", "lightness"),
  transform: ({
    hue: t,
    saturation: e,
    lightness: i,
    alpha: o = 1
  }) => "hsla(" + Math.round(t) + ", " + s.KN.transform((0, r.a)(e)) + ", " + s.KN.transform((0, r.a)(i)) + ", " + (0, r.a)(n.X4.transform(o)) + ")"
};
