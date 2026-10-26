// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  _: () => v
});
var n = require("./33140.cjs"),
  s = require("./75319.cjs"),
  r = require("./30123.cjs"),
  o = require("./9247.cjs"),
  a = require("./67119.cjs"),
  l = require("./61638.cjs"),
  h = require("./61151.cjs"),
  u = require("./36381.cjs"),
  d = require("./27933.cjs");
let c = "u" > typeof window;
function p(t, e, {
  delay: i = 0,
  transitionOverride: n,
  type: m
} = {}) {
  let {
      transition: f,
      transitionEnd: v,
      ...y
    } = e,
    g = t.getDefaultTransition();
  f = f ? (0, r.K)(f, g) : g;
  let x = f?.reduceMotion,
    w = f?.skipAnimations;
  n && (f = n);
  let S = [],
    b = m && t.animationState && t.animationState.getState()[m],
    T = f?.path;
  for (let e in T && T.animateVisualElement(t, y, f, i, S), y) {
    let n = t.getValue(e, t.latestValues[e] ?? null),
      r = y[e];
    if (void 0 === r || b && function ({
      protectedKeys: t,
      needsAnimating: e
    }, i) {
      let n = t.hasOwnProperty(i) && !0 !== e[i];
      return e[i] = !1, n;
    }(b, e)) continue;
    let a = {
      delay: i,
      ...(0, s.r)(f || {}, e)
    };
    w && (a.skipAnimations = !0);
    let p = n.get();
    if (void 0 !== p && !n.isAnimating() && !Array.isArray(r) && r === p && !a.velocity) {
      d.Gt.update(() => n.set(r));
      continue;
    }
    let m = !1;
    if (c && window.MotionHandoffAnimation) {
      let i = (0, h.P)(t);
      if (i) {
        let t = window.MotionHandoffAnimation(i, e, d.Gt);
        null !== t && (a.startTime = t, m = !0);
      }
    }
    (0, l.g)(t, e);
    let v = x ?? t.shouldReduceMotion;
    n.start((0, u.f)(e, n, r, v && o.$.has(e) ? {
      type: !1
    } : a, t, m));
    let g = n.animation;
    g && S.push(g);
  }
  if (v) {
    let e = () => d.Gt.update(() => {
      v && (0, a.U)(t, v);
    });
    S.length ? Promise.all(S).then(e) : e();
  }
  return S;
}
var m = require("./12663.cjs");
function f(t, e, i = {}) {
  let s = (0, n.K)(t, e, "exit" === i.type ? t.presenceContext?.custom : void 0),
    {
      transition: r = t.getDefaultTransition() || {}
    } = s || {};
  i.transitionOverride && (r = i.transitionOverride);
  let o = s ? () => Promise.all(p(t, s, i)) : () => Promise.resolve(),
    a = t.variantChildren && t.variantChildren.size ? (n = 0) => {
      let {
        delayChildren: s = 0,
        staggerChildren: o,
        staggerDirection: a
      } = r;
      return function (t, e, i = 0, n = 0, s = 0, r = 1, o) {
        let a = [];
        for (let l of t.variantChildren) l.notify("AnimationStart", e), a.push(f(l, e, {
          ...o,
          delay: i + ("function" == typeof n ? 0 : n) + (0, m.L)(t.variantChildren, l, n, s, r)
        }).then(() => l.notify("AnimationComplete", e)));
        return Promise.all(a);
      }(t, e, n, s, o, a, i);
    } : () => Promise.resolve(),
    {
      when: l
    } = r;
  if (!l) return Promise.all([o(), a(i.delay)]);
  {
    let [t, e] = "beforeChildren" === l ? [o, a] : [a, o];
    return t().then(() => e());
  }
}
function v(t, e, i = {}) {
  let s;
  if (t.notify("AnimationStart", e), Array.isArray(e)) s = Promise.all(e.map(e => f(t, e, i)));else if ("string" == typeof e) s = f(t, e, i);else {
    let r = "function" == typeof e ? (0, n.K)(t, e, i.custom) : e;
    s = Promise.all(p(t, r, i));
  }
  return s.then(() => {
    t.notify("AnimationComplete", e);
  });
}
