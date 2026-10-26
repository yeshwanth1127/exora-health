// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  B: () => l
});
var n = require("./94712.cjs"),
  s = require("./49637.cjs"),
  r = require("./71939.cjs"),
  o = require("./82163.cjs");
let a = {
    ...s.ai,
    transform: t => Math.round((0, n.q)(0, 255, t))
  },
  l = {
    test: (0, o.$)("rgb", "red"),
    parse: (0, o.q)("red", "green", "blue"),
    transform: ({
      red: t,
      green: e,
      blue: i,
      alpha: n = 1
    }) => "rgba(" + a.transform(t) + ", " + a.transform(e) + ", " + a.transform(i) + ", " + (0, r.a)(s.X4.transform(n)) + ")"
  };
