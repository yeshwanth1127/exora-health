// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
function n({
  top: t,
  left: e,
  right: i,
  bottom: s
}) {
  return {
    x: {
      min: e,
      max: i
    },
    y: {
      min: t,
      max: s
    }
  };
}
function s({
  x: t,
  y: e
}) {
  return {
    top: e.min,
    right: t.max,
    bottom: e.max,
    left: t.min
  };
}
function r(t, e) {
  if (!e) return t;
  let i = e({
      x: t.left,
      y: t.top
    }),
    n = e({
      x: t.right,
      y: t.bottom
    });
  return {
    top: i.y,
    left: i.x,
    bottom: n.y,
    right: n.x
  };
}
interop.d(exports, {
  FY: () => n,
  bS: () => r,
  pA: () => s
});
