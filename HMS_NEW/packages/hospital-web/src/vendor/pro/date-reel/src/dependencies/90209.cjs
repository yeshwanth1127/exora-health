// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  default: () => a
});
var n = require("react");
let s = (...t) => t.filter((t, e, i) => !!t && "" !== t.trim() && i.indexOf(t) === e).join(" ").trim(),
  r = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  },
  o = (0, n.createContext)({}),
  a = (0, n.forwardRef)(({
    color: t,
    size: e,
    width: i,
    height: a,
    strokeWidth: l,
    absoluteStrokeWidth: h,
    nonScalingStroke: u,
    className: d = "",
    children: c,
    iconNode: p = [],
    icon: m = {
      node: p,
      aliases: [],
      size: 24
    },
    ...f
  }, v) => {
    let {
        size: y = 24,
        strokeWidth: g = 2,
        absoluteStrokeWidth: x = !1,
        nonScalingStroke: w = !1,
        color: S = "currentColor",
        className: b = ""
      } = (0, n.useContext)(o) ?? {},
      T = !!c || (t => {
        for (let e in t) if (e.startsWith("aria-") || "role" === e || "title" === e) return !0;
        return !1;
      })(f),
      [P, A, k = []] = function (t, e = {}) {
        return function (t, e = {}) {
          let i = e.attributeNames ?? {},
            n = t => i[t] ?? t,
            o = t.size ?? t.width ?? r.width,
            a = t.size ?? t.height ?? r.height,
            l = t.aliases?.filter(t => "string" == typeof t && "" !== t.trim()).map(t => `lucide-${t}`) ?? [],
            h = [...(t.name ? [`lucide-${t.name}`] : []), ...l],
            u = e.className?.split(" ").filter(Boolean) ?? [],
            d = !1 === e.includeDefaultClasses ? s(...u) : s("lucide", ...h, ...u),
            c = e.absoluteStrokeWidth ? Number(e.strokeWidth ?? r["stroke-width"]) * Number(t.size ?? t.width ?? r.width) / Number(e.size ?? e.width ?? r.width) : e.strokeWidth ?? r["stroke-width"];
          return ["svg", {
            ...Object.entries(r).reduce((t, [e, i]) => (t[n(e)] = i, t), {}),
            ...("color" in e && e.color && {
              [n("stroke")]: e.color
            }),
            ...("size" in e && null != e.size && {
              [n("width")]: e.size,
              [n("height")]: e.size
            }),
            ...("width" in e && null != e.width && {
              [n("width")]: e.width
            }),
            ...("height" in e && null != e.height && {
              [n("height")]: e.height
            }),
            [n("stroke-width")]: c,
            ...(d && {
              [n("class")]: d
            }),
            [n("viewBox")]: `0 0 ${o} ${a}`,
            ...(!1 === e.hasA11yProp ? {
              [n("aria-hidden")]: "true"
            } : {}),
            ...("attributes" in e && e.attributes)
          }, t.node.map(t => {
            let [i, s, r] = t,
              o = e.nonScalingStroke ? {
                [n("vector-effect")]: "non-scaling-stroke",
                ...s
              } : s;
            return r ? [i, o, r] : [i, o];
          })];
        }(t, {
          ...e,
          attributeNames: {
            ...e.attributeNames,
            class: "className",
            "stroke-width": "strokeWidth",
            "stroke-linecap": "strokeLinecap",
            "stroke-linejoin": "strokeLinejoin",
            "vector-effect": "vectorEffect"
          }
        });
      }(m, {
        color: t ?? S,
        width: i ?? e ?? y,
        height: a ?? e ?? y,
        strokeWidth: l ?? g,
        absoluteStrokeWidth: h ?? x,
        nonScalingStroke: u ?? w,
        className: s(b, d),
        hasA11yProp: T,
        attributes: f
      });
    return (0, n.createElement)(P, {
      ref: v,
      ...A
    }, [...k.map(([t, e]) => (0, n.createElement)(t, e)), ...(Array.isArray(c) ? c : [c])]);
  });
