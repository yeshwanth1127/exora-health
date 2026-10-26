// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  j: () => k
});
var n = require("./71939.cjs"),
  s = require("./34017.cjs"),
  r = require("./5556.cjs"),
  o = require("./39896.cjs"),
  a = require("./77054.cjs"),
  l = require("./83399.cjs"),
  h = require("./30281.cjs"),
  u = require("./88158.cjs");
function d(t, e, i) {
  return (i < 0 && (i += 1), i > 1 && (i -= 1), i < 1 / 6) ? t + (e - t) * 6 * i : i < .5 ? e : i < 2 / 3 ? t + (e - t) * (2 / 3 - i) * 6 : t;
}
var c = require("./27994.cjs");
function p(t, e) {
  return i => i > 0 ? e : t;
}
var m = require("./56260.cjs");
let f = (t, e, i) => {
    let n = t * t,
      s = i * (e * e - n) + n;
    return s < 0 ? 0 : Math.sqrt(s);
  },
  v = [h.u, c.B, u.V];
function y(t) {
  let e = v.find(e => e.test(t));
  if (!e) return (0, r.$)(!1, `'${t}' is not an animatable color. Use the equivalent color code instead.`, "color-not-animatable"), !1;
  let i = e.parse(t);
  return e === u.V && (i = function ({
    hue: t,
    saturation: e,
    lightness: i,
    alpha: n
  }) {
    t /= 360, i /= 100;
    let s = 0,
      r = 0,
      o = 0;
    if (e /= 100) {
      let n = i < .5 ? i * (1 + e) : i + e - i * e,
        a = 2 * i - n;
      s = d(a, n, t + 1 / 3), r = d(a, n, t), o = d(a, n, t - 1 / 3);
    } else s = r = o = i;
    return {
      red: Math.round(255 * s),
      green: Math.round(255 * r),
      blue: Math.round(255 * o),
      alpha: n
    };
  }(i)), i;
}
let g = (t, e) => {
    let i = y(t),
      n = y(e);
    if (!i || !n) return p(t, e);
    let s = {
      ...i
    };
    return t => (s.red = f(i.red, n.red, t), s.green = f(i.green, n.green, t), s.blue = f(i.blue, n.blue, t), s.alpha = (0, m.k)(i.alpha, n.alpha, t), c.B.transform(s));
  },
  x = new Set(["none", "hidden"]);
function w(t, e) {
  return i => (0, m.k)(t, e, i);
}
function S(t) {
  return "number" == typeof t ? w : "string" == typeof t ? (0, o.pG)(t) ? p : a.y.test(t) ? g : P : Array.isArray(t) ? b : "object" == typeof t ? a.y.test(t) ? g : T : p;
}
function b(t, e) {
  let i = [...t],
    n = i.length,
    s = t.map((t, i) => S(t)(t, e[i]));
  return t => {
    for (let e = 0; e < n; e++) i[e] = s[e](t);
    return i;
  };
}
function T(t, e) {
  let i = {
      ...t,
      ...e
    },
    n = {};
  for (let s in i) void 0 !== t[s] && void 0 !== e[s] && (n[s] = S(t[s])(t[s], e[s]));
  return t => {
    for (let e in n) i[e] = n[e](t);
    return i;
  };
}
let P = (t, e) => {
    let i = l.f.createTransformer(e),
      n = (0, l.Vf)(t),
      o = (0, l.Vf)(e);
    if (!(n.indexes.var.length === o.indexes.var.length && n.indexes.color.length === o.indexes.color.length && n.indexes.number.length >= o.indexes.number.length)) return (0, r.$)(!0, `Complex values '${t}' and '${e}' too different to mix. Ensure all colors are of the same type, and that each contains the same quantity of number and color values. Falling back to instant transition.`, "complex-values-different"), p(t, e);
    if (x.has(t) && !o.values.length || x.has(e) && !n.values.length) return x.has(t) ? i => i <= 0 ? t : e : i => i >= 1 ? e : t;
    return (0, s.F)(b(function (t, e) {
      let i = [],
        n = {
          color: 0,
          var: 0,
          number: 0
        };
      for (let s = 0; s < e.values.length; s++) {
        let r = e.types[s],
          o = t.indexes[r][n[r]],
          a = t.values[o] ?? 0;
        i[s] = a, n[r]++;
      }
      return i;
    }(n, o), o.values), i);
  },
  A = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/iu;
function k(t, e, i) {
  if ("number" == typeof t && "number" == typeof e && "number" == typeof i) return (0, m.k)(t, e, i);
  if ("string" == typeof t && "string" == typeof e) {
    let i = function (t, e) {
      let i = A.exec(t);
      if (!i) return;
      let s = A.exec(e);
      if (!s || i[2] !== s[2]) return;
      let r = i[2],
        o = parseFloat(i[1]),
        a = parseFloat(s[1]);
      return t => (0, n.a)((0, m.k)(o, a, t)) + r;
    }(t, e);
    if (i) return i;
  }
  return S(t)(t, e);
}
