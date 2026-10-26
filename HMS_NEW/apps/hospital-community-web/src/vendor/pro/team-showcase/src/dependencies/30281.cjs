// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  u: () => s
});
var n = require("./27994.cjs");
let s = {
  test: (0, require("./82163.cjs").$)("#"),
  parse: function (t) {
    let e = "",
      i = "",
      n = "",
      s = "";
    return t.length > 5 ? (e = t.substring(1, 3), i = t.substring(3, 5), n = t.substring(5, 7), s = t.substring(7, 9)) : (e = t.substring(1, 2), i = t.substring(2, 3), n = t.substring(3, 4), s = t.substring(4, 5), e += e, i += i, n += n, s += s), {
      red: parseInt(e, 16),
      green: parseInt(i, 16),
      blue: parseInt(n, 16),
      alpha: s ? parseInt(s, 16) / 255 : 1
    };
  },
  transform: n.B.transform
};
