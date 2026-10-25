// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  U: () => o,
  m: () => a
});
var n = require("./27933.cjs"),
  s = require("./37035.cjs");
function r(t, e) {
  return {
    kind: t,
    animation: e,
    timestamp: s.k.now(),
    frameTimestamp: n.uv.timestamp,
    frameIsProcessing: n.uv.isProcessing
  };
}
function o(t, e, i) {
  let n = globalThis.__MOTION_INSPECT__;
  if (n) try {
    n({
      ...r("animation-start", t),
      options: i ? {
        ...e,
        ...i
      } : e
    });
  } catch {}
}
function a(t, e) {
  let i = globalThis.__MOTION_INSPECT__;
  if (i) try {
    i({
      ...r("layout-animation-start", t),
      node: e
    });
  } catch {}
}
