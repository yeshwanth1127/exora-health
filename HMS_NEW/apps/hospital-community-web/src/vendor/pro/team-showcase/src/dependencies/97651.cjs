// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
Object.defineProperty(exports, "__esModule", {
  value: !0
});
var t = {
  default: function () {
    return c;
  },
  getImageProps: function () {
    return d;
  }
};
for (var s in t) Object.defineProperty(exports, s, {
  enumerable: !0,
  get: t[s]
});
let o = require("./73623.cjs"),
  n = require("./95413.cjs"),
  r = require("./38437.cjs"),
  l = o._(require("./36095.cjs"));
function d(e) {
  let {
    props: a
  } = (0, n.getImgProps)(e, {
    defaultLoader: l.default,
    imgConf: {
      deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
      imageSizes: [32, 48, 64, 96, 128, 256, 384],
      qualities: [75],
      path: "",
      loader: "default",
      dangerouslyAllowSVG: !1,
      unoptimized: !0
    }
  });
  for (let [e, i] of Object.entries(a)) void 0 === i && delete a[e];
  return {
    props: a
  };
}
let c = r.Image;
