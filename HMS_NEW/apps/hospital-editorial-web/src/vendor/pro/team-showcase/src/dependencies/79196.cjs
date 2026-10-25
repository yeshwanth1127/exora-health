// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  tF: () => o,
  xQ: () => r
});
var n = require("react"),
  s = require("./15131.cjs");
function r(t = !0) {
  let e = (0, n.useContext)(s.t);
  if (null === e) return [!0, null];
  let {
      isPresent: i,
      onExitComplete: o,
      register: a
    } = e,
    l = (0, n.useId)();
  (0, n.useEffect)(() => {
    if (t) return a(l);
  }, [t]);
  let h = (0, n.useCallback)(() => t && o && o(l), [l, o, t]);
  return !i && o ? [!1, h] : [!0];
}
function o() {
  var t;
  return null === (t = (0, n.useContext)(s.t)) || t.isPresent;
}
