// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
Object.defineProperty(exports, "__esModule", {
  value: !0
}), Object.defineProperty(exports, "useMergedRef", {
  enumerable: !0,
  get: function () {
    return o;
  }
});
let n = require("react");
function o(e, t) {
  let r = (0, n.useRef)(null),
    o = (0, n.useRef)(null);
  return (0, n.useCallback)(n => {
    if (null === n) {
      let e = r.current;
      e && (r.current = null, e());
      let t = o.current;
      t && (o.current = null, t());
    } else e && (r.current = u(e, n)), t && (o.current = u(t, n));
  }, [e, t]);
}
function u(e, t) {
  if ("function" != typeof e) return e.current = t, () => {
    e.current = null;
  };
  {
    let r = e(t);
    return "function" == typeof r ? r : () => e(null);
  }
}
("function" == typeof exports.default || "object" == typeof exports.default && null !== exports.default) && void 0 === exports.default.__esModule && (Object.defineProperty(exports.default, "__esModule", {
  value: !0
}), Object.assign(exports.default, exports), module.exports = exports.default);
