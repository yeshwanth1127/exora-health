// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  K: () => g
});
var n = require("./9247.cjs"),
  s = require("./49637.cjs"),
  r = require("./11048.cjs");
let o = [s.ai, r.px, r.KN, r.uj, r.vw, r.vh, {
    test: t => "auto" === t,
    parse: t => t
  }],
  a = t => o.find(e => e.test(t));
var l = require("./5556.cjs"),
  h = require("./74212.cjs"),
  u = require("./39896.cjs");
let d = /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;
var c = require("./4132.cjs"),
  p = require("./58974.cjs"),
  m = require("./83399.cjs"),
  f = require("./21023.cjs");
let v = new Set(["auto", "none", "0"]);
var y = require("./32766.cjs");
class g extends c.h {
  constructor(t, e, i, n, s) {
    super(t, e, i, n, s, !0);
  }
  readKeyframes() {
    let {
      unresolvedKeyframes: t,
      element: e,
      name: i
    } = this;
    if (!e || !e.current) return;
    super.readKeyframes();
    for (let i = 0; i < t.length; i++) {
      let n = t[i];
      if ("string" == typeof n && (n = n.trim(), (0, u.pG)(n))) {
        let s = function t(e, i, n = 1) {
          (0, l.V)(n <= 4, `Max CSS variable fallback depth detected in property "${e}". This may indicate a circular fallback dependency.`, "max-css-var-depth");
          let [s, r] = function (t) {
            let e = d.exec(t);
            if (!e) return [,];
            let [, i, n, s] = e;
            return [`--${i ?? n}`, s];
          }(e);
          if (!s) return;
          let o = window.getComputedStyle(i).getPropertyValue(s);
          if (o) {
            let t = o.trim();
            return (0, h.i)(t) ? parseFloat(t) : t;
          }
          return (0, u.pG)(r) ? t(r, i, n + 1) : r;
        }(n, e.current);
        void 0 !== s && (t[i] = s), i === t.length - 1 && (this.finalKeyframe = n);
      }
    }
    if (this.resolveNoneKeyframes(), !n.$.has(i) || 2 !== t.length) return;
    let [s, r] = t;
    if ("number" == typeof s && "number" == typeof r) return;
    let o = a(s),
      c = a(r);
    if ((0, u.rm)(s) !== (0, u.rm)(r) && y.Hr[i]) {
      this.needsMeasurement = !0;
      return;
    }
    if (o !== c) if ((0, y.E4)(o) && (0, y.E4)(c)) for (let e = 0; e < t.length; e++) {
      let i = t[e];
      "string" == typeof i && (t[e] = parseFloat(i));
    } else y.Hr[i] && (this.needsMeasurement = !0);
  }
  resolveNoneKeyframes() {
    let {
        unresolvedKeyframes: t,
        name: e
      } = this,
      i = [];
    for (let e = 0; e < t.length; e++) {
      var n;
      (null === t[e] || ("number" == typeof (n = t[e]) ? 0 === n : null === n || "none" === n || "0" === n || (0, p.$)(n))) && i.push(e);
    }
    i.length && function (t, e, i) {
      let n,
        s = 0;
      for (; s < t.length && !n;) {
        let e = t[s];
        "string" == typeof e && !v.has(e) && (0, m.nK)(e) && (n = t[s]), s++;
      }
      if (n && i) for (let s of e) t[s] !== n && (t[s] = (0, f.J)(i, n));
    }(t, i, e);
  }
  measure() {
    let {
      element: t,
      name: e
    } = this;
    return y.Hr[e](window.getComputedStyle(t.current), () => t.measureViewportBox());
  }
  measureInitialState() {
    let {
      element: t,
      unresolvedKeyframes: e,
      name: i
    } = this;
    if (!t || !t.current) return;
    "height" === i && (this.suspendedScrollY = window.pageYOffset), this.measuredOrigin = this.measure(), e[0] = this.measuredOrigin;
    let n = e[e.length - 1];
    void 0 !== n && this.motionValue?.jump(n, !1);
  }
  measureEndState() {
    let {
      element: t,
      unresolvedKeyframes: e
    } = this;
    if (!t || !t.current) return;
    this.motionValue?.jump(this.measuredOrigin, !1);
    let i = e.length - 1,
      n = e[i];
    e[i] = this.measure(), null !== n && void 0 === this.finalKeyframe && (this.finalKeyframe = n), this.removedTransforms?.length && this.removedTransforms.forEach(([e, i]) => {
      t.getValue(e).set(i);
    }), this.resolveNoneKeyframes();
  }
}
