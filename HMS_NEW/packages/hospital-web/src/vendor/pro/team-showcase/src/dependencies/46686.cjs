// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
Object.defineProperty(exports, "__esModule", {
  value: !0
});
var i = {
  default: function () {
    return m;
  },
  defaultHead: function () {
    return c;
  }
};
for (var n in i) Object.defineProperty(exports, n, {
  enumerable: !0,
  get: i[n]
});
let a = require("./73623.cjs"),
  o = require("./66388.cjs"),
  l = require("react/jsx-runtime"),
  s = o._(require("react")),
  u = a._(require("./76899.cjs")),
  d = require("./75368.cjs");
function c() {
  return [(0, l.jsx)("meta", {
    charSet: "utf-8"
  }, "charset"), (0, l.jsx)("meta", {
    name: "viewport",
    content: "width=device-width"
  }, "viewport")];
}
function f(e, t) {
  return "string" == typeof t || "number" == typeof t ? e : t.type === s.default.Fragment ? e.concat(s.default.Children.toArray(t.props.children).reduce((e, t) => "string" == typeof t || "number" == typeof t ? e : e.concat(t), [])) : e.concat(t);
}
let p = ["name", "httpEquiv", "charSet", "itemProp"];
function g(e) {
  let t, r, i, n;
  return e.reduce(f, []).reverse().concat(c().reverse()).filter((t = new Set(), r = new Set(), i = new Set(), n = {}, e => {
    let a = !0,
      o = !1;
    if (e.key && "number" != typeof e.key && e.key.indexOf("$") > 0) {
      o = !0;
      let r = e.key.slice(e.key.indexOf("$") + 1);
      t.has(r) ? a = !1 : t.add(r);
    }
    switch (e.type) {
      case "title":
      case "base":
        r.has(e.type) ? a = !1 : r.add(e.type);
        break;
      case "meta":
        for (let t = 0, r = p.length; t < r; t++) {
          let r = p[t];
          if (e.props.hasOwnProperty(r)) if ("charSet" === r) i.has(r) ? a = !1 : i.add(r);else {
            let t = e.props[r],
              i = n[r] || new Set();
            ("name" !== r || !o) && i.has(t) ? a = !1 : (i.add(t), n[r] = i);
          }
        }
    }
    return a;
  })).reverse().map((e, t) => {
    let r = e.key || t;
    return s.default.cloneElement(e, {
      key: r
    });
  });
}
let m = function ({
  children: e
}) {
  let t = (0, s.useContext)(d.HeadManagerContext);
  return (0, l.jsx)(u.default, {
    reduceComponentsToState: g,
    headManager: t,
    children: e
  });
};
("function" == typeof exports.default || "object" == typeof exports.default && null !== exports.default) && void 0 === exports.default.__esModule && (Object.defineProperty(exports.default, "__esModule", {
  value: !0
}), Object.assign(exports.default, exports), module.exports = exports.default);
