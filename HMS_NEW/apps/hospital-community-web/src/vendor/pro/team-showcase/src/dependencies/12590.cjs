// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
function r({
  widthInt: e,
  heightInt: t,
  blurWidth: i,
  blurHeight: n,
  blurDataURL: a,
  objectFit: o
}) {
  let l = i ? 40 * i : e,
    s = n ? 40 * n : t,
    u = l && s ? `viewBox='0 0 ${l} ${s}'` : "";
  return `%3Csvg xmlns='http://www.w3.org/2000/svg' ${u}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='${u ? "none" : "contain" === o ? "xMidYMid" : "cover" === o ? "xMidYMid slice" : "none"}' style='filter: url(%23b);' href='${a}'/%3E%3C/svg%3E`;
}
Object.defineProperty(exports, "__esModule", {
  value: !0
}), Object.defineProperty(exports, "getImageBlurSvg", {
  enumerable: !0,
  get: function () {
    return r;
  }
});
