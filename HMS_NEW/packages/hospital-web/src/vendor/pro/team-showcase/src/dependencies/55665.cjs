// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  q: () => n
});
var i = require("react");
function n(e = 1900) {
  let [a, t] = (0, i.useState)("idle"),
    [r, s] = (0, i.useState)(null),
    o = (0, i.useRef)(null),
    l = (0, i.useCallback)(() => {
      o.current && clearTimeout(o.current), o.current = null, t("idle"), s(null);
    }, []);
  return (0, i.useEffect)(() => () => {
    o.current && clearTimeout(o.current);
  }, []), {
    state: a,
    activeKey: r,
    copy: (0, i.useCallback)(async (a, i = "default") => {
      o.current && clearTimeout(o.current), s(i);
      try {
        return await navigator.clipboard.writeText(a), t("copied"), o.current = setTimeout(l, e), !0;
      } catch {
        return t("error"), o.current = setTimeout(l, e), !1;
      }
    }, [e, l]),
    reset: l
  };
}
