// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  P: () => ih
});
var n = require("./25952.cjs"),
  s = require("./47888.cjs"),
  r = require("./4287.cjs"),
  o = require("./51469.cjs"),
  a = require("./96653.cjs"),
  l = require("./80171.cjs");
class h extends l.BX {
  constructor() {
    super(...arguments), this.KeyframeResolver = a.K;
  }
  sortInstanceNodePosition(t, e) {
    return 2 & t.compareDocumentPosition(e) ? 1 : -1;
  }
  getBaseTargetFromProps(t, e) {
    let i = t.style;
    return i ? i[e] : void 0;
  }
  removeValueFromRenderState(t, {
    vars: e,
    style: i
  }) {
    delete e[t], delete i[t];
  }
  handleChildMotionValue() {
    this.childSubscription && (this.childSubscription(), delete this.childSubscription);
    let {
      children: t
    } = this.props;
    (0, o.S)(t) && (this.childSubscription = t.on("change", t => {
      this.current && (this.current.textContent = `${t}`);
    }));
  }
}
var u = require("./15043.cjs"),
  d = require("./44425.cjs");
let c = new Set(["baseFrequency", "diffuseConstant", "kernelMatrix", "kernelUnitLength", "keySplines", "keyTimes", "limitingConeAngle", "markerHeight", "markerWidth", "numOctaves", "targetX", "targetY", "surfaceScale", "specularConstant", "specularExponent", "stdDeviation", "tableValues", "viewBox", "gradientTransform", "pathLength", "startOffset", "textLength", "lengthAdjust"]);
var p = require("./73148.cjs");
function m(t, {
  style: e,
  vars: i
}, n, s) {
  let r,
    o = t.style;
  for (r in e) o[r] = e[r];
  for (r in s?.applyProjectionStyles(o, n), i) o.setProperty(r, i[r]);
}
var f = require("./85068.cjs");
class v extends h {
  constructor() {
    super(...arguments), this.type = "svg", this.isSVGTag = !1, this.measureInstanceViewportBox = r.ge;
  }
  getBaseTargetFromProps(t, e) {
    return t[e];
  }
  readValueFromInstance(t, e) {
    if (n.f.has(e)) {
      let t = (0, s.D)(e);
      return t && t.default || 0;
    }
    if (d.W.includes(e)) {
      let i = getComputedStyle(t)[e];
      if ("string" == typeof i && i) return i.trim();
    }
    return e = c.has(e) ? e : (0, u.I)(e), t.getAttribute(e);
  }
  scrapeMotionValuesFromProps(t, e, i) {
    return (0, f.x)(t, e, i);
  }
  build(t, e, i) {
    (0, d.B)(t, e, this.isSVGTag, i.transformTemplate, i.style);
  }
  renderInstance(t, e, i, n) {
    for (let i in m(t, e, void 0, n), e.attrs) t.setAttribute(c.has(i) ? i : (0, u.I)(i), e.attrs[i]);
  }
  mount(t) {
    this.isSVGTag = (0, p.n)(t.tagName), super.mount(t);
  }
}
var y = require("./5556.cjs"),
  g = require("./39896.cjs"),
  x = require("./11698.cjs"),
  w = require("./93560.cjs"),
  S = require("./54714.cjs"),
  b = require("./43891.cjs");
class T extends h {
  constructor() {
    super(...arguments), this.type = "html", this.renderInstance = m;
  }
  mount(t) {
    (0, y.V)(!!t.style, "motion.create() components must forward their ref to a HTML or SVG element", "custom-component-ref"), super.mount(t);
  }
  readValueFromInstance(t, e) {
    if (n.f.has(e)) return this.projection?.isProjecting ? (0, x.zs)(e) : (0, x.Ib)(t, e);
    {
      let i = window.getComputedStyle(t),
        n = ((0, g.j4)(e) ? i.getPropertyValue(e) : i[e]) || 0;
      return "string" == typeof n ? n.trim() : n;
    }
  }
  measureInstanceViewportBox(t, {
    transformPagePoint: e
  }) {
    return (0, w.m)(t, e);
  }
  build(t, e, i) {
    (0, S.O)(t, e, i.transformTemplate);
  }
  scrapeMotionValuesFromProps(t, e, i) {
    return (0, b.x)(t, e, i);
  }
}
var P = require("react"),
  A = require("./95391.cjs"),
  k = require("./32642.cjs");
class E {
  constructor(t) {
    this.isMounted = !1, this.node = t;
  }
  update() {}
}
var V = require("./38294.cjs"),
  C = require("./12663.cjs"),
  M = require("./63290.cjs"),
  D = require("./51129.cjs");
let R = D._.length;
var L = require("./26087.cjs"),
  B = require("./91909.cjs"),
  j = require("./33140.cjs");
function F(t, e) {
  if (!Array.isArray(e)) return !1;
  let i = e.length;
  if (i !== t.length) return !1;
  for (let n = 0; n < i; n++) if (e[n] !== t[n]) return !1;
  return !0;
}
let O = [...D.U].reverse(),
  I = D.U.length;
function W(t = !1) {
  return {
    isActive: t,
    protectedKeys: {},
    needsAnimating: {},
    prevResolvedValues: {}
  };
}
function U() {
  return {
    animate: W(!0),
    whileInView: W(),
    whileHover: W(),
    whileTap: W(),
    whileDrag: W(),
    whileFocus: W(),
    exit: W()
  };
}
class N extends E {
  constructor(t) {
    super(t), t.animationState || (t.animationState = function (t) {
      let e = e => Promise.all(e.map(({
          animation: e,
          options: i
        }) => (0, V._)(t, e, i))),
        i = U(),
        n = !0,
        s = !1,
        r = e => (i, n) => {
          let s = (0, j.K)(t, n, "exit" === e ? t.presenceContext?.custom : void 0);
          if (s) {
            let {
              transition: t,
              transitionEnd: e,
              ...n
            } = s;
            i = {
              ...i,
              ...n,
              ...e
            };
          }
          return i;
        };
      function o(o) {
        let {
            props: a
          } = t,
          l = function t(e) {
            if (!e) return;
            if (!e.isControllingVariants) {
              let i = e.parent && t(e.parent) || {};
              return void 0 !== e.props.initial && (i.initial = e.props.initial), i;
            }
            let i = {};
            for (let t = 0; t < R; t++) {
              let n = D._[t],
                s = e.props[n];
              ((0, M.w)(s) || !1 === s) && (i[n] = s);
            }
            return i;
          }(t.parent) || {},
          h = [],
          u = new Set(),
          d = {},
          c = 1 / 0;
        for (let e = 0; e < I; e++) {
          var p, m;
          let f = O[e],
            v = i[f],
            y = void 0 !== a[f] ? a[f] : l[f],
            g = (0, M.w)(y),
            x = f === o ? v.isActive : null;
          !1 === x && (c = e);
          let w = y === l[f] && y !== a[f] && g;
          if (w && (n || s) && t.manuallyAnimateOnMount && (w = !1), v.protectedKeys = {
            ...d
          }, !v.isActive && null === x || !y && !v.prevProp || (0, L.N)(y) || "boolean" == typeof y) continue;
          if ("exit" === f && v.isActive && !0 !== x) {
            v.prevResolvedValues && (d = {
              ...d,
              ...v.prevResolvedValues
            });
            continue;
          }
          let S = (p = v.prevProp, "string" == typeof (m = y) ? m !== p : !!Array.isArray(m) && !F(m, p)),
            b = S || f === o && v.isActive && !w && g || e > c && g,
            T = !1,
            P = Array.isArray(y) ? y : [y],
            A = P.reduce(r(f), {});
          !1 === x && (A = {});
          let {
              prevResolvedValues: k = {}
            } = v,
            E = {
              ...k,
              ...A
            },
            V = e => {
              b = !0, u.has(e) && (T = !0, u.delete(e)), v.needsAnimating[e] = !0;
              let i = t.getValue(e);
              i && (i.liveStyle = !1);
            };
          for (let t in E) {
            let e = A[t],
              i = k[t];
            if (!d.hasOwnProperty(t)) ((0, B.p)(e) && (0, B.p)(i) ? !F(e, i) || S : e !== i) ? null != e ? V(t) : u.add(t) : void 0 !== e && u.has(t) ? V(t) : v.protectedKeys[t] = !0;
          }
          v.prevProp = y, v.prevResolvedValues = A, v.isActive && (d = {
            ...d,
            ...A
          }), (n || s) && t.blockInitialAnimation && (b = !1);
          let D = w && S,
            R = !D || T;
          b && R && h.push(...P.map(e => {
            let i = {
              type: f
            };
            if ("string" == typeof e && (n || s) && !D && t.manuallyAnimateOnMount && t.parent) {
              let {
                  parent: n
                } = t,
                s = (0, j.K)(n, e);
              if (n.enteringChildren && s) {
                let {
                  delayChildren: e
                } = s.transition || {};
                i.delay = (0, C.L)(n.enteringChildren, t, e);
              }
            }
            return {
              animation: e,
              options: i
            };
          }));
        }
        if (u.size) {
          let e = {};
          if ("boolean" != typeof a.initial) {
            let i = (0, j.K)(t, Array.isArray(a.initial) ? a.initial[0] : a.initial);
            i && i.transition && (e.transition = i.transition);
          }
          u.forEach(i => {
            let n = t.getBaseTarget(i),
              s = t.getValue(i);
            s && (s.liveStyle = !0), e[i] = n ?? null;
          }), h.push({
            animation: e
          });
        }
        let f = !!h.length;
        return n && (!1 === a.initial || a.initial === a.animate) && !t.manuallyAnimateOnMount && (f = !1), n = !1, s = !1, f ? e(h) : Promise.resolve();
      }
      return {
        animateChanges: o,
        setActive: function (e, n) {
          if (i[e].isActive === n) return Promise.resolve();
          t.variantChildren?.forEach(t => t.animationState?.setActive(e, n)), i[e].isActive = n;
          let s = o(e);
          for (let t in i) i[t].protectedKeys = {};
          return s;
        },
        setAnimateFunction: function (i) {
          e = i(t);
        },
        getState: () => i,
        reset: () => {
          i = U(), s = !0;
        }
      };
    }(t));
  }
  updateAnimationControlsSubscription() {
    let {
      animate: t
    } = this.node.getProps();
    (0, L.N)(t) && (this.unmountControls = t.subscribe(this.node));
  }
  mount() {
    this.updateAnimationControlsSubscription();
  }
  update() {
    let {
        animate: t
      } = this.node.getProps(),
      {
        animate: e
      } = this.node.prevProps || {};
    t !== e && this.updateAnimationControlsSubscription();
  }
  unmount() {
    this.node.animationState.reset(), this.unmountControls?.();
  }
}
let $ = 0;
class X extends E {
  constructor() {
    super(...arguments), this.id = $++, this.isExitComplete = !1;
  }
  update() {
    if (!this.node.presenceContext) return;
    let {
        isPresent: t,
        onExitComplete: e
      } = this.node.presenceContext,
      {
        isPresent: i
      } = this.node.prevPresenceContext || {};
    if (!this.node.animationState || t === i) return;
    if (t && !1 === i) {
      if (this.isExitComplete) {
        let {
          initial: t,
          custom: e
        } = this.node.getProps();
        if ("string" == typeof t || "object" == typeof t && null !== t && !Array.isArray(t)) {
          let i = (0, j.K)(this.node, t, e);
          if (i) {
            let {
              transition: t,
              transitionEnd: e,
              ...n
            } = i;
            for (let t in n) this.node.getValue(t)?.jump(n[t]);
          }
        }
        this.node.animationState.reset(), this.node.animationState.animateChanges();
      } else this.node.animationState.setActive("exit", !1);
      this.isExitComplete = !1;
      return;
    }
    let n = this.node.animationState.setActive("exit", !t);
    e && !t && n.then(() => {
      this.isExitComplete = !0, e(this.id);
    });
  }
  mount() {
    let {
      register: t,
      onExitComplete: e
    } = this.node.presenceContext || {};
    e && e(this.id), t && (this.unmount = t(this.id));
  }
  unmount() {}
}
var G = require("./72025.cjs");
let K = {
  x: !1,
  y: !1
};
function z(t) {
  return [t("x"), t("y")];
}
var H = require("./11048.cjs"),
  q = require("./56260.cjs");
function Y(t) {
  return t.max - t.min;
}
function _(t, e, i, n = .5) {
  t.origin = n, t.originPoint = (0, q.k)(e.min, e.max, t.origin), t.scale = Y(i) / Y(e), t.translate = (0, q.k)(i.min, i.max, t.origin) - t.originPoint, (t.scale >= .9999 && t.scale <= 1.0001 || isNaN(t.scale)) && (t.scale = 1), (t.translate >= -.01 && t.translate <= .01 || isNaN(t.translate)) && (t.translate = 0);
}
function Q(t, e, i, n) {
  _(t.x, e.x, i.x, n ? n.originX : void 0), _(t.y, e.y, i.y, n ? n.originY : void 0);
}
function Z(t, e, i, n = 0) {
  t.min = (n ? (0, q.k)(i.min, i.max, n) : i.min) + e.min, t.max = t.min + Y(e);
}
function J(t, e, i, n = 0) {
  let s = n ? (0, q.k)(i.min, i.max, n) : i.min;
  t.min = e.min - s, t.max = t.min + Y(e);
}
function tt(t, e, i, n) {
  J(t.x, e.x, i.x, n?.x), J(t.y, e.y, i.y, n?.y);
}
var te = require("./27933.cjs"),
  ti = require("./61638.cjs"),
  tn = require("./27669.cjs"),
  ts = require("./36381.cjs");
let tr = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A"]),
  to = new Set(["INPUT", "SELECT", "TEXTAREA"]);
function ta(t, e, i, n = {
  passive: !0
}) {
  return t.addEventListener(e, i, n), () => t.removeEventListener(e, i, n);
}
var tl = require("./51275.cjs");
let th = t => "mouse" === t.pointerType ? "number" != typeof t.button || t.button <= 0 : !1 !== t.isPrimary;
function tu(t) {
  return {
    point: {
      x: t.pageX,
      y: t.pageY
    }
  };
}
function td(t, e, i, n) {
  return ta(t, e, t => th(t) && i(t, tu(t)), n);
}
let tc = ({
  current: t
}) => t ? t.ownerDocument.defaultView : null;
var tp = require("./11493.cjs"),
  tm = require("./34017.cjs"),
  tf = require("./38621.cjs");
let tv = (t, e) => Math.abs(t - e),
  ty = new Set(["auto", "scroll"]);
class tg {
  constructor(t, e, {
    transformPagePoint: i,
    contextWindow: n = window,
    dragSnapToOrigin: s = !1,
    distanceThreshold: r = 3,
    element: o
  } = {}) {
    if (this.startEvent = null, this.lastMoveEvent = null, this.lastMoveEventInfo = null, this.lastRawMoveEventInfo = null, this.handlers = {}, this.contextWindow = window, this.scrollPositions = new Map(), this.removeScrollListeners = null, this.onElementScroll = t => {
      this.handleScroll(t.target);
    }, this.onWindowScroll = () => {
      this.handleScroll(window);
    }, this.updatePoint = () => {
      var t, e;
      if (!(this.lastMoveEvent && this.lastMoveEventInfo)) return;
      this.lastRawMoveEventInfo && (this.lastMoveEventInfo = tx(this.lastRawMoveEventInfo, this.transformPagePoint));
      let i = tS(this.lastMoveEventInfo, this.history),
        n = null !== this.startEvent,
        s = (t = i.offset, e = {
          x: 0,
          y: 0
        }, Math.sqrt(tv(t.x, e.x) ** 2 + tv(t.y, e.y) ** 2) >= this.distanceThreshold);
      if (!n && !s) return;
      let {
          point: r
        } = i,
        {
          timestamp: o
        } = te.uv;
      this.history.push({
        ...r,
        timestamp: o
      });
      let {
        onStart: a,
        onMove: l
      } = this.handlers;
      n || (a && a(this.lastMoveEvent, i), this.startEvent = this.lastMoveEvent), l && l(this.lastMoveEvent, i);
    }, this.handlePointerMove = (t, e) => {
      this.lastMoveEvent = t, this.lastRawMoveEventInfo = e, this.lastMoveEventInfo = tx(e, this.transformPagePoint), te.Gt.update(this.updatePoint, !0);
    }, this.handlePointerUp = (t, e) => {
      this.end();
      let {
        onEnd: i,
        onSessionEnd: n,
        resumeAnimation: s
      } = this.handlers;
      if ((this.dragSnapToOrigin || !this.startEvent) && s && s(), !(this.lastMoveEvent && this.lastMoveEventInfo)) return;
      let r = tS("pointercancel" === t.type ? this.lastMoveEventInfo : tx(e, this.transformPagePoint), this.history);
      this.startEvent && i && i(t, r), n && n(t, r);
    }, !th(t)) return;
    this.dragSnapToOrigin = s, this.handlers = e, this.transformPagePoint = i, this.distanceThreshold = r, this.contextWindow = n || window;
    const a = tx(tu(t), this.transformPagePoint),
      {
        point: l
      } = a,
      {
        timestamp: h
      } = te.uv;
    this.history = [{
      ...l,
      timestamp: h
    }];
    const {
      onSessionStart: u
    } = e;
    u && u(t, tS(a, this.history));
    const d = {
      passive: !0,
      capture: !0
    };
    this.removeListeners = (0, tm.F)(td(this.contextWindow, "pointermove", this.handlePointerMove, d), td(this.contextWindow, "pointerup", this.handlePointerUp, d), td(this.contextWindow, "pointercancel", this.handlePointerUp, d)), o && this.startScrollTracking(o);
  }
  startScrollTracking(t) {
    let e = t.parentElement;
    for (; e;) {
      let t = getComputedStyle(e);
      (ty.has(t.overflowX) || ty.has(t.overflowY)) && this.scrollPositions.set(e, {
        x: e.scrollLeft,
        y: e.scrollTop
      }), e = e.parentElement;
    }
    this.scrollPositions.set(window, {
      x: window.scrollX,
      y: window.scrollY
    }), window.addEventListener("scroll", this.onElementScroll, {
      capture: !0
    }), window.addEventListener("scroll", this.onWindowScroll), this.removeScrollListeners = () => {
      window.removeEventListener("scroll", this.onElementScroll, {
        capture: !0
      }), window.removeEventListener("scroll", this.onWindowScroll);
    };
  }
  handleScroll(t) {
    let e = this.scrollPositions.get(t);
    if (!e) return;
    let i = t === window,
      n = i ? {
        x: window.scrollX,
        y: window.scrollY
      } : {
        x: t.scrollLeft,
        y: t.scrollTop
      },
      s = {
        x: n.x - e.x,
        y: n.y - e.y
      };
    (0 !== s.x || 0 !== s.y) && (i ? this.lastMoveEventInfo && (this.lastMoveEventInfo.point.x += s.x, this.lastMoveEventInfo.point.y += s.y) : this.history.length > 0 && (this.history[0].x -= s.x, this.history[0].y -= s.y), this.scrollPositions.set(t, n), te.Gt.update(this.updatePoint, !0));
  }
  updateHandlers(t) {
    this.handlers = t;
  }
  end() {
    this.removeListeners && this.removeListeners(), this.removeScrollListeners && this.removeScrollListeners(), this.scrollPositions.clear(), (0, te.WG)(this.updatePoint);
  }
}
function tx(t, e) {
  return e ? {
    point: e(t.point)
  } : t;
}
function tw(t, e) {
  return {
    x: t.x - e.x,
    y: t.y - e.y
  };
}
function tS({
  point: t
}, e) {
  return {
    point: t,
    delta: tw(t, tb(e)),
    offset: tw(t, e[0]),
    velocity: function (t) {
      if (t.length < 2) return {
        x: 0,
        y: 0
      };
      let e = t.length - 1,
        i = null,
        n = tb(t);
      for (; e >= 0 && (i = t[e], !(n.timestamp - i.timestamp > (0, tf.f)(.1)));) e--;
      if (!i) return {
        x: 0,
        y: 0
      };
      i === t[0] && t.length > 2 && n.timestamp - i.timestamp > 2 * (0, tf.f)(.1) && (i = t[1]);
      let s = (0, tf.X)(n.timestamp - i.timestamp);
      if (0 === s) return {
        x: 0,
        y: 0
      };
      let r = {
        x: (n.x - i.x) / s,
        y: (n.y - i.y) / s
      };
      return r.x === 1 / 0 && (r.x = 0), r.y === 1 / 0 && (r.y = 0), r;
    }(e)
  };
}
function tb(t) {
  return t[t.length - 1];
}
var tT = require("./18844.cjs"),
  tP = require("./94712.cjs");
function tA(t, e, i) {
  return {
    min: void 0 !== e ? t.min + e : void 0,
    max: void 0 !== i ? t.max + i - (t.max - t.min) : void 0
  };
}
function tk(t, e) {
  let i = e.min - t.min,
    n = e.max - t.max;
  return e.max - e.min < t.max - t.min && ([i, n] = [n, i]), {
    min: i,
    max: n
  };
}
function tE(t, e, i) {
  return {
    min: tV(t, e),
    max: tV(t, i)
  };
}
function tV(t, e) {
  return "number" == typeof t ? t : t[e] || 0;
}
let tC = new WeakMap();
class tM {
  constructor(t) {
    this.openDragLock = null, this.isDragging = !1, this.currentDirection = null, this.originPoint = {
      x: 0,
      y: 0
    }, this.constraints = !1, this.hasMutatedConstraints = !1, this.elastic = (0, r.ge)(), this.latestPointerEvent = null, this.latestPanInfo = null, this.visualElement = t;
  }
  start(t, {
    snapToCursor: e = !1,
    distanceThreshold: i
  } = {}) {
    let {
      presenceContext: n
    } = this.visualElement;
    if (n && !1 === n.isPresent) return;
    let s = t => {
        e && this.snapToCursor(tu(t).point), this.stopAnimation();
      },
      r = (t, e) => {
        let {
          drag: i,
          dragPropagation: n,
          onDragStart: s
        } = this.getProps();
        if (i && !n && (this.openDragLock && this.openDragLock(), this.openDragLock = function (t) {
          if ("x" === t || "y" === t) if (K[t]) return null;else return K[t] = !0, () => {
            K[t] = !1;
          };
          return K.x || K.y ? null : (K.x = K.y = !0, () => {
            K.x = K.y = !1;
          });
        }(i), !this.openDragLock)) return;
        this.latestPointerEvent = t, this.latestPanInfo = e, this.isDragging = !0, this.currentDirection = null, this.resolveConstraints(), this.visualElement.projection && (this.visualElement.projection.isAnimationBlocked = !0, this.visualElement.projection.target = void 0), z(t => {
          let e = this.getAxisMotionValue(t).get() || 0;
          if (H.KN.test(e)) {
            let {
              projection: i
            } = this.visualElement;
            if (i && i.layout) {
              let n = i.layout.layoutBox[t];
              n && (e = Y(n) * (parseFloat(e) / 100));
            }
          }
          this.originPoint[t] = e;
        }), s && te.Gt.update(() => s(t, e), !1, !0), (0, ti.g)(this.visualElement, "transform");
        let {
          animationState: r
        } = this.visualElement;
        r && r.setActive("whileDrag", !0);
      },
      o = (t, e) => {
        this.latestPointerEvent = t, this.latestPanInfo = e;
        let {
          dragPropagation: i,
          dragDirectionLock: n,
          onDirectionLock: s,
          onDrag: r
        } = this.getProps();
        if (!i && !this.openDragLock) return;
        let {
          offset: o
        } = e;
        if (n && null === this.currentDirection) {
          this.currentDirection = function (t, e = 10) {
            let i = null;
            return Math.abs(t.y) > e ? i = "y" : Math.abs(t.x) > e && (i = "x"), i;
          }(o), null !== this.currentDirection && s && s(this.currentDirection);
          return;
        }
        this.updateAxis("x", e.point, o), this.updateAxis("y", e.point, o), this.visualElement.render(), r && te.Gt.update(() => r(t, e), !1, !0);
      },
      a = (t, e) => {
        this.latestPointerEvent = t, this.latestPanInfo = e, this.stop(t, e), this.latestPointerEvent = null, this.latestPanInfo = null;
      },
      l = () => {
        let {
          dragSnapToOrigin: t
        } = this.getProps();
        (t || this.constraints) && this.startAnimation({
          x: 0,
          y: 0
        });
      },
      {
        dragSnapToOrigin: h
      } = this.getProps();
    this.panSession = new tg(t, {
      onSessionStart: s,
      onStart: r,
      onMove: o,
      onSessionEnd: a,
      resumeAnimation: l
    }, {
      transformPagePoint: this.visualElement.getTransformPagePoint(),
      dragSnapToOrigin: h,
      distanceThreshold: i,
      contextWindow: tc(this.visualElement),
      element: this.visualElement.current
    });
  }
  stop(t, e) {
    let i = t || this.latestPointerEvent,
      n = e || this.latestPanInfo,
      s = this.isDragging;
    if (this.cancel(), !s || !n || !i) return;
    let {
      velocity: r
    } = n;
    this.startAnimation(r);
    let {
      onDragEnd: o
    } = this.getProps();
    o && te.Gt.postRender(() => o(i, n));
  }
  cancel() {
    this.isDragging = !1;
    let {
      projection: t,
      animationState: e
    } = this.visualElement;
    t && (t.isAnimationBlocked = !1), this.endPanSession();
    let {
      dragPropagation: i
    } = this.getProps();
    !i && this.openDragLock && (this.openDragLock(), this.openDragLock = null), e && e.setActive("whileDrag", !1);
  }
  endPanSession() {
    this.panSession && this.panSession.end(), this.panSession = void 0;
  }
  updateAxis(t, e, i) {
    let {
      drag: n
    } = this.getProps();
    if (!i || !tR(t, n, this.currentDirection)) return;
    let s = this.getAxisMotionValue(t),
      r = this.originPoint[t] + i[t];
    this.constraints && this.constraints[t] && (r = function (t, {
      min: e,
      max: i
    }, n) {
      return void 0 !== e && t < e ? t = n ? (0, q.k)(e, t, n.min) : Math.max(t, e) : void 0 !== i && t > i && (t = n ? (0, q.k)(i, t, n.max) : Math.min(t, i)), t;
    }(r, this.constraints[t], this.elastic[t])), s.set(r);
  }
  resolveConstraints() {
    let {
        dragConstraints: t,
        dragElastic: e
      } = this.getProps(),
      i = this.visualElement.projection && !this.visualElement.projection.layout ? this.visualElement.projection.measure(!1) : this.visualElement.projection?.layout,
      n = this.constraints;
    t && (0, tp.X)(t) ? this.constraints || (this.constraints = this.resolveRefConstraints()) : t && i ? this.constraints = function (t, {
      top: e,
      left: i,
      bottom: n,
      right: s
    }) {
      return {
        x: tA(t.x, i, s),
        y: tA(t.y, e, n)
      };
    }(i.layoutBox, t) : this.constraints = !1, this.elastic = function (t = .35) {
      return !1 === t ? t = 0 : !0 === t && (t = .35), {
        x: tE(t, "left", "right"),
        y: tE(t, "top", "bottom")
      };
    }(e), n !== this.constraints && !(0, tp.X)(t) && i && this.constraints && !this.hasMutatedConstraints && z(t => {
      var e, n;
      let s;
      !1 !== this.constraints && this.getAxisMotionValue(t) && (this.constraints[t] = (e = i.layoutBox[t], n = this.constraints[t], s = {}, void 0 !== n.min && (s.min = n.min - e.min), void 0 !== n.max && (s.max = n.max - e.min), s));
    });
  }
  resolveRefConstraints() {
    var t;
    let {
      dragConstraints: e,
      onMeasureDragConstraints: i
    } = this.getProps();
    if (!e || !(0, tp.X)(e)) return !1;
    let n = e.current;
    (0, y.V)(null !== n, "If `dragConstraints` is set as a React ref, that ref must be passed to another component's `ref` prop.", "drag-constraints-ref");
    let {
      projection: s
    } = this.visualElement;
    if (!s || !s.layout) return !1;
    s.root && (s.root.scroll = void 0, s.root.updateScroll());
    let r = (0, w.L)(n, s.root, this.visualElement.getTransformPagePoint()),
      o = (t = s.layout.layoutBox, {
        x: tk(t.x, r.x),
        y: tk(t.y, r.y)
      });
    if (i) {
      let t = i((0, tn.pA)(o));
      this.hasMutatedConstraints = !!t, t && (o = (0, tn.FY)(t));
    }
    return o;
  }
  startAnimation(t) {
    let {
        drag: e,
        dragMomentum: i,
        dragElastic: n,
        dragTransition: s,
        dragSnapToOrigin: r,
        onDragTransitionEnd: o
      } = this.getProps(),
      a = this.constraints || {};
    return Promise.all(z(o => {
      if (!tR(o, e, this.currentDirection)) return;
      let l = a && a[o] || {};
      (!0 === r || r === o) && (l = {
        min: 0,
        max: 0
      });
      let h = {
        type: "inertia",
        velocity: i ? t[o] : 0,
        bounceStiffness: n ? 200 : 1e6,
        bounceDamping: n ? 40 : 1e7,
        timeConstant: 750,
        restDelta: 1,
        restSpeed: 10,
        ...s,
        ...l
      };
      return this.startAxisValueAnimation(o, h);
    })).then(o);
  }
  startAxisValueAnimation(t, e) {
    let i = this.getAxisMotionValue(t);
    return (0, ti.g)(this.visualElement, t), i.start((0, ts.f)(t, i, 0, e, this.visualElement, !1));
  }
  stopAnimation() {
    z(t => this.getAxisMotionValue(t).stop());
  }
  getAxisMotionValue(t) {
    let e = `_drag${t.toUpperCase()}`;
    return this.visualElement.getProps()[e] || this.visualElement.getValue(t, this.visualElement.latestValues[t] ?? 0);
  }
  snapToCursor(t) {
    z(e => {
      let {
        drag: i
      } = this.getProps();
      if (!tR(e, i, this.currentDirection)) return;
      let {
          projection: n
        } = this.visualElement,
        s = this.getAxisMotionValue(e);
      if (n && n.layout) {
        let {
            min: i,
            max: r
          } = n.layout.layoutBox[e],
          o = s.get() || 0;
        s.set(t[e] - (0, q.k)(i, r, .5) + o);
      }
    });
  }
  scalePositionWithinConstraints() {
    if (!this.visualElement.current) return;
    let {
        drag: t,
        dragConstraints: e
      } = this.getProps(),
      {
        projection: i
      } = this.visualElement;
    if (!(0, tp.X)(e) || !i || !this.constraints) return;
    this.stopAnimation();
    let n = {
      x: 0,
      y: 0
    };
    z(t => {
      let e = this.getAxisMotionValue(t);
      if (e && !1 !== this.constraints) {
        var i, s;
        let r,
          o,
          a,
          l = e.get();
        n[t] = (i = {
          min: l,
          max: l
        }, s = this.constraints[t], r = .5, o = Y(i), (a = Y(s)) > o ? r = (0, tT.q)(s.min, s.max - o, i.min) : o > a && (r = (0, tT.q)(i.min, i.max - a, s.min)), (0, tP.q)(0, 1, r));
      }
    });
    let {
      transformTemplate: s
    } = this.visualElement.getProps();
    this.visualElement.current.style.transform = s ? s({}, "") : "none", i.root && i.root.updateScroll(), i.updateLayout(), this.constraints = !1, this.resolveConstraints(), z(e => {
      if (!tR(e, t, null)) return;
      let i = this.getAxisMotionValue(e),
        {
          min: s,
          max: r
        } = this.constraints[e];
      i.set((0, q.k)(s, r, n[e]));
    }), this.visualElement.render();
  }
  addListeners() {
    let t;
    if (!this.visualElement.current) return;
    tC.set(this.visualElement, this);
    let e = this.visualElement.current,
      i = td(e, "pointerdown", t => {
        let {
            drag: i,
            dragListener: n = !0
          } = this.getProps(),
          s = t.target,
          r = s !== e && (to.has(s.tagName) || !0 === s.isContentEditable);
        i && n && !r && this.start(t);
      }),
      n = () => {
        var i, n, s;
        let r,
          o,
          {
            dragConstraints: a
          } = this.getProps();
        (0, tp.X)(a) && a.current && (this.constraints = this.resolveRefConstraints(), t || (i = e, n = a.current, s = () => this.scalePositionWithinConstraints(), r = (0, tl.X)(i, tD(s)), o = (0, tl.X)(n, tD(s)), t = () => {
          r(), o();
        }));
      },
      {
        projection: s
      } = this.visualElement,
      r = s.addEventListener("measure", n);
    s && !s.layout && (s.root && s.root.updateScroll(), s.updateLayout()), te.Gt.read(n);
    let o = ta(window, "resize", () => this.scalePositionWithinConstraints()),
      a = s.addEventListener("didUpdate", ({
        delta: t,
        hasLayoutChanged: e
      }) => {
        this.isDragging && e && (z(e => {
          let i = this.getAxisMotionValue(e);
          i && (this.originPoint[e] += t[e].translate, i.set(i.get() + t[e].translate));
        }), this.visualElement.render());
      });
    return () => {
      o(), i(), r(), a && a(), t && t();
    };
  }
  getProps() {
    let t = this.visualElement.getProps(),
      {
        drag: e = !1,
        dragDirectionLock: i = !1,
        dragPropagation: n = !1,
        dragConstraints: s = !1,
        dragElastic: r = .35,
        dragMomentum: o = !0
      } = t;
    return {
      ...t,
      drag: e,
      dragDirectionLock: i,
      dragPropagation: n,
      dragConstraints: s,
      dragElastic: r,
      dragMomentum: o
    };
  }
}
function tD(t) {
  let e = !0;
  return () => {
    if (e) {
      e = !1;
      return;
    }
    t();
  };
}
function tR(t, e, i) {
  return (!0 === e || e === t) && (null === i || i === t);
}
class tL extends E {
  constructor(t) {
    super(t), this.removeGroupControls = G.l, this.removeListeners = G.l, this.controls = new tM(t);
  }
  mount() {
    let {
      dragControls: t
    } = this.node.getProps();
    t && (this.removeGroupControls = t.subscribe(this.controls)), this.removeListeners = this.controls.addListeners() || G.l;
  }
  update() {
    let {
        dragControls: t
      } = this.node.getProps(),
      {
        dragControls: e
      } = this.node.prevProps || {};
    t !== e && (this.removeGroupControls(), t && (this.removeGroupControls = t.subscribe(this.controls)));
  }
  unmount() {
    this.removeGroupControls(), this.removeListeners(), this.controls.isDragging || this.controls.endPanSession();
  }
}
let tB = t => (e, i) => {
  t && te.Gt.update(() => t(e, i), !1, !0);
};
class tj extends E {
  constructor() {
    super(...arguments), this.removePointerDownListener = G.l;
  }
  onPointerDown(t) {
    this.session = new tg(t, this.createPanHandlers(), {
      transformPagePoint: this.node.getTransformPagePoint(),
      contextWindow: tc(this.node)
    });
  }
  createPanHandlers() {
    let {
      onPanSessionStart: t,
      onPanStart: e,
      onPan: i,
      onPanEnd: n
    } = this.node.getProps();
    return {
      onSessionStart: tB(t),
      onStart: tB(e),
      onMove: tB(i),
      onEnd: (t, e) => {
        delete this.session, n && te.Gt.postRender(() => n(t, e));
      }
    };
  }
  mount() {
    this.removePointerDownListener = td(this.node.current, "pointerdown", t => this.onPointerDown(t));
  }
  update() {
    this.session && this.session.updateHandlers(this.createPanHandlers());
  }
  unmount() {
    this.removePointerDownListener(), this.session && this.session.end();
  }
}
var tF = require("react/jsx-runtime");
let tO = {
  hasAnimatedSinceResize: !0,
  hasEverUpdated: !1
};
var tI = require("./38873.cjs"),
  tW = require("./79196.cjs"),
  tU = require("./39551.cjs"),
  tN = require("./59299.cjs");
let t$ = !1;
class tX extends P.Component {
  componentDidMount() {
    let {
        visualElement: t,
        layoutGroup: e,
        switchLayoutGroup: i,
        layoutId: n
      } = this.props,
      {
        projection: s
      } = t;
    s && (e.group && e.group.add(s), i && i.register && n && i.register(s), t$ && s.root.didUpdate(), s.addEventListener("animationComplete", () => {
      this.safeToRemove();
    }), s.setOptions({
      ...s.options,
      layoutDependency: this.props.layoutDependency,
      onExitComplete: () => this.safeToRemove()
    })), tO.hasEverUpdated = !0;
  }
  getSnapshotBeforeUpdate(t) {
    let {
        layoutDependency: e,
        visualElement: i,
        drag: n,
        isPresent: s
      } = this.props,
      {
        projection: r
      } = i;
    return r && (r.isPresent = s, t.layoutDependency !== e && r.setOptions({
      ...r.options,
      layoutDependency: e
    }), t$ = !0, n || t.layoutDependency !== e || void 0 === e || t.isPresent !== s ? r.willUpdate() : this.safeToRemove(), t.isPresent !== s && (s ? r.promote() : r.relegate() || te.Gt.postRender(() => {
      let t = r.getStack();
      t && t.members.length || this.safeToRemove();
    }))), null;
  }
  componentDidUpdate() {
    let {
        visualElement: t,
        layoutAnchor: e
      } = this.props,
      {
        projection: i
      } = t;
    i && (i.options.layoutAnchor = e, i.root.didUpdate(), tI.k.postRender(() => {
      !i.currentAnimation && i.isLead() && this.safeToRemove();
    }));
  }
  componentWillUnmount() {
    let {
        visualElement: t,
        layoutGroup: e,
        switchLayoutGroup: i
      } = this.props,
      {
        projection: n
      } = t;
    t$ = !0, n && (n.scheduleCheckAfterUnmount(), e && e.group && e.group.remove(n), i && i.deregister && i.deregister(n));
  }
  safeToRemove() {
    let {
      safeToRemove: t
    } = this.props;
    t && t();
  }
  render() {
    return null;
  }
}
function tG(t) {
  let [e, i] = (0, tW.xQ)(),
    n = (0, P.useContext)(tU.L);
  return (0, tF.jsx)(tX, {
    ...t,
    layoutGroup: n,
    switchLayoutGroup: (0, P.useContext)(tN.N),
    isPresent: e,
    safeToRemove: i
  });
}
var tK = require("./73852.cjs"),
  tz = require("./72721.cjs"),
  tH = require("./14432.cjs"),
  tq = require("./61151.cjs"),
  tY = require("./75319.cjs"),
  t_ = require("./37035.cjs"),
  tQ = require("./21872.cjs"),
  tZ = require("./69028.cjs"),
  tJ = require("./6900.cjs"),
  t0 = require("./10583.cjs"),
  t1 = require("./89722.cjs"),
  t2 = require("./33177.cjs");
let t5 = t2.S.length,
  t3 = t => "string" == typeof t ? parseFloat(t) : t,
  t9 = t => "number" == typeof t || H.px.test(t);
function t4(t, e) {
  return void 0 !== t[e] ? t[e] : t.borderRadius;
}
let t6 = t8(0, .5, t1.yT),
  t7 = t8(.5, .95, G.l);
function t8(t, e, i) {
  return n => n < t ? 0 : n > e ? 1 : i((0, tT.q)(t, e, n));
}
function et(t, e) {
  t.min = e.min, t.max = e.max;
}
function ee(t, e) {
  et(t.x, e.x), et(t.y, e.y);
}
function ei(t, e) {
  t.translate = e.translate, t.scale = e.scale, t.originPoint = e.originPoint, t.origin = e.origin;
}
var en = require("./2988.cjs");
function es(t, e, i, n, s) {
  return t -= e, t = (0, en.hq)(t, 1 / i, n), void 0 !== s && (t = (0, en.hq)(t, 1 / s, n)), t;
}
function er(t, e, [i, n, s], r, o) {
  !function (t, e = 0, i = 1, n = .5, s, r = t, o = t) {
    if (H.KN.test(e) && (e = parseFloat(e), e = (0, q.k)(o.min, o.max, e / 100) - o.min), "number" != typeof e) return;
    let a = (0, q.k)(r.min, r.max, n);
    t === r && (a -= e), t.min = es(t.min, e, i, a, s), t.max = es(t.max, e, i, a, s);
  }(t, e[i], e[n], e[s], e.scale, r, o);
}
let eo = ["x", "scaleX", "originX"],
  ea = ["y", "scaleY", "originY"];
function el(t, e, i, n) {
  er(t.x, e, eo, i ? i.x : void 0, n ? n.x : void 0), er(t.y, e, ea, i ? i.y : void 0, n ? n.y : void 0);
}
function eh(t) {
  return 0 === t.translate && 1 === t.scale;
}
function eu(t) {
  return eh(t.x) && eh(t.y);
}
function ed(t, e) {
  return t.min === e.min && t.max === e.max;
}
function ec(t, e) {
  return Math.round(t.min) === Math.round(e.min) && Math.round(t.max) === Math.round(e.max);
}
function ep(t, e) {
  return ec(t.x, e.x) && ec(t.y, e.y);
}
function em(t) {
  return Y(t.x) / Y(t.y);
}
function ef(t, e) {
  return t.translate === e.translate && t.scale === e.scale && t.originPoint === e.originPoint;
}
var ev = require("./78170.cjs");
class ey {
  constructor() {
    this.members = [];
  }
  add(t) {
    (0, ev.Kq)(this.members, t);
    for (let e = this.members.length - 1; e >= 0; e--) {
      let i = this.members[e];
      if (i === t || i === this.lead || i === this.prevLead) continue;
      let n = i.instance;
      n && !1 !== n.isConnected || i.snapshot || ((0, ev.Ai)(this.members, i), i.unmount());
    }
    t.scheduleRender();
  }
  remove(t) {
    if ((0, ev.Ai)(this.members, t), t === this.prevLead && (this.prevLead = void 0), t === this.lead) {
      let t = this.members[this.members.length - 1];
      t && this.promote(t);
    }
  }
  relegate(t) {
    for (let e = this.members.indexOf(t) - 1; e >= 0; e--) {
      let t = this.members[e];
      if (!1 !== t.isPresent && t.instance?.isConnected !== !1) return this.promote(t), !0;
    }
    return !1;
  }
  promote(t, e) {
    let i = this.lead;
    if (t !== i && (this.prevLead = i, this.lead = t, t.show(), i)) {
      i.updateSnapshot(), t.scheduleRender();
      let {
          layoutDependency: n
        } = i.options,
        {
          layoutDependency: s
        } = t.options;
      (void 0 === n || n !== s) && (t.resumeFrom = i, e && (i.preserveOpacity = !0), i.snapshot && (t.snapshot = i.snapshot, t.snapshot.latestValues = i.animationValues || i.latestValues), t.root?.isUpdating && (t.isLayoutDirty = !0)), !1 === t.options.crossfade && i.hide();
    }
  }
  exitAnimationComplete() {
    this.members.forEach(t => {
      t.options.onExitComplete?.(), t.resumingFrom?.options.onExitComplete?.();
    });
  }
  scheduleRender() {
    this.members.forEach(t => t.instance && t.scheduleRender(!1));
  }
  removeLeadSnapshot() {
    this.lead?.snapshot && (this.lead.snapshot = void 0);
  }
}
let eg = (t, e) => t.depth - e.depth;
class ex {
  constructor() {
    this.children = [], this.isDirty = !1;
  }
  add(t) {
    (0, ev.Kq)(this.children, t), this.isDirty = !0;
  }
  remove(t) {
    (0, ev.Ai)(this.children, t), this.isDirty = !0;
  }
  forEach(t) {
    this.isDirty && this.children.sort(eg), this.isDirty = !1, this.children.forEach(t);
  }
}
var ew = require("./33411.cjs");
let eS = ["", "X", "Y", "Z"],
  eb = 0;
function eT(t, e, i, n) {
  let {
    latestValues: s
  } = e;
  s[t] && (i[t] = s[t], e.setStaticValue(t, 0), n && (n[t] = 0));
}
function eP({
  attachResizeListener: t,
  defaultParent: e,
  measureScroll: i,
  checkIsScrollRoot: n,
  resetTransform: s
}) {
  return class {
    constructor(t = {}, i = e?.()) {
      this.id = eb++, this.animationId = 0, this.animationCommitId = 0, this.children = new Set(), this.options = {}, this.isTreeAnimating = !1, this.isAnimationBlocked = !1, this.isLayoutDirty = !1, this.isProjectionDirty = !1, this.isSharedProjectionDirty = !1, this.isTransformDirty = !1, this.updateManuallyBlocked = !1, this.updateBlockedByResize = !1, this.isUpdating = !1, this.isSVG = !1, this.needsReset = !1, this.shouldResetTransform = !1, this.hasCheckedOptimisedAppear = !1, this.treeScale = {
        x: 1,
        y: 1
      }, this.eventHandlers = new Map(), this.hasTreeAnimated = !1, this.layoutVersion = 0, this.updateScheduled = !1, this.scheduleUpdate = () => this.update(), this.projectionUpdateScheduled = !1, this.checkUpdateFailed = () => {
        this.isUpdating && (this.isUpdating = !1, this.clearAllSnapshots());
      }, this.updateProjection = () => {
        this.projectionUpdateScheduled = !1, this.nodes.forEach(eE), this.nodes.forEach(eF), this.nodes.forEach(eO), this.nodes.forEach(eV);
      }, this.resolvedRelativeTargetAt = 0, this.linkedParentVersion = 0, this.hasProjected = !1, this.isVisible = !0, this.animationProgress = 0, this.sharedNodes = new Map(), this.latestValues = t, this.root = i ? i.root || i : this, this.path = i ? [...i.path, i] : [], this.parent = i, this.depth = i ? i.depth + 1 : 0;
      for (let t = 0; t < this.path.length; t++) this.path[t].shouldResetTransform = !0;
      this.root === this && (this.nodes = new ex());
    }
    addEventListener(t, e) {
      return this.eventHandlers.has(t) || this.eventHandlers.set(t, new tK.v()), this.eventHandlers.get(t).add(e);
    }
    notifyListeners(t, ...e) {
      let i = this.eventHandlers.get(t);
      i && i.notify(...e);
    }
    hasListeners(t) {
      return this.eventHandlers.has(t);
    }
    mount(e) {
      if (this.instance) return;
      this.isSVG = (0, tZ.x)(e) && (!(0, tZ.x)(e) || "svg" !== e.tagName), this.instance = e;
      let {
        layoutId: i,
        layout: n,
        visualElement: s
      } = this.options;
      if (s && !s.current && s.mount(e), this.root.nodes.add(this), this.parent && this.parent.children.add(this), this.root.hasTreeAnimated && (n || i) && (this.isLayoutDirty = !0), t) {
        let i,
          n = 0,
          s = () => this.root.updateBlockedByResize = !1;
        te.Gt.read(() => {
          n = window.innerWidth;
        }), t(e, () => {
          let t = window.innerWidth;
          if (t !== n) {
            let e, r;
            n = t, this.root.updateBlockedByResize = !0, i && i(), e = t_.k.now(), r = ({
              timestamp: t
            }) => {
              let i = t - e;
              i >= 250 && ((0, te.WG)(r), s());
            }, te.Gt.setup(r, !0), i = () => (0, te.WG)(r), tO.hasAnimatedSinceResize && (tO.hasAnimatedSinceResize = !1, this.nodes.forEach(ej));
          }
        });
      }
      i && this.root.registerSharedNode(i, this), !1 !== this.options.animate && s && (i || n) && this.addEventListener("didUpdate", ({
        delta: t,
        hasLayoutChanged: e,
        hasRelativeLayoutChanged: i,
        layout: n
      }) => {
        if (this.isTreeAnimationBlocked()) {
          this.target = void 0, this.relativeTarget = void 0;
          return;
        }
        let r = this.options.transition || s.getDefaultTransition() || eX,
          {
            onLayoutAnimationStart: o,
            onLayoutAnimationComplete: a
          } = s.getProps(),
          l = !this.targetLayout || !ep(this.targetLayout, n),
          h = !e && i;
        if (this.options.layoutRoot || this.resumeFrom || h || e && (l || !this.currentAnimation)) {
          this.resumeFrom && (this.resumingFrom = this.resumeFrom, this.resumingFrom.resumingFrom = void 0);
          let e = {
            ...(0, tY.r)(r, "layout"),
            onPlay: o,
            onComplete: a
          };
          (s.shouldReduceMotion || this.options.layoutRoot) && (e.delay = 0, e.type = !1), this.startAnimation(e), this.setAnimationOrigin(t, h, e.path);
        } else e || ej(this), this.isLead() && this.options.onExitComplete && this.options.onExitComplete();
        this.targetLayout = n;
      });
    }
    unmount() {
      this.options.layoutId && this.willUpdate(), this.root.nodes.remove(this);
      let t = this.getStack();
      t && t.remove(this), this.parent && this.parent.children.delete(this), this.instance = void 0, this.eventHandlers.clear(), (0, te.WG)(this.updateProjection);
    }
    blockUpdate() {
      this.updateManuallyBlocked = !0;
    }
    unblockUpdate() {
      this.updateManuallyBlocked = !1;
    }
    isUpdateBlocked() {
      return this.updateManuallyBlocked || this.updateBlockedByResize;
    }
    isTreeAnimationBlocked() {
      return this.isAnimationBlocked || this.parent && this.parent.isTreeAnimationBlocked() || !1;
    }
    startUpdate() {
      !this.isUpdateBlocked() && (this.isUpdating = !0, this.nodes && this.nodes.forEach(eI), this.animationId++);
    }
    getTransformTemplate() {
      let {
        visualElement: t
      } = this.options;
      return t && t.getProps().transformTemplate;
    }
    willUpdate(t = !0) {
      if (this.root.hasTreeAnimated = !0, this.root.isUpdateBlocked()) {
        this.options.onExitComplete && this.options.onExitComplete();
        return;
      }
      if (window.MotionCancelOptimisedAnimation && !this.hasCheckedOptimisedAppear && function t(e) {
        if (e.hasCheckedOptimisedAppear = !0, e.root === e) return;
        let {
          visualElement: i
        } = e.options;
        if (!i) return;
        let n = (0, tq.P)(i);
        if (window.MotionHasOptimisedAnimation(n, "transform")) {
          let {
            layout: t,
            layoutId: i
          } = e.options;
          window.MotionCancelOptimisedAnimation(n, "transform", te.Gt, !(t || i));
        }
        let {
          parent: s
        } = e;
        s && !s.hasCheckedOptimisedAppear && t(s);
      }(this), this.root.isUpdating || this.root.startUpdate(), this.isLayoutDirty) return;
      this.isLayoutDirty = !0;
      for (let t = 0; t < this.path.length; t++) {
        let e = this.path[t];
        e.shouldResetTransform = !0, ("string" == typeof e.latestValues.x || "string" == typeof e.latestValues.y) && (e.isLayoutDirty = !0), e.updateScroll("snapshot"), e.options.layoutRoot && e.willUpdate(!1);
      }
      let {
        layoutId: e,
        layout: i
      } = this.options;
      if (void 0 === e && !i) return;
      let n = this.getTransformTemplate();
      this.prevTransformTemplateValue = n ? n(this.latestValues, "") : void 0, this.updateSnapshot(), t && this.notifyListeners("willUpdate");
    }
    update() {
      if (this.updateScheduled = !1, this.isUpdateBlocked()) {
        let t = this.updateBlockedByResize;
        this.unblockUpdate(), this.updateBlockedByResize = !1, this.clearAllSnapshots(), t && this.nodes.forEach(eD), this.nodes.forEach(eM);
        return;
      }
      if (this.animationId <= this.animationCommitId) return void this.nodes.forEach(eR);
      this.animationCommitId = this.animationId, this.isUpdating ? (this.isUpdating = !1, this.nodes.forEach(eL), this.nodes.forEach(eB), this.nodes.forEach(eA), this.nodes.forEach(ek)) : this.nodes.forEach(eR), this.clearAllSnapshots();
      let t = t_.k.now();
      te.uv.delta = (0, tP.q)(0, 1e3 / 60, t - te.uv.timestamp), te.uv.timestamp = t, te.uv.isProcessing = !0, te.PP.update.process(te.uv), te.PP.preRender.process(te.uv), te.PP.render.process(te.uv), te.uv.isProcessing = !1;
    }
    didUpdate() {
      this.updateScheduled || (this.updateScheduled = !0, tI.k.read(this.scheduleUpdate));
    }
    clearAllSnapshots() {
      this.nodes.forEach(eC), this.sharedNodes.forEach(eW);
    }
    scheduleUpdateProjection() {
      this.projectionUpdateScheduled || (this.projectionUpdateScheduled = !0, te.Gt.preRender(this.updateProjection, !1, !0));
    }
    scheduleCheckAfterUnmount() {
      te.Gt.postRender(() => {
        this.isLayoutDirty ? this.root.didUpdate() : this.root.checkUpdateFailed();
      });
    }
    updateSnapshot() {
      !this.snapshot && this.instance && (this.snapshot = this.measure(), !this.snapshot || Y(this.snapshot.measuredBox.x) || Y(this.snapshot.measuredBox.y) || (this.snapshot = void 0));
    }
    updateLayout() {
      if (!this.instance || (this.updateScroll(), !(this.options.alwaysMeasureLayout && this.isLead()) && !this.isLayoutDirty)) return;
      if (this.resumeFrom && !this.resumeFrom.instance) for (let t = 0; t < this.path.length; t++) this.path[t].updateScroll();
      let t = this.layout;
      this.layout = this.measure(!1), this.layoutVersion++, this.layoutCorrected || (this.layoutCorrected = (0, r.ge)()), this.isLayoutDirty = !1, this.projectionDelta = void 0, this.notifyListeners("measure", this.layout.layoutBox);
      let {
        visualElement: e
      } = this.options;
      e && e.notify("LayoutMeasure", this.layout.layoutBox, t ? t.layoutBox : void 0);
    }
    updateScroll(t = "measure") {
      let e = !!(this.options.layoutScroll && this.instance);
      if (this.scroll && this.scroll.animationId === this.root.animationId && this.scroll.phase === t && (e = !1), e && this.instance) {
        let e = n(this.instance);
        this.scroll = {
          animationId: this.root.animationId,
          phase: t,
          isRoot: e,
          offset: i(this.instance),
          wasRoot: this.scroll ? this.scroll.isRoot : e
        };
      }
    }
    resetTransform() {
      if (!s) return;
      let t = this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout,
        e = this.projectionDelta && !eu(this.projectionDelta),
        i = this.getTransformTemplate(),
        n = i ? i(this.latestValues, "") : void 0,
        r = n !== this.prevTransformTemplateValue;
      t && this.instance && (e || (0, ew.HD)(this.latestValues) || r) && (s(this.instance, n), this.shouldResetTransform = !1, this.scheduleRender());
    }
    measure(t = !0) {
      var e;
      let i = this.measurePageBox(),
        n = this.removeElementScroll(i);
      return t && (n = this.removeTransform(n)), ez((e = n).x), ez(e.y), {
        animationId: this.root.animationId,
        measuredBox: i,
        layoutBox: n,
        latestValues: {},
        source: this.id
      };
    }
    measurePageBox() {
      let {
        visualElement: t
      } = this.options;
      if (!t) return (0, r.ge)();
      let e = t.measureViewportBox();
      if (!(this.scroll?.wasRoot || this.path.some(eq))) {
        let {
          scroll: t
        } = this.root;
        t && ((0, en.Ql)(e.x, t.offset.x), (0, en.Ql)(e.y, t.offset.y));
      }
      return e;
    }
    removeElementScroll(t) {
      let e = (0, r.ge)();
      if (ee(e, t), this.scroll?.wasRoot) return e;
      for (let i = 0; i < this.path.length; i++) {
        let n = this.path[i],
          {
            scroll: s,
            options: r
          } = n;
        n !== this.root && s && r.layoutScroll && (s.wasRoot && ee(e, t), (0, en.Ql)(e.x, s.offset.x), (0, en.Ql)(e.y, s.offset.y));
      }
      return e;
    }
    applyTransform(t, e = !1, i) {
      let n = i || (0, r.ge)();
      ee(n, t);
      for (let t = 0; t < this.path.length; t++) {
        let i = this.path[t];
        !e && i.options.layoutScroll && i.scroll && i !== i.root && ((0, en.Ql)(n.x, -i.scroll.offset.x), (0, en.Ql)(n.y, -i.scroll.offset.y)), (0, ew.HD)(i.latestValues) && (0, en.Ww)(n, i.latestValues, i.layout?.layoutBox);
      }
      return (0, ew.HD)(this.latestValues) && (0, en.Ww)(n, this.latestValues, this.layout?.layoutBox), n;
    }
    removeTransform(t) {
      let e = (0, r.ge)();
      ee(e, t);
      for (let t = 0; t < this.path.length; t++) {
        let i,
          n = this.path[t];
        (0, ew.HD)(n.latestValues) && (n.instance && ((0, ew.vk)(n.latestValues) && n.updateSnapshot(), ee(i = (0, r.ge)(), n.measurePageBox())), el(e, n.latestValues, n.snapshot?.layoutBox, i));
      }
      return (0, ew.HD)(this.latestValues) && el(e, this.latestValues), e;
    }
    setTargetDelta(t) {
      this.targetDelta = t, this.root.scheduleUpdateProjection(), this.isProjectionDirty = !0;
    }
    setOptions(t) {
      this.options = {
        ...this.options,
        ...t,
        crossfade: void 0 === t.crossfade || t.crossfade
      };
    }
    clearMeasurements() {
      this.scroll = void 0, this.layout = void 0, this.snapshot = void 0, this.prevTransformTemplateValue = void 0, this.targetDelta = void 0, this.target = void 0, this.isLayoutDirty = !1;
    }
    forceRelativeParentToResolveTarget() {
      this.relativeParent && this.relativeParent.resolvedRelativeTargetAt !== te.uv.timestamp && this.relativeParent.resolveTargetDelta(!0);
    }
    resolveTargetDelta(t = !1) {
      let e = this.getLead();
      this.isProjectionDirty || (this.isProjectionDirty = e.isProjectionDirty), this.isTransformDirty || (this.isTransformDirty = e.isTransformDirty), this.isSharedProjectionDirty || (this.isSharedProjectionDirty = e.isSharedProjectionDirty);
      let i = !!this.resumingFrom || this !== e;
      if (!(t || i && this.isSharedProjectionDirty || this.isProjectionDirty || this.parent?.isProjectionDirty || this.attemptToResolveRelativeTarget || this.root.updateBlockedByResize)) return;
      let {
        layout: n,
        layoutId: s
      } = this.options;
      if (!this.layout || !(n || s)) return;
      this.resolvedRelativeTargetAt = te.uv.timestamp;
      let o = this.getClosestProjectingParent();
      if (o && this.linkedParentVersion !== o.layoutVersion && !o.options.layoutRoot && this.removeRelativeTarget(), this.targetDelta || this.relativeTarget || (!1 !== this.options.layoutAnchor && o && o.layout ? this.createRelativeTarget(o, this.layout.layoutBox, o.layout.layoutBox) : this.removeRelativeTarget()), this.relativeTarget || this.targetDelta) {
        if (this.target || (this.target = (0, r.ge)(), this.targetWithTransforms = (0, r.ge)()), this.relativeTarget && this.relativeTargetOrigin && this.relativeParent && this.relativeParent.target) {
          var a, l, h, u;
          this.forceRelativeParentToResolveTarget(), a = this.target, l = this.relativeTarget, h = this.relativeParent.target, u = this.options.layoutAnchor || void 0, Z(a.x, l.x, h.x, u?.x), Z(a.y, l.y, h.y, u?.y);
        } else this.targetDelta ? (this.resumingFrom ? this.applyTransform(this.layout.layoutBox, !1, this.target) : ee(this.target, this.layout.layoutBox), (0, en.o4)(this.target, this.targetDelta)) : ee(this.target, this.layout.layoutBox);
        this.attemptToResolveRelativeTarget && (this.attemptToResolveRelativeTarget = !1, !1 !== this.options.layoutAnchor && o && !!o.resumingFrom == !!this.resumingFrom && !o.options.layoutScroll && o.target && 1 !== this.animationProgress ? this.createRelativeTarget(o, this.target, o.target) : this.relativeParent = this.relativeTarget = void 0);
      }
    }
    getClosestProjectingParent() {
      if (!(!this.parent || (0, ew.vk)(this.parent.latestValues) || (0, ew.vF)(this.parent.latestValues))) if (this.parent.isProjecting()) return this.parent;else return this.parent.getClosestProjectingParent();
    }
    isProjecting() {
      return !!((this.relativeTarget || this.targetDelta || this.options.layoutRoot) && this.layout);
    }
    createRelativeTarget(t, e, i) {
      this.relativeParent = t, this.linkedParentVersion = t.layoutVersion, this.forceRelativeParentToResolveTarget(), this.relativeTarget = (0, r.ge)(), this.relativeTargetOrigin = (0, r.ge)(), tt(this.relativeTargetOrigin, e, i, this.options.layoutAnchor || void 0), ee(this.relativeTarget, this.relativeTargetOrigin);
    }
    removeRelativeTarget() {
      this.relativeParent = this.relativeTarget = void 0;
    }
    calcProjection() {
      let t = this.getLead(),
        e = !!this.resumingFrom || this !== t,
        i = !0;
      if ((this.isProjectionDirty || this.parent?.isProjectionDirty) && (i = !1), e && (this.isSharedProjectionDirty || this.isTransformDirty) && (i = !1), this.resolvedRelativeTargetAt === te.uv.timestamp && (i = !1), i) return;
      let {
        layout: n,
        layoutId: s
      } = this.options;
      if (this.isTreeAnimating = !!(this.parent && this.parent.isTreeAnimating || this.currentAnimation || this.pendingAnimation), this.isTreeAnimating || (this.targetDelta = this.relativeTarget = void 0), !this.layout || !(n || s)) return;
      ee(this.layoutCorrected, this.layout.layoutBox);
      let o = this.treeScale.x,
        a = this.treeScale.y;
      (0, en.OU)(this.layoutCorrected, this.treeScale, this.path, e), t.layout && !t.target && (1 !== this.treeScale.x || 1 !== this.treeScale.y) && (t.target = t.layout.layoutBox, t.targetWithTransforms = (0, r.ge)());
      let {
        target: l
      } = t;
      if (!l) {
        this.prevProjectionDelta && (this.createProjectionDeltas(), this.scheduleRender());
        return;
      }
      this.projectionDelta && this.prevProjectionDelta ? (ei(this.prevProjectionDelta.x, this.projectionDelta.x), ei(this.prevProjectionDelta.y, this.projectionDelta.y)) : this.createProjectionDeltas(), Q(this.projectionDelta, this.layoutCorrected, l, this.latestValues), this.treeScale.x === o && this.treeScale.y === a && ef(this.projectionDelta.x, this.prevProjectionDelta.x) && ef(this.projectionDelta.y, this.prevProjectionDelta.y) || (this.hasProjected = !0, this.scheduleRender(), this.notifyListeners("projectionUpdate", l));
    }
    hide() {
      this.isVisible = !1;
    }
    show() {
      this.isVisible = !0;
    }
    scheduleRender(t = !0) {
      if (this.options.visualElement?.scheduleRender(), t) {
        let t = this.getStack();
        t && t.scheduleRender();
      }
      this.resumingFrom && !this.resumingFrom.instance && (this.resumingFrom = void 0);
    }
    createProjectionDeltas() {
      this.prevProjectionDelta = (0, r.xU)(), this.projectionDelta = (0, r.xU)(), this.projectionDeltaWithTransform = (0, r.xU)();
    }
    setAnimationOrigin(t, e = !1, i) {
      let n,
        s = this.snapshot,
        o = s ? s.latestValues : {},
        a = {
          ...this.latestValues
        },
        l = (0, r.xU)();
      this.relativeParent && this.relativeParent.options.layoutRoot || (this.relativeTarget = this.relativeTargetOrigin = void 0), this.attemptToResolveRelativeTarget = !e;
      let h = (0, r.ge)(),
        u = (s ? s.source : void 0) !== (this.layout ? this.layout.source : void 0),
        d = this.getStack(),
        c = !d || d.members.length <= 1,
        p = !!(u && !c && !0 === this.options.crossfade && !this.path.some(e$));
      this.animationProgress = 0;
      let m = i?.interpolateProjection(t);
      this.mixTargetDelta = e => {
        let i = e / 1e3,
          s = m?.(i);
        if (s ? (l.x.translate = s.x, l.x.scale = (0, q.k)(t.x.scale, 1, i), l.x.origin = t.x.origin, l.x.originPoint = t.x.originPoint, l.y.translate = s.y, l.y.scale = (0, q.k)(t.y.scale, 1, i), l.y.origin = t.y.origin, l.y.originPoint = t.y.originPoint) : (eU(l.x, t.x, i), eU(l.y, t.y, i)), this.setTargetDelta(l), this.relativeTarget && this.relativeTargetOrigin && this.layout && this.relativeParent && this.relativeParent.layout) {
          var d, f, v, y, g, x;
          tt(h, this.layout.layoutBox, this.relativeParent.layout.layoutBox, this.options.layoutAnchor || void 0), v = this.relativeTarget, y = this.relativeTargetOrigin, g = h, x = i, eN(v.x, y.x, g.x, x), eN(v.y, y.y, g.y, x), n && (d = this.relativeTarget, f = n, ed(d.x, f.x) && ed(d.y, f.y)) && (this.isProjectionDirty = !1), n || (n = (0, r.ge)()), ee(n, this.relativeTarget);
        }
        u && (this.animationValues = a, function (t, e, i, n, s, r) {
          s ? (t.opacity = (0, q.k)(0, i.opacity ?? 1, t6(n)), t.opacityExit = (0, q.k)(e.opacity ?? 1, 0, t7(n))) : r && (t.opacity = (0, q.k)(e.opacity ?? 1, i.opacity ?? 1, n));
          for (let s = 0; s < t5; s++) {
            let r = t2.S[s],
              o = t4(e, r),
              a = t4(i, r);
            (void 0 !== o || void 0 !== a) && (o || (o = 0), a || (a = 0), 0 === o || 0 === a || t9(o) === t9(a) ? (t[r] = Math.max((0, q.k)(t3(o), t3(a), n), 0), (H.KN.test(a) || H.KN.test(o)) && (t[r] += "%")) : t[r] = a);
          }
          (e.rotate || i.rotate) && (t.rotate = (0, q.k)(e.rotate || 0, i.rotate || 0, n));
        }(a, o, this.latestValues, i, p, c)), s && void 0 !== s.rotate && (this.animationValues || (this.animationValues = a), this.animationValues.pathRotation = s.rotate), this.root.scheduleUpdateProjection(), this.scheduleRender(), this.animationProgress = i;
      }, this.mixTargetDelta(1e3 * !!this.options.layoutRoot);
    }
    startAnimation(t) {
      this.notifyListeners("animationStart"), this.currentAnimation?.stop(), this.resumingFrom?.currentAnimation?.stop(), this.pendingAnimation && ((0, te.WG)(this.pendingAnimation), this.pendingAnimation = void 0), this.pendingAnimation = te.Gt.update(() => {
        tO.hasAnimatedSinceResize = !0, this.motionValue || (this.motionValue = (0, tJ.OQ)(0)), this.motionValue.jump(0, !1), this.currentAnimation = (0, tz.z)(this.motionValue, [0, 1e3], {
          ...t,
          velocity: 0,
          isSync: !0,
          onUpdate: e => {
            this.mixTargetDelta(e), t.onUpdate && t.onUpdate(e);
          },
          onComplete: () => {
            t.onComplete && t.onComplete(), this.completeAnimation();
          }
        }), (0, tH.m)(this.currentAnimation, this), this.resumingFrom && (this.resumingFrom.currentAnimation = this.currentAnimation), this.pendingAnimation = void 0;
      });
    }
    completeAnimation() {
      this.resumingFrom && (this.resumingFrom.currentAnimation = void 0, this.resumingFrom.preserveOpacity = void 0);
      let t = this.getStack();
      t && t.exitAnimationComplete(), this.resumingFrom = this.currentAnimation = this.animationValues = void 0, this.notifyListeners("animationComplete");
    }
    finishAnimation() {
      this.currentAnimation && (this.mixTargetDelta && this.mixTargetDelta(1e3), this.currentAnimation.stop()), this.completeAnimation();
    }
    applyTransformsToTarget() {
      let t = this.getLead(),
        {
          targetWithTransforms: e,
          layout: i,
          latestValues: n
        } = t,
        {
          target: s
        } = t;
      if (e && s && i) {
        if (this !== t && this.layout && i && eH(this.options.animationType, this.layout.layoutBox, i.layoutBox)) {
          s = this.target || (0, r.ge)();
          let e = Y(this.layout.layoutBox.x);
          s.x.min = t.target.x.min, s.x.max = s.x.min + e;
          let i = Y(this.layout.layoutBox.y);
          s.y.min = t.target.y.min, s.y.max = s.y.min + i;
        }
        ee(e, s), (0, en.Ww)(e, n), Q(this.projectionDeltaWithTransform, this.layoutCorrected, e, n);
      }
    }
    registerSharedNode(t, e) {
      this.sharedNodes.has(t) || this.sharedNodes.set(t, new ey()), this.sharedNodes.get(t).add(e);
      let i = e.options.initialPromotionConfig;
      e.promote({
        transition: i ? i.transition : void 0,
        preserveFollowOpacity: i && i.shouldPreserveFollowOpacity ? i.shouldPreserveFollowOpacity(e) : void 0
      });
    }
    isLead() {
      let t = this.getStack();
      return !t || t.lead === this;
    }
    getLead() {
      let {
        layoutId: t
      } = this.options;
      return t && this.getStack()?.lead || this;
    }
    getPrevLead() {
      let {
        layoutId: t
      } = this.options;
      return t ? this.getStack()?.prevLead : void 0;
    }
    getStack() {
      let {
        layoutId: t
      } = this.options;
      if (t) return this.root.sharedNodes.get(t);
    }
    promote({
      needsReset: t,
      transition: e,
      preserveFollowOpacity: i
    } = {}) {
      let n = this.getStack();
      n && n.promote(this, i), t && (this.projectionDelta = void 0, this.needsReset = !0), e && this.setOptions({
        transition: e
      });
    }
    relegate() {
      let t = this.getStack();
      return !!t && t.relegate(this);
    }
    resetSkewAndRotation() {
      let {
        visualElement: t
      } = this.options;
      if (!t) return;
      let e = !1,
        {
          latestValues: i
        } = t;
      if ((i.z || i.rotate || i.rotateX || i.rotateY || i.rotateZ || i.skewX || i.skewY) && (e = !0), !e) return;
      let n = {};
      i.z && eT("z", t, n, this.animationValues);
      for (let e = 0; e < eS.length; e++) eT(`rotate${eS[e]}`, t, n, this.animationValues), eT(`skew${eS[e]}`, t, n, this.animationValues);
      for (let e in t.render(), n) t.setStaticValue(e, n[e]), this.animationValues && (this.animationValues[e] = n[e]);
      t.scheduleRender();
    }
    applyProjectionStyles(t, e) {
      if (!this.instance || this.isSVG) return;
      if (!this.isVisible) {
        t.visibility = "hidden";
        return;
      }
      let i = this.getTransformTemplate();
      if (this.needsReset) {
        this.needsReset = !1, t.visibility = "", t.opacity = "", t.pointerEvents = (0, t0.u)(e?.pointerEvents) || "", t.transform = i ? i(this.latestValues, "") : "none";
        return;
      }
      let n = this.getLead();
      if (!this.projectionDelta || !this.layout || !n.target) {
        this.options.layoutId && (t.opacity = void 0 !== this.latestValues.opacity ? this.latestValues.opacity : 1, t.pointerEvents = (0, t0.u)(e?.pointerEvents) || ""), this.hasProjected && !(0, ew.HD)(this.latestValues) && (t.transform = i ? i({}, "") : "none", this.hasProjected = !1);
        return;
      }
      t.visibility = "";
      let s = n.animationValues || n.latestValues;
      this.applyTransformsToTarget();
      let r = function (t, e, i) {
        let n = "",
          s = t.x.translate / e.x,
          r = t.y.translate / e.y,
          o = i?.z || 0;
        if ((s || r || o) && (n = `translate3d(${s}px, ${r}px, ${o}px) `), (1 !== e.x || 1 !== e.y) && (n += `scale(${1 / e.x}, ${1 / e.y}) `), i) {
          let {
            transformPerspective: t,
            rotate: e,
            pathRotation: s,
            rotateX: r,
            rotateY: o,
            skewX: a,
            skewY: l
          } = i;
          t && (n = `perspective(${t}px) ${n}`), e && (n += `rotate(${e}deg) `), s && (n += `rotate(${s}deg) `), r && (n += `rotateX(${r}deg) `), o && (n += `rotateY(${o}deg) `), a && (n += `skewX(${a}deg) `), l && (n += `skewY(${l}deg) `);
        }
        let a = t.x.scale * e.x,
          l = t.y.scale * e.y;
        return (1 !== a || 1 !== l) && (n += `scale(${a}, ${l})`), n || "none";
      }(this.projectionDeltaWithTransform, this.treeScale, s);
      i && (r = i(s, r)), t.transform = r;
      let {
        x: o,
        y: a
      } = this.projectionDelta;
      for (let e in t.transformOrigin = `${100 * o.origin}% ${100 * a.origin}% 0`, n.animationValues ? t.opacity = n === this ? s.opacity ?? this.latestValues.opacity ?? 1 : this.preserveOpacity ? this.latestValues.opacity : s.opacityExit : t.opacity = n === this ? void 0 !== s.opacity ? s.opacity : "" : void 0 !== s.opacityExit ? s.opacityExit : 0, tQ.H) {
        if (void 0 === s[e]) continue;
        let {
            correct: i,
            applyTo: o,
            isCSSVariable: a
          } = tQ.H[e],
          l = "none" === r ? s[e] : i(s[e], n);
        if (o) {
          let e = o.length;
          for (let i = 0; i < e; i++) t[o[i]] = l;
        } else a ? this.options.visualElement.renderState.vars[e] = l : t[e] = l;
      }
      this.options.layoutId && (t.pointerEvents = n === this ? (0, t0.u)(e?.pointerEvents) || "" : "none");
    }
    clearSnapshot() {
      this.resumeFrom = this.snapshot = void 0;
    }
    resetTree() {
      this.root.nodes.forEach(t => t.currentAnimation?.stop()), this.root.nodes.forEach(eM), this.root.sharedNodes.clear();
    }
  };
}
function eA(t) {
  t.updateLayout();
}
function ek(t) {
  let e = t.resumeFrom?.snapshot || t.snapshot;
  if (t.isLead() && t.layout && e && t.hasListeners("didUpdate")) {
    let {
        layoutBox: i,
        measuredBox: n
      } = t.layout,
      {
        animationType: s
      } = t.options,
      o = e.source !== t.layout.source;
    if ("size" === s) z(t => {
      let n = o ? e.measuredBox[t] : e.layoutBox[t],
        s = Y(n);
      n.min = i[t].min, n.max = n.min + s;
    });else if ("x" === s || "y" === s) {
      let t = "x" === s ? "y" : "x";
      et(o ? e.measuredBox[t] : e.layoutBox[t], i[t]);
    } else eH(s, e.layoutBox, i) && z(n => {
      let s = o ? e.measuredBox[n] : e.layoutBox[n],
        r = Y(i[n]);
      s.max = s.min + r, t.relativeTarget && !t.currentAnimation && (t.isProjectionDirty = !0, t.relativeTarget[n].max = t.relativeTarget[n].min + r);
    });
    let a = (0, r.xU)();
    Q(a, i, e.layoutBox);
    let l = (0, r.xU)();
    o ? Q(l, t.applyTransform(n, !0), e.measuredBox) : Q(l, i, e.layoutBox);
    let h = !eu(a),
      u = !1;
    if (!t.resumeFrom) {
      let n = t.getClosestProjectingParent();
      if (n && !n.resumeFrom) {
        let {
          snapshot: s,
          layout: o
        } = n;
        if (s && o) {
          let a = t.options.layoutAnchor || void 0,
            l = (0, r.ge)();
          tt(l, e.layoutBox, s.layoutBox, a);
          let h = (0, r.ge)();
          tt(h, i, o.layoutBox, a), ep(l, h) || (u = !0), n.options.layoutRoot && (t.relativeTarget = h, t.relativeTargetOrigin = l, t.relativeParent = n);
        }
      }
    }
    t.notifyListeners("didUpdate", {
      layout: i,
      snapshot: e,
      delta: l,
      layoutDelta: a,
      hasLayoutChanged: h,
      hasRelativeLayoutChanged: u
    });
  } else if (t.isLead()) {
    let {
      onExitComplete: e
    } = t.options;
    e && e();
  }
  t.options.transition = void 0;
}
function eE(t) {
  t.parent && (t.isProjecting() || (t.isProjectionDirty = t.parent.isProjectionDirty), t.isSharedProjectionDirty || (t.isSharedProjectionDirty = !!(t.isProjectionDirty || t.parent.isProjectionDirty || t.parent.isSharedProjectionDirty)), t.isTransformDirty || (t.isTransformDirty = t.parent.isTransformDirty));
}
function eV(t) {
  t.isProjectionDirty = t.isSharedProjectionDirty = t.isTransformDirty = !1;
}
function eC(t) {
  t.clearSnapshot();
}
function eM(t) {
  t.clearMeasurements();
}
function eD(t) {
  t.isLayoutDirty = !0, t.updateLayout();
}
function eR(t) {
  t.isLayoutDirty = !1;
}
function eL(t) {
  t.isAnimationBlocked && t.layout && !t.isLayoutDirty && (t.snapshot = t.layout, t.isLayoutDirty = !0);
}
function eB(t) {
  let {
    visualElement: e
  } = t.options;
  e && e.getProps().onBeforeLayoutMeasure && e.notify("BeforeLayoutMeasure"), t.resetTransform();
}
function ej(t) {
  t.finishAnimation(), t.targetDelta = t.relativeTarget = t.target = void 0, t.isProjectionDirty = !0;
}
function eF(t) {
  t.resolveTargetDelta();
}
function eO(t) {
  t.calcProjection();
}
function eI(t) {
  t.resetSkewAndRotation();
}
function eW(t) {
  t.removeLeadSnapshot();
}
function eU(t, e, i) {
  t.translate = (0, q.k)(e.translate, 0, i), t.scale = (0, q.k)(e.scale, 1, i), t.origin = e.origin, t.originPoint = e.originPoint;
}
function eN(t, e, i, n) {
  t.min = (0, q.k)(e.min, i.min, n), t.max = (0, q.k)(e.max, i.max, n);
}
function e$(t) {
  return t.animationValues && void 0 !== t.animationValues.opacityExit;
}
let eX = {
    duration: .45,
    ease: [.4, 0, .1, 1]
  },
  eG = t => "u" > typeof navigator && navigator.userAgent && navigator.userAgent.toLowerCase().includes(t),
  eK = eG("applewebkit/") && !eG("chrome/") ? Math.round : G.l;
function ez(t) {
  t.min = eK(t.min), t.max = eK(t.max);
}
function eH(t, e, i) {
  return "position" === t || "preserve-aspect" === t && !(.2 >= Math.abs(em(e) - em(i)));
}
function eq(t) {
  return t !== t.root && t.scroll?.wasRoot;
}
let eY = eP({
    attachResizeListener: (t, e) => ta(t, "resize", e),
    measureScroll: () => ({
      x: document.documentElement.scrollLeft || document.body?.scrollLeft || 0,
      y: document.documentElement.scrollTop || document.body?.scrollTop || 0
    }),
    checkIsScrollRoot: () => !0
  }),
  e_ = {
    current: void 0
  },
  eQ = eP({
    measureScroll: t => ({
      x: t.scrollLeft,
      y: t.scrollTop
    }),
    defaultParent: () => {
      if (!e_.current) {
        let t = new eY({});
        t.mount(window), t.setOptions({
          layoutScroll: !0
        }), e_.current = t;
      }
      return e_.current;
    },
    resetTransform: (t, e) => {
      t.style.transform = void 0 !== e ? e : "none";
    },
    checkIsScrollRoot: t => "fixed" === window.getComputedStyle(t).position
  });
var eZ = require("./58392.cjs");
function eJ(t, e) {
  let i = (0, eZ.K)(t),
    n = new AbortController();
  return [i, {
    passive: !0,
    ...e,
    signal: n.signal
  }, () => n.abort()];
}
function e0(t, e, i) {
  let {
    props: n
  } = t;
  t.animationState && n.whileHover && t.animationState.setActive("whileHover", "Start" === i);
  let s = n["onHover" + i];
  s && te.Gt.postRender(() => s(e, tu(e)));
}
class e1 extends E {
  mount() {
    let {
      current: t
    } = this.node;
    t && (this.unmount = function (t, e, i = {}) {
      let [n, s, r] = eJ(t, i);
      return n.forEach(t => {
        let i,
          n = !1,
          r = !1,
          o = e => {
            i && (i(e), i = void 0), t.removeEventListener("pointerleave", l);
          },
          a = t => {
            n = !1, window.removeEventListener("pointerup", a), window.removeEventListener("pointercancel", a), r && (r = !1, o(t));
          },
          l = t => {
            if ("touch" !== t.pointerType) {
              if (n) {
                r = !0;
                return;
              }
              o(t);
            }
          };
        t.addEventListener("pointerenter", n => {
          if ("touch" === n.pointerType || K.x || K.y) return;
          r = !1;
          let o = e(t, n);
          "function" == typeof o && (i = o, t.addEventListener("pointerleave", l, s));
        }, s), t.addEventListener("pointerdown", () => {
          n = !0, window.addEventListener("pointerup", a, s), window.addEventListener("pointercancel", a, s);
        }, s);
      }), r;
    }(t, (t, e) => (e0(this.node, e, "Start"), t => e0(this.node, t, "End"))));
  }
  unmount() {}
}
class e2 extends E {
  constructor() {
    super(...arguments), this.isActive = !1;
  }
  onFocus() {
    let t = !1;
    try {
      t = this.node.current.matches(":focus-visible");
    } catch (e) {
      t = !0;
    }
    t && this.node.animationState && (this.node.animationState.setActive("whileFocus", !0), this.isActive = !0);
  }
  onBlur() {
    this.isActive && this.node.animationState && (this.node.animationState.setActive("whileFocus", !1), this.isActive = !1);
  }
  mount() {
    this.unmount = (0, tm.F)(ta(this.node.current, "focus", () => this.onFocus()), ta(this.node.current, "blur", () => this.onBlur()));
  }
  unmount() {}
}
var e5 = require("./78757.cjs");
let e3 = (t, e) => !!e && (t === e || e3(t, e.parentElement)),
  e9 = new WeakSet();
function e4(t) {
  return e => {
    "Enter" === e.key && t(e);
  };
}
function e6(t, e) {
  t.dispatchEvent(new PointerEvent("pointer" + e, {
    isPrimary: !0,
    bubbles: !0
  }));
}
function e7(t) {
  return th(t) && !(K.x || K.y);
}
let e8 = new WeakSet();
function it(t, e, i) {
  let {
    props: n
  } = t;
  if (t.current instanceof HTMLButtonElement && t.current.disabled) return;
  t.animationState && n.whileTap && t.animationState.setActive("whileTap", "Start" === i);
  let s = n["onTap" + ("End" === i ? "" : i)];
  s && te.Gt.postRender(() => s(e, tu(e)));
}
class ie extends E {
  mount() {
    let {
      current: t
    } = this.node;
    if (!t) return;
    let {
      globalTapTarget: e,
      propagate: i
    } = this.node.props;
    this.unmount = function (t, e, i = {}) {
      let [n, s, r] = eJ(t, i),
        o = t => {
          let n = t.currentTarget;
          if (!e7(t) || e8.has(t)) return;
          e9.add(n), i.stopPropagation && e8.add(t);
          let r = e(n, t),
            o = {
              ...s,
              capture: !0
            },
            a = (t, e) => {
              window.removeEventListener("pointerup", l, o), window.removeEventListener("pointercancel", h, o), e9.has(n) && e9.delete(n), e7(t) && "function" == typeof r && r(t, {
                success: e
              });
            },
            l = t => {
              a(t, n === window || n === document || i.useGlobalTarget || e3(n, t.target));
            },
            h = t => {
              a(t, !1);
            };
          window.addEventListener("pointerup", l, o), window.addEventListener("pointercancel", h, o);
        };
      return n.forEach(t => {
        ((i.useGlobalTarget ? window : t).addEventListener("pointerdown", o, s), (0, e5.s)(t)) && (t.addEventListener("focus", t => ((t, e) => {
          let i = t.currentTarget;
          if (!i) return;
          let n = e4(() => {
            if (e9.has(i)) return;
            e6(i, "down");
            let t = e4(() => {
              e6(i, "up");
            });
            i.addEventListener("keyup", t, e), i.addEventListener("blur", () => e6(i, "cancel"), e);
          });
          i.addEventListener("keydown", n, e), i.addEventListener("blur", () => i.removeEventListener("keydown", n), e);
        })(t, s)), tr.has(t.tagName) || !0 === t.isContentEditable || t.hasAttribute("tabindex") || (t.tabIndex = 0));
      }), r;
    }(t, (t, e) => (it(this.node, e, "Start"), (t, {
      success: e
    }) => it(this.node, t, e ? "End" : "Cancel")), {
      useGlobalTarget: e,
      stopPropagation: i?.tap === !1
    });
  }
  unmount() {}
}
let ii = new WeakMap(),
  is = new WeakMap(),
  ir = t => {
    let e = ii.get(t.target);
    e && e(t);
  },
  io = t => {
    t.forEach(ir);
  },
  ia = {
    some: 0,
    all: 1
  };
class il extends E {
  constructor() {
    super(...arguments), this.hasEnteredView = !1, this.isInView = !1;
  }
  startObserver() {
    var t;
    let e;
    this.stopObserver?.();
    let {
        viewport: i = {}
      } = this.node.getProps(),
      {
        root: n,
        margin: s,
        amount: r = "some",
        once: o
      } = i,
      a = {
        root: n ? n.current : void 0,
        rootMargin: s,
        threshold: "number" == typeof r ? r : ia[r]
      },
      l = t => {
        let {
          isIntersecting: e
        } = t;
        if (this.isInView === e || (this.isInView = e, o && !e && this.hasEnteredView)) return;
        e && (this.hasEnteredView = !0), this.node.animationState && this.node.animationState.setActive("whileInView", e);
        let {
            onViewportEnter: i,
            onViewportLeave: n
          } = this.node.getProps(),
          s = e ? i : n;
        s && s(t);
      };
    this.stopObserver = (t = this.node.current, e = function ({
      root: t,
      ...e
    }) {
      let i = t || document;
      is.has(i) || is.set(i, {});
      let n = is.get(i),
        s = JSON.stringify(e);
      return n[s] || (n[s] = new IntersectionObserver(io, {
        root: t,
        ...e
      })), n[s];
    }(a), ii.set(t, l), e.observe(t), () => {
      ii.delete(t), e.unobserve(t);
    });
  }
  mount() {
    this.startObserver();
  }
  update() {
    if ("u" < typeof IntersectionObserver) return;
    let {
      props: t,
      prevProps: e
    } = this.node;
    ["amount", "margin", "root"].some(function ({
      viewport: t = {}
    }, {
      viewport: e = {}
    } = {}) {
      return i => t[i] !== e[i];
    }(t, e)) && this.startObserver();
  }
  unmount() {
    this.stopObserver?.(), this.hasEnteredView = !1, this.isInView = !1;
  }
}
let ih = (0, k.H)({
  animation: {
    Feature: N
  },
  exit: {
    Feature: X
  },
  inView: {
    Feature: il
  },
  tap: {
    Feature: ie
  },
  focus: {
    Feature: e2
  },
  hover: {
    Feature: e1
  },
  pan: {
    Feature: tj
  },
  drag: {
    Feature: tL,
    ProjectionNode: eQ,
    MeasureLayout: tG
  },
  layout: {
    ProjectionNode: eQ,
    MeasureLayout: tG
  }
}, (t, e) => e.isSVG ?? (0, A.Q)(t) ? new v(e) : new T(e, {
  allowProjection: t !== P.Fragment
}));
