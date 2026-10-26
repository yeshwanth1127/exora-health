// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
function n(t) {
  return void 0 === t || 1 === t;
}
function s({
  scale: t,
  scaleX: e,
  scaleY: i
}) {
  return !n(t) || !n(e) || !n(i);
}
function r(t) {
  return s(t) || o(t) || t.z || t.rotate || t.rotateX || t.rotateY || t.skewX || t.skewY;
}
function o(t) {
  var e, i;
  return (e = t.x) && "0%" !== e || (i = t.y) && "0%" !== i;
}
interop.d(exports, {
  HD: () => r,
  vF: () => o,
  vk: () => s
});
