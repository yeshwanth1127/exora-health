// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
function r(e, t) {
  let r = e || 75;
  return t?.qualities?.length ? t.qualities.reduce((e, t) => Math.abs(t - r) < Math.abs(e - r) ? t : e, t.qualities[0]) : r;
}
Object.defineProperty(exports, "__esModule", {
  value: !0
}), Object.defineProperty(exports, "findClosestQuality", {
  enumerable: !0,
  get: function () {
    return r;
  }
});
