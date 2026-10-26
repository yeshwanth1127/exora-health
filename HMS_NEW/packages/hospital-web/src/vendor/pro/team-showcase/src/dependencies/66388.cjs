// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
function n(e) {
  if ("function" != typeof WeakMap) return null;
  var t = new WeakMap(),
    r = new WeakMap();
  return (n = function (e) {
    return e ? r : t;
  })(e);
}
function a(e, t) {
  if (!t && e && e.__esModule) return e;
  if (null === e || "object" != typeof e && "function" != typeof e) return {
    default: e
  };
  var r = n(t);
  if (r && r.has(e)) return r.get(e);
  var a = {
      __proto__: null
    },
    u = Object.defineProperty && Object.getOwnPropertyDescriptor;
  for (var l in e) if ("default" !== l && Object.prototype.hasOwnProperty.call(e, l)) {
    var o = u ? Object.getOwnPropertyDescriptor(e, l) : null;
    o && (o.get || o.set) ? Object.defineProperty(a, l, o) : a[l] = e[l];
  }
  return a.default = e, r && r.set(e, a), a;
}
interop.r(exports), interop.d(exports, {
  _: () => a
});
