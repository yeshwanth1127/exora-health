// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  A: () => r
});
var n = require("react"),
  s = require("./90209.cjs");
function r(t, e = [], i = []) {
  let o,
    a = "string" == typeof t ? function (t, e, i = []) {
      if (null == e) throw Error("[lucide]: iconNode is required when icon name is used");
      return {
        name: t?.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
        size: 24,
        node: e,
        ...(i.length > 0 ? {
          aliases: i
        } : {})
      };
    }(t, e, i) : t,
    l = (0, n.forwardRef)(({
      className: t,
      ...e
    }, i) => (0, n.createElement)(s.default, {
      ref: i,
      icon: a,
      className: t,
      ...e
    }));
  return a.name && (l.displayName = (o = (t => {
    let e = "",
      i = !1;
    for (let n of t) {
      if ("-" === n || "_" === n || n <= " ") {
        i = e.length > 0;
        continue;
      }
      0 === e.length ? e += n.toLowerCase() : e += i ? n.toUpperCase() : n, i = !1;
    }
    return e;
  })(a.name)).charAt(0).toUpperCase() + o.slice(1)), l;
}
