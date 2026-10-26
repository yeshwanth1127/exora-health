// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  Vf: () => c,
  f: () => m,
  nK: () => d
});
var n = require("./77054.cjs"),
  s = require("./21620.cjs"),
  r = require("./71939.cjs");
let o = new RegExp(s.S.source),
  a = RegExp(/(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu.source, "i"),
  l = "number",
  h = "color",
  u = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
function d(t) {
  let e = t.toString();
  return o.test(e) || a.test(e);
}
function c(t) {
  let e = t.toString(),
    i = [],
    s = {
      color: [],
      number: [],
      var: []
    },
    r = [],
    o = 0,
    a = e.replace(u, t => (n.y.test(t) ? (s.color.push(o), r.push(h), i.push(n.y.parse(t))) : t.startsWith("var(") ? (s.var.push(o), r.push("var"), i.push(t)) : (s.number.push(o), r.push(l), i.push(parseFloat(t))), ++o, "${}")).split("${}");
  return {
    values: i,
    split: a,
    indexes: s,
    types: r
  };
}
function p({
  split: t,
  types: e
}) {
  let i = t.length;
  return s => {
    let o = "";
    for (let a = 0; a < i; a++) if (o += t[a], void 0 !== s[a]) {
      let t = e[a];
      t === l ? o += (0, r.a)(s[a]) : t === h ? o += n.y.transform(s[a]) : o += s[a];
    }
    return o;
  };
}
let m = {
  test: function (t) {
    return isNaN(t) && "string" == typeof t && (o.test(t) || a.test(t));
  },
  parse: function (t) {
    return c(t).values;
  },
  createTransformer: function (t) {
    return p(c(t));
  },
  getAnimatableNone: function (t) {
    let e = c(t);
    return p(e)(e.values.map((t, i) => ((t, e) => "number" == typeof t ? e?.trim().endsWith("/") ? t : 0 : "number" == typeof t ? 0 : n.y.test(t) ? n.y.getAnimatableNone(t) : t)(t, e.split[i])));
  }
};
