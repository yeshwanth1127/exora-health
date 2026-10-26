// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  H: () => $
});
var n = require("react/jsx-runtime"),
  s = require("react"),
  r = require("./39551.cjs");
let o = (0, s.createContext)({
  strict: !1
});
var a = require("./24866.cjs");
let l = (0, s.createContext)({});
var h = require("./44616.cjs"),
  u = require("./63290.cjs");
function d(t) {
  return Array.isArray(t) ? t.join(" ") : t;
}
var c = require("./51469.cjs"),
  p = require("./19274.cjs"),
  m = require("./54714.cjs");
let f = () => ({
  style: {},
  transform: {},
  transformOrigin: {},
  vars: {}
});
function v(t, e, i) {
  for (let n in e) (0, c.S)(e[n]) || (0, p.zK)(n, i) || (t[n] = e[n]);
}
var y = require("./44425.cjs"),
  g = require("./73148.cjs");
let x = () => ({
    ...f(),
    attrs: {}
  }),
  w = new Set(["animate", "exit", "variants", "initial", "style", "values", "variants", "transition", "transformTemplate", "custom", "inherit", "onBeforeLayoutMeasure", "onAnimationStart", "onAnimationComplete", "onUpdate", "onDragStart", "onDrag", "onDragEnd", "onMeasureDragConstraints", "onDirectionLock", "onDragTransitionEnd", "_dragX", "_dragY", "onHoverStart", "onHoverEnd", "onViewportEnter", "onViewportLeave", "globalTapTarget", "propagate", "ignoreStrict", "viewport"]);
function S(t) {
  return t.startsWith("while") || t.startsWith("drag") && "draggable" !== t || t.startsWith("layout") || t.startsWith("onTap") || t.startsWith("onPan") || t.startsWith("onLayout") || w.has(t);
}
var b = require("./95391.cjs"),
  T = require("./43891.cjs"),
  P = require("./10583.cjs"),
  A = require("./26087.cjs"),
  k = require("./76792.cjs"),
  E = require("./15131.cjs"),
  V = require("./28819.cjs");
let C = t => (e, i) => {
    let n = (0, s.useContext)(l),
      r = (0, s.useContext)(E.t),
      o = () => function ({
        scrapeMotionValuesFromProps: t,
        createRenderState: e
      }, i, n, s) {
        return {
          latestValues: function (t, e, i, n) {
            let s = {},
              r = n(t, {});
            for (let t in r) s[t] = (0, P.u)(r[t]);
            let {
                initial: o,
                animate: a
              } = t,
              l = (0, h.e)(t),
              u = (0, h.O)(t);
            e && u && !l && !1 !== t.inherit && (void 0 === o && (o = e.initial), void 0 === a && (a = e.animate));
            let d = !!i && !1 === i.initial,
              c = (d = d || !1 === o) ? a : o;
            if (c && "boolean" != typeof c && !(0, A.N)(c)) {
              let e = Array.isArray(c) ? c : [c];
              for (let i = 0; i < e.length; i++) {
                let n = (0, k.a)(t, e[i]);
                if (n) {
                  let {
                    transitionEnd: t,
                    transition: e,
                    ...i
                  } = n;
                  for (let t in i) {
                    let e = i[t];
                    if (Array.isArray(e)) {
                      let t = d ? e.length - 1 : 0;
                      e = e[t];
                    }
                    null !== e && (s[t] = e);
                  }
                  for (let e in t) s[e] = t[e];
                }
              }
            }
            return s;
          }(i, n, s, t),
          renderState: e()
        };
      }(t, e, n, r);
    return i ? o() : (0, V.M)(o);
  },
  M = C({
    scrapeMotionValuesFromProps: T.x,
    createRenderState: f
  }),
  D = C({
    scrapeMotionValuesFromProps: require("./85068.cjs").x,
    createRenderState: x
  });
var R = require("./80171.cjs");
let L = {
    animation: ["animate", "variants", "whileHover", "whileTap", "exit", "whileInView", "whileFocus", "whileDrag"],
    exit: ["exit"],
    drag: ["drag", "dragControls"],
    focus: ["whileFocus"],
    hover: ["whileHover", "onHoverStart", "onHoverEnd"],
    tap: ["whileTap", "onTap", "onTapStart", "onTapCancel"],
    pan: ["onPan", "onPanStart", "onPanSessionStart", "onPanEnd"],
    inView: ["whileInView", "onViewportEnter", "onViewportLeave"],
    layout: ["layout", "layoutId"]
  },
  B = !1;
function j() {
  return !function () {
    if (B) return;
    let t = {};
    for (let e in L) t[e] = {
      isEnabled: t => L[e].some(e => !!t[e])
    };
    (0, R.lr)(t), B = !0;
  }(), (0, R.vK)();
}
let F = Symbol.for("motionComponentSymbol");
var O = require("./43261.cjs"),
  I = require("./59299.cjs"),
  W = require("./11493.cjs"),
  U = require("./65239.cjs");
function N(t, {
  forwardMotionProps: e = !1,
  type: i
} = {}, p, w) {
  p && function (t) {
    let e = j();
    for (let i in t) e[i] = {
      ...e[i],
      ...t[i]
    };
    (0, R.lr)(e);
  }(p);
  let T = i ? "svg" === i : (0, b.Q)(t),
    P = T ? D : M;
  function A(i, p) {
    var A;
    let k,
      V,
      C,
      M = {
        ...(0, s.useContext)(a.Q),
        ...i,
        layoutId: function ({
          layoutId: t
        }) {
          let e = (0, s.useContext)(r.L).id;
          return e && void 0 !== t ? e + "-" + t : t;
        }(i)
      },
      {
        isStatic: D,
        isValidProp: R
      } = M,
      L = function (t) {
        let {
          initial: e,
          animate: i
        } = function (t, e) {
          if ((0, h.e)(t)) {
            let {
              initial: e,
              animate: i
            } = t;
            return {
              initial: !1 === e || (0, u.w)(e) ? e : void 0,
              animate: (0, u.w)(i) ? i : void 0
            };
          }
          return !1 !== t.inherit ? e : {};
        }(t, (0, s.useContext)(l));
        return (0, s.useMemo)(() => ({
          initial: e,
          animate: i
        }), [d(e), d(i)]);
      }(i),
      B = P(i, D);
    if (!D && "u" > typeof window) {
      (0, s.useContext)(o).strict;
      let e = function (t) {
        let {
          drag: e,
          layout: i
        } = j();
        if (!e && !i) return {};
        let n = {
          ...e,
          ...i
        };
        return {
          MeasureLayout: e?.isEnabled(t) || i?.isEnabled(t) ? n.MeasureLayout : void 0,
          ProjectionNode: n.ProjectionNode
        };
      }(M);
      k = e.MeasureLayout, L.visualElement = function (t, e, i, n, r, h) {
        let {
            visualElement: u
          } = (0, s.useContext)(l),
          d = (0, s.useContext)(o),
          c = (0, s.useContext)(E.t),
          p = (0, s.useContext)(a.Q),
          m = p.reducedMotion,
          f = p.skipAnimations,
          v = (0, s.useRef)(null),
          y = (0, s.useRef)(!1);
        n = n || d.renderer, !v.current && n && (v.current = n(t, {
          visualState: e,
          parent: u,
          props: i,
          presenceContext: c,
          blockInitialAnimation: !!c && !1 === c.initial,
          reducedMotionConfig: m,
          skipAnimations: f,
          isSVG: h
        }), y.current && v.current && (v.current.manuallyAnimateOnMount = !0));
        let g = v.current,
          x = (0, s.useContext)(I.N);
        g && !g.projection && r && ("html" === g.type || "svg" === g.type) && function (t, e, i, n) {
          let {
            layoutId: s,
            layout: r,
            drag: o,
            dragConstraints: a,
            layoutScroll: l,
            layoutRoot: h,
            layoutAnchor: u,
            layoutCrossfade: d
          } = e;
          t.projection = new i(t.latestValues, e["data-framer-portal-id"] ? void 0 : function t(e) {
            if (e) return !1 !== e.options.allowProjection ? e.projection : t(e.parent);
          }(t.parent)), t.projection.setOptions({
            layoutId: s,
            layout: r,
            alwaysMeasureLayout: !!o || a && (0, W.X)(a),
            visualElement: t,
            animationType: "string" == typeof r ? r : "both",
            initialPromotionConfig: n,
            crossfade: d,
            layoutScroll: l,
            layoutRoot: h,
            layoutAnchor: u
          });
        }(v.current, i, r, x);
        let w = (0, s.useRef)(!1);
        (0, s.useInsertionEffect)(() => {
          g && w.current && g.update(i, c);
        });
        let S = i[O.n],
          b = (0, s.useRef)(!!S && "u" > typeof window && !window.MotionHandoffIsComplete?.(S) && window.MotionHasOptimisedAnimation?.(S));
        return (0, U.E)(() => {
          y.current = !0, g && (w.current = !0, window.MotionIsMounted = !0, g.updateFeatures(), g.scheduleRenderMicrotask(), b.current && g.animationState && g.animationState.animateChanges());
        }), (0, s.useEffect)(() => {
          g && (!b.current && g.animationState && g.animationState.animateChanges(), b.current && (queueMicrotask(() => {
            window.MotionHandoffMarkAsComplete?.(S);
          }), b.current = !1), g.enteringChildren = void 0);
        }), g;
      }(t, B, M, w, e.ProjectionNode, T);
    }
    return (0, n.jsxs)(l.Provider, {
      value: L,
      children: [k && L.visualElement ? (0, n.jsx)(k, {
        visualElement: L.visualElement,
        ...M
      }) : null, function (t, e, i, {
        latestValues: n
      }, r, o = !1, a, l) {
        let h = (a ?? (0, b.Q)(t) ? function (t, e, i, n) {
            let r = (0, s.useMemo)(() => {
              let i = x();
              return (0, y.B)(i, e, (0, g.n)(n), t.transformTemplate, t.style), {
                ...i.attrs,
                style: {
                  ...i.style
                }
              };
            }, [e]);
            if (t.style) {
              let e = {};
              v(e, t.style, t), r.style = {
                ...e,
                ...r.style
              };
            }
            return r;
          } : function (t, e) {
            let i,
              n,
              r = {},
              o = (i = t.style || {}, v(n = {}, i, t), Object.assign(n, function ({
                transformTemplate: t
              }, e) {
                return (0, s.useMemo)(() => {
                  let i = f();
                  return (0, m.O)(i, e, t), Object.assign({}, i.vars, i.style);
                }, [e]);
              }(t, e)), n);
            return t.drag && !1 !== t.dragListener && (r.draggable = !1, o.userSelect = o.WebkitUserSelect = o.WebkitTouchCallout = "none", o.touchAction = !0 === t.drag ? "none" : `pan-${"x" === t.drag ? "y" : "x"}`), void 0 === t.tabIndex && (t.onTap || t.onTapStart || t.whileTap) && (r.tabIndex = 0), r.style = o, r;
          })(e, n, r, t),
          u = function (t, e, i, n) {
            let s = {};
            for (let r in t) ("values" !== r || "object" != typeof t.values) && !(0, c.S)(t[r]) && ((r.startsWith("on") ? !S(r) : n?.(r) ?? !S(r)) || !0 === i && S(r) || !e && !S(r) || t.draggable && r.startsWith("onDrag")) && (s[r] = t[r]);
            return s;
          }(e, "string" == typeof t, o, l),
          d = t !== s.Fragment ? {
            ...u,
            ...h,
            ref: i
          } : {},
          {
            children: p
          } = e,
          w = (0, s.useMemo)(() => (0, c.S)(p) ? p.get() : p, [p]);
        return (0, s.createElement)(t, {
          ...d,
          children: w
        });
      }(t, i, (A = L.visualElement, V = (0, s.useRef)(p), (0, s.useInsertionEffect)(() => {
        V.current = p;
      }), C = (0, s.useRef)(null), (0, s.useCallback)(t => {
        t && B.onMount?.(t), A && (t ? A.mount(t) : A.unmount());
        let e = V.current;
        if ("function" == typeof e) {
          if (t) {
            let i = e(t);
            "function" == typeof i && (C.current = i);
          } else C.current ? (C.current(), C.current = null) : e(t);
        } else e && (e.current = t);
      }, [A])), B, D, e, T, R)]
    });
  }
  A.displayName = `motion.${"string" == typeof t ? t : `create(${t.displayName ?? t.name ?? ""})`}`;
  let k = (0, s.forwardRef)(A);
  return k[F] = t, k;
}
function $(t, e) {
  if ("u" < typeof Proxy) return N;
  let i = new Map(),
    n = (i, n) => N(i, n, t, e);
  return new Proxy((t, e) => n(t, e), {
    get: (s, r) => "create" === r ? n : (i.has(r) || i.set(r, N(r, void 0, t, e)), i.get(r))
  });
}
