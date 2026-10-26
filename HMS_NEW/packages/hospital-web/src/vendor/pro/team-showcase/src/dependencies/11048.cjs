// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  KN: () => r,
  gQ: () => h,
  px: () => o,
  uj: () => s,
  vh: () => a,
  vw: () => l
});
let n = t => ({
    test: e => "string" == typeof e && e.endsWith(t) && 1 === e.split(" ").length,
    parse: parseFloat,
    transform: e => `${e}${t}`
  }),
  s = n("deg"),
  r = n("%"),
  o = n("px"),
  a = n("vh"),
  l = n("vw"),
  h = {
    ...r,
    parse: t => r.parse(t) / 100,
    transform: t => r.transform(100 * t)
  };
