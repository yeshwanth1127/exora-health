// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  BX: () => V,
  vK: () => E,
  lr: () => k
});
var n = require("./38621.cjs"),
  s = require("./74212.cjs"),
  r = require("./58974.cjs"),
  o = require("./73852.cjs"),
  a = require("./4132.cjs"),
  l = require("./3486.cjs"),
  h = require("./58584.cjs"),
  u = require("./38873.cjs"),
  d = require("./37035.cjs"),
  c = require("./4287.cjs"),
  p = require("./6900.cjs"),
  m = require("./83399.cjs"),
  f = require("./21023.cjs"),
  v = require("./51469.cjs"),
  y = require("./51654.cjs"),
  g = require("./44616.cjs"),
  x = require("./25952.cjs"),
  w = require("./10887.cjs"),
  S = require("./76792.cjs"),
  b = require("./25620.cjs"),
  T = require("./27933.cjs");
let P = ["AnimationStart", "AnimationComplete", "Update", "BeforeLayoutMeasure", "LayoutMeasure", "LayoutAnimationStart", "LayoutAnimationComplete"],
  A = {};
function k(t) {
  A = t;
}
function E() {
  return A;
}
class V {
  scrapeMotionValuesFromProps(t, e, i) {
    return {};
  }
  constructor({
    parent: t,
    props: e,
    presenceContext: i,
    reducedMotionConfig: n,
    skipAnimations: s,
    blockInitialAnimation: r,
    visualState: o
  }, l = {}) {
    this.current = null, this.children = new Set(), this.isVariantNode = !1, this.isControllingVariants = !1, this.shouldReduceMotion = null, this.shouldSkipAnimations = !1, this.values = new Map(), this.KeyframeResolver = a.h, this.features = {}, this.valueSubscriptions = new Map(), this.prevMotionValues = {}, this.hasBeenMounted = !1, this.events = {}, this.propEventSubscriptions = {}, this.notifyUpdate = () => this.notify("Update", this.latestValues), this.render = () => {
      this.current && (this.triggerBuild(), this.renderInstance(this.current, this.renderState, this.props.style, this.projection));
    }, this.renderScheduledAt = 0, this.scheduleRender = () => {
      let t = d.k.now();
      this.renderScheduledAt < t && (this.renderScheduledAt = t, T.Gt.render(this.render, !1, !0));
    };
    const {
      latestValues: h,
      renderState: u
    } = o;
    this.latestValues = h, this.baseTarget = {
      ...h
    }, this.initialValues = e.initial ? {
      ...h
    } : {}, this.renderState = u, this.parent = t, this.props = e, this.presenceContext = i, this.depth = t ? t.depth + 1 : 0, this.reducedMotionConfig = n, this.skipAnimationsConfig = s, this.options = l, this.blockInitialAnimation = !!r, this.isControllingVariants = (0, g.e)(e), this.isVariantNode = (0, g.O)(e), this.isVariantNode && (this.variantChildren = new Set()), this.manuallyAnimateOnMount = !!(t && t.current);
    const {
      willChange: c,
      ...p
    } = this.scrapeMotionValuesFromProps(e, {}, this);
    for (const t in p) {
      const e = p[t];
      void 0 !== h[t] && (0, v.S)(e) && e.set(h[t]);
    }
  }
  mount(t) {
    if (this.hasBeenMounted) for (let t in this.initialValues) this.values.get(t)?.jump(this.initialValues[t]), this.latestValues[t] = this.initialValues[t];
    this.current = t, y.C.set(t, this), this.projection && !this.projection.instance && this.projection.mount(t), this.parent && this.isVariantNode && !this.isControllingVariants && (this.removeFromVariantTree = this.parent.addVariantChild(this)), this.values.forEach((t, e) => this.bindToMotionValue(e, t)), "never" === this.reducedMotionConfig ? this.shouldReduceMotion = !1 : "always" === this.reducedMotionConfig ? this.shouldReduceMotion = !0 : (b.r.current || (0, w.Uu)(), this.shouldReduceMotion = b.O.current), this.shouldSkipAnimations = this.skipAnimationsConfig ?? !1, this.parent?.addChild(this), this.update(this.props, this.presenceContext), this.hasBeenMounted = !0;
  }
  unmount() {
    for (let t in this.projection && this.projection.unmount(), (0, T.WG)(this.notifyUpdate), (0, T.WG)(this.render), this.valueSubscriptions.forEach(t => t()), this.valueSubscriptions.clear(), this.removeFromVariantTree && this.removeFromVariantTree(), this.parent?.removeChild(this), this.events) this.events[t].clear();
    for (let t in this.features) {
      let e = this.features[t];
      e && (e.unmount(), e.isMounted = !1);
    }
    this.current = null;
  }
  addChild(t) {
    this.children.add(t), this.enteringChildren ?? (this.enteringChildren = new Set()), this.enteringChildren.add(t);
  }
  removeChild(t) {
    this.children.delete(t), this.enteringChildren && this.enteringChildren.delete(t);
  }
  bindToMotionValue(t, e) {
    let i;
    if (this.valueSubscriptions.has(t) && this.valueSubscriptions.get(t)(), e.accelerate && h.M.has(t) && this.current instanceof HTMLElement) {
      let {
          factory: i,
          keyframes: s,
          times: r,
          ease: o,
          duration: a
        } = e.accelerate,
        h = new l.m({
          element: this.current,
          name: t,
          keyframes: s,
          times: r,
          ease: o,
          duration: (0, n.f)(a)
        }),
        u = i(h);
      this.valueSubscriptions.set(t, () => {
        u(), h.cancel();
      });
      return;
    }
    let s = x.f.has(t);
    s && this.onBindTransform && this.onBindTransform();
    let r = e.on("change", e => {
      this.latestValues[t] = e, this.props.onUpdate && T.Gt.preRender(this.notifyUpdate), s && this.projection && (this.projection.isTransformDirty = !0), this.scheduleRender();
    });
    "u" > typeof window && window.MotionCheckAppearSync && (i = window.MotionCheckAppearSync(this, t, e)), this.valueSubscriptions.set(t, () => {
      r(), i && i();
    });
  }
  sortNodePosition(t) {
    return this.current && this.sortInstanceNodePosition && this.type === t.type ? this.sortInstanceNodePosition(this.current, t.current) : 0;
  }
  updateFeatures() {
    let t = "animation";
    for (t in A) {
      let e = A[t];
      if (!e) continue;
      let {
        isEnabled: i,
        Feature: n
      } = e;
      if (!this.features[t] && n && i(this.props) && (this.features[t] = new n(this)), this.features[t]) {
        let e = this.features[t];
        e.isMounted ? e.update() : (e.mount(), e.isMounted = !0);
      }
    }
  }
  triggerBuild() {
    this.build(this.renderState, this.latestValues, this.props);
  }
  measureViewportBox() {
    return this.current ? this.measureInstanceViewportBox(this.current, this.props) : (0, c.ge)();
  }
  getStaticValue(t) {
    return this.latestValues[t];
  }
  setStaticValue(t, e) {
    this.latestValues[t] = e;
  }
  update(t, e) {
    (t.transformTemplate || this.props.transformTemplate) && this.scheduleRender(), this.prevProps = this.props, this.props = t, this.prevPresenceContext = this.presenceContext, this.presenceContext = e;
    for (let e = 0; e < P.length; e++) {
      let i = P[e];
      this.propEventSubscriptions[i] && (this.propEventSubscriptions[i](), delete this.propEventSubscriptions[i]);
      let n = t["on" + i];
      n && (this.propEventSubscriptions[i] = this.on(i, n));
    }
    this.prevMotionValues = function (t, e, i) {
      for (let n in e) {
        let s = e[n],
          r = i[n];
        if ((0, v.S)(s)) t.addValue(n, s);else if ((0, v.S)(r)) t.addValue(n, (0, p.OQ)(s, {
          owner: t
        }));else if (r !== s) if (t.hasValue(n)) {
          let e = t.getValue(n);
          !0 === e.liveStyle ? e.jump(s) : e.hasAnimated || e.set(s);
        } else {
          let e = t.getStaticValue(n);
          t.addValue(n, (0, p.OQ)(void 0 !== e ? e : s, {
            owner: t
          }));
        }
      }
      for (let n in i) void 0 === e[n] && t.removeValue(n);
      return e;
    }(this, this.scrapeMotionValuesFromProps(t, this.prevProps || {}, this), this.prevMotionValues), this.handleChildMotionValue && this.handleChildMotionValue();
  }
  getProps() {
    return this.props;
  }
  getVariant(t) {
    return this.props.variants ? this.props.variants[t] : void 0;
  }
  getDefaultTransition() {
    return this.props.transition;
  }
  getTransformPagePoint() {
    return this.props.transformPagePoint;
  }
  getClosestVariantNode() {
    return this.isVariantNode ? this : this.parent ? this.parent.getClosestVariantNode() : void 0;
  }
  addVariantChild(t) {
    let e = this.getClosestVariantNode();
    if (e) return e.variantChildren && e.variantChildren.add(t), () => e.variantChildren.delete(t);
  }
  addValue(t, e) {
    let i = this.values.get(t);
    e !== i && (i && this.removeValue(t), this.bindToMotionValue(t, e), this.values.set(t, e), this.latestValues[t] = e.get());
  }
  removeValue(t) {
    this.values.delete(t);
    let e = this.valueSubscriptions.get(t);
    e && (e(), this.valueSubscriptions.delete(t)), delete this.latestValues[t], this.removeValueFromRenderState(t, this.renderState);
  }
  hasValue(t) {
    return this.values.has(t);
  }
  getValue(t, e) {
    if (this.props.values && this.props.values[t]) return this.props.values[t];
    let i = this.values.get(t);
    return void 0 === i && void 0 !== e && (i = (0, p.OQ)(null === e ? void 0 : e, {
      owner: this
    }), this.addValue(t, i)), i;
  }
  readValue(t, e) {
    let i = void 0 === this.latestValues[t] && this.current ? this.getBaseTargetFromProps(this.props, t) ?? this.readValueFromInstance(this.current, t, this.options) : this.latestValues[t];
    return null != i && ("string" == typeof i && ((0, s.i)(i) || (0, r.$)(i)) ? i = parseFloat(i) : "number" != typeof i && !m.f.test(i) && m.f.test(e) && (i = (0, f.J)(t, e)), this.setBaseTarget(t, (0, v.S)(i) ? i.get() : i)), (0, v.S)(i) ? i.get() : i;
  }
  setBaseTarget(t, e) {
    this.baseTarget[t] = e;
  }
  getBaseTarget(t) {
    let e,
      {
        initial: i
      } = this.props;
    if ("string" == typeof i || "object" == typeof i) {
      let n = (0, S.a)(this.props, i, this.presenceContext?.custom);
      n && (e = n[t]);
    }
    if (i && void 0 !== e) return e;
    let n = this.getBaseTargetFromProps(this.props, t);
    return void 0 === n || (0, v.S)(n) ? void 0 !== this.initialValues[t] && void 0 === e ? void 0 : this.baseTarget[t] : n;
  }
  on(t, e) {
    return this.events[t] || (this.events[t] = new o.v()), this.events[t].add(e);
  }
  notify(t, ...e) {
    this.events[t] && this.events[t].notify(...e);
  }
  scheduleRenderMicrotask() {
    u.k.render(this.render);
  }
}
