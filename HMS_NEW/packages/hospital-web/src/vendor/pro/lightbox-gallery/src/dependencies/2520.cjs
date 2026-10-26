// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  W: () => u,
  pv: () => o,
  sA: () => s
});
var r = require("react/jsx-runtime"),
  n = require("react");
let a = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%"
  },
  l = (0, n.createContext)({
    link: function (e) {
      return (0, r.jsx)("a", {
        ...e
      });
    },
    image: function ({
      alt: e,
      fill: t,
      priority: i,
      loading: n,
      style: l,
      ...s
    }) {
      return (0, r.jsx)("img", {
        alt: e,
        decoding: "async",
        ...s,
        loading: n ?? (i ? "eager" : "lazy"),
        fetchPriority: i ? "high" : s.fetchPriority,
        style: t ? {
          ...a,
          ...l
        } : l
      });
    }
  });
function s({
  link: e,
  image: t,
  children: i
}) {
  let a = (0, n.useContext)(l),
    o = (0, n.useMemo)(() => ({
      link: e ?? a.link,
      image: t ?? a.image
    }), [e, t, a]);
  return (0, r.jsx)(l.Provider, {
    value: o,
    children: i
  });
}
function o(e) {
  return (0, n.createElement)((0, n.useContext)(l).link, e);
}
function u(e) {
  return (0, n.createElement)((0, n.useContext)(l).image, e);
}
