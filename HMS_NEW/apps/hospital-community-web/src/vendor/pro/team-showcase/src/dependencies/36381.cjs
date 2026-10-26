// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  f: () => z
});
var n = require("./38621.cjs"),
  s = require("./28153.cjs"),
  r = require("./37035.cjs"),
  o = require("./34017.cjs"),
  a = require("./94712.cjs"),
  l = require("./86075.cjs"),
  h = require("./27933.cjs");
let u = t => {
  let e = ({
    timestamp: e
  }) => t(e);
  return {
    start: (t = !0) => h.Gt.update(e, t),
    stop: () => (0, h.WG)(e),
    now: () => h.uv.isProcessing ? h.uv.timestamp : r.k.now()
  };
};
var d = require("./41720.cjs"),
  c = require("./16660.cjs"),
  p = require("./17964.cjs"),
  m = require("./45343.cjs"),
  f = require("./47736.cjs"),
  v = require("./20754.cjs"),
  y = require("./14432.cjs"),
  g = require("./40660.cjs");
let x = t => t / 100;
class w extends g.q {
  constructor(t) {
    super(), this.state = "idle", this.startTime = null, this.isStopped = !1, this.currentTime = 0, this.holdTime = null, this.playbackSpeed = 1, this.delayState = {
      done: !1,
      value: void 0
    }, this.stop = () => {
      let {
        motionValue: t
      } = this.options;
      t && t.updatedAt !== r.k.now() && this.tick(r.k.now()), this.isStopped = !0, "idle" !== this.state && (this.teardown(), this.options.onStop?.());
    }, this.options = t, this.initAnimation(), this.play(), !1 === t.autoplay && this.pause(), (0, y.U)(this, this.options);
  }
  initAnimation() {
    let {
      options: t
    } = this;
    (0, v.E)(t);
    let {
        type: e = c.i,
        repeat: i = 0,
        repeatDelay: n = 0,
        repeatType: s,
        velocity: r = 0
      } = t,
      {
        keyframes: a
      } = t,
      h = e || c.i;
    h !== c.i && "number" != typeof a[0] && (this.mixKeyframes = (0, o.F)(x, (0, l.j)(a[0], a[1])), a = [0, 100]);
    let u = h(a === t.keyframes ? t : {
      ...t,
      keyframes: a
    });
    "mirror" === s && (this.mirroredGenerator = h({
      ...t,
      keyframes: [...a].reverse(),
      velocity: -r
    })), null === u.calculatedDuration && (u.calculatedDuration = (0, p.t)(u));
    let {
      calculatedDuration: d
    } = u;
    this.calculatedDuration = d, this.resolvedDuration = d + n, this.totalDuration = this.resolvedDuration * (i + 1) - n, this.generator = u;
  }
  updateTime(t) {
    let e = Math.round(t - this.startTime) * this.playbackSpeed;
    null !== this.holdTime ? this.currentTime = this.holdTime : this.currentTime = e;
  }
  tick(t, e = !1) {
    let i,
      {
        generator: n,
        totalDuration: s,
        mixKeyframes: r,
        mirroredGenerator: o,
        resolvedDuration: l,
        calculatedDuration: h
      } = this;
    if (null === this.startTime) return n.next(0);
    let {
      delay: u = 0,
      keyframes: c,
      repeat: p,
      repeatType: m,
      repeatDelay: v,
      type: y,
      onUpdate: g,
      finalKeyframe: x
    } = this.options;
    this.speed > 0 ? this.startTime = Math.min(this.startTime, t) : this.speed < 0 && (this.startTime = Math.min(t - s / this.speed, this.startTime)), e ? this.currentTime = t : this.updateTime(t);
    let w = this.currentTime - u * (this.playbackSpeed >= 0 ? 1 : -1),
      S = this.playbackSpeed >= 0 ? w < 0 : w > s;
    this.currentTime = Math.max(w, 0), "finished" === this.state && null === this.holdTime && (this.currentTime = s);
    let b = this.currentTime,
      T = n;
    if (p) {
      let t = Math.min(this.currentTime, s) / l,
        e = Math.floor(t),
        i = t % 1;
      !i && t >= 1 && (i = 1), 1 === i && e--, (e = Math.min(e, p + 1)) % 2 && ("reverse" === m ? (i = 1 - i, v && (i -= v / l)) : "mirror" === m && (T = o)), b = (0, a.q)(0, 1, i) * l;
    }
    S ? (this.delayState.value = c[0], i = this.delayState) : i = T.next(b), r && !S && (i.value = r(i.value));
    let {
      done: P
    } = i;
    S || null === h || (P = this.playbackSpeed >= 0 ? this.currentTime >= s : this.currentTime <= 0);
    let A = null === this.holdTime && ("finished" === this.state || "running" === this.state && P);
    return A && y !== d.B && (i.value = (0, f.X)(c, this.options, x, this.speed)), g && g(i.value), A && this.finish(), i;
  }
  then(t, e) {
    return this.finished.then(t, e);
  }
  get duration() {
    return (0, n.X)(this.calculatedDuration);
  }
  get iterationDuration() {
    let {
      delay: t = 0
    } = this.options || {};
    return this.duration + (0, n.X)(t);
  }
  get time() {
    return (0, n.X)(this.currentTime);
  }
  set time(t) {
    t = (0, n.f)(t), this.currentTime = t, null === this.startTime || null !== this.holdTime || 0 === this.playbackSpeed ? this.holdTime = t : this.driver && (this.startTime = this.driver.now() - t / this.playbackSpeed), this.driver ? this.driver.start(!1) : (this.startTime = 0, this.state = "paused", this.holdTime = t, this.tick(t));
  }
  getGeneratorVelocity() {
    return (0, m.Y)(this.generator, this.currentTime, this.options.velocity);
  }
  get speed() {
    return this.playbackSpeed;
  }
  set speed(t) {
    let e = this.playbackSpeed !== t;
    e && this.driver && this.updateTime(r.k.now()), this.playbackSpeed = t, e && this.driver && (this.time = (0, n.X)(this.currentTime));
  }
  play() {
    if (this.isStopped) return;
    let {
      driver: t = u,
      startTime: e
    } = this.options;
    this.driver || (this.driver = t(t => this.tick(t))), this.options.onPlay?.();
    let i = this.driver.now();
    "finished" === this.state ? (this.updateFinished(), this.startTime = i) : null !== this.holdTime ? this.startTime = i - this.holdTime : this.startTime || (this.startTime = e ?? i), "finished" === this.state && this.speed < 0 && (this.startTime += this.calculatedDuration), this.holdTime = null, this.state = "running", this.driver.start();
  }
  pause() {
    this.state = "paused", this.updateTime(r.k.now()), this.holdTime = this.currentTime;
  }
  complete() {
    "running" !== this.state && this.play(), this.state = "finished", this.holdTime = null;
  }
  finish() {
    this.notifyFinished(), this.teardown(), this.state = "finished", this.options.onComplete?.();
  }
  cancel() {
    this.holdTime = null, this.startTime = 0, this.tick(0), this.teardown(), this.options.onCancel?.();
  }
  teardown() {
    this.state = "idle", this.stopDriver(), this.startTime = this.holdTime = null;
  }
  stopDriver() {
    this.driver && (this.driver.stop(), this.driver = void 0);
  }
  sample(t) {
    return this.startTime = 0, this.tick(t, !0);
  }
  attachTimeline(t) {
    return this.options.allowFlatten && (this.options.type = "keyframes", this.options.ease = "linear", this.initAnimation()), this.driver?.stop(), t.observe(this);
  }
}
var S = require("./4132.cjs"),
  b = require("./94980.cjs"),
  T = require("./3486.cjs"),
  P = require("./25903.cjs"),
  A = require("./1406.cjs"),
  k = require("./89722.cjs");
let E = {
  anticipate: P.b,
  backInOut: A.ZZ,
  circInOut: k.tn
};
class V extends T.m {
  constructor(t) {
    !function (t) {
      "string" == typeof t.ease && t.ease in E && (t.ease = E[t.ease]);
    }(t), (0, v.E)(t), super(t), void 0 !== t.startTime && !1 !== t.autoplay && (this.startTime = t.startTime), this.options = t;
  }
  updateMotionValue(t) {
    let {
      motionValue: e,
      onUpdate: i,
      onComplete: n,
      element: s,
      ...o
    } = this.options;
    if (!e) return;
    if (void 0 !== t) return void e.set(t);
    let l = new w({
        ...o,
        autoplay: !1
      }),
      h = Math.max(10, r.k.now() - this.startTime),
      u = (0, a.q)(0, 10, h - 10),
      d = l.sample(h).value,
      {
        name: c
      } = this.options;
    s && c && (0, b.e)(s, c, d), e.setWithVelocity(l.sample(Math.max(0, h - u)).value, d, u), l.stop();
  }
}
var C = require("./5556.cjs"),
  M = require("./70954.cjs"),
  D = require("./83399.cjs");
let R = (t, e) => "zIndex" !== e && !!("number" == typeof t || Array.isArray(t) || "string" == typeof t && (D.f.test(t) || "0" === t) && !t.startsWith("url("));
function L(t) {
  t.duration = 0, t.type = "keyframes";
}
var B = require("./96291.cjs"),
  j = require("./58584.cjs");
let F = /^(?:oklch|oklab|lab|lch|color|color-mix|light-dark)\(/,
  O = new Set(["color", "backgroundColor", "outlineColor", "fill", "stroke", "borderColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"]),
  I = (0, B.p)(() => Object.hasOwnProperty.call(Element.prototype, "animate"));
class W extends g.q {
  constructor(t) {
    super(), this.stop = () => {
      this._animation && (this._animation.stop(), this.stopTimeline?.()), this.keyframeResolver?.cancel();
    }, this.createdAt = r.k.now();
    const {
      keyframes: e,
      name: i,
      motionValue: n,
      element: s
    } = t;
    t.autoplay ?? (t.autoplay = !0), t.delay ?? (t.delay = 0), t.type ?? (t.type = "keyframes"), t.repeat ?? (t.repeat = 0), t.repeatDelay ?? (t.repeatDelay = 0), t.repeatType ?? (t.repeatType = "loop");
    const o = s?.KeyframeResolver || S.h;
    this.keyframeResolver = new o(e, (e, i, n) => this.onKeyframesResolved(e, i, t, !n), i, n, s), this.keyframeResolver?.scheduleResolve();
  }
  onKeyframesResolved(t, e, i, n) {
    let o;
    this.keyframeResolver = void 0;
    let {
      name: a,
      type: l,
      velocity: h,
      delay: u,
      isHandoff: d,
      onUpdate: c
    } = i;
    this.resolvedAt = r.k.now();
    let p = !0;
    !function (t, e, i, n) {
      let s = t[0];
      if (null === s) return !1;
      if ("display" === e || "visibility" === e) return !0;
      let r = t[t.length - 1],
        o = R(s, e),
        a = R(r, e);
      return o && a ? function (t) {
        let e = t[0];
        if (1 === t.length) return !0;
        for (let i = 0; i < t.length; i++) if (t[i] !== e) return !0;
      }(t) || ("spring" === i || (0, M.W)(i)) && n : (o !== a && (0, C.$)(!1, `You are trying to animate ${e} from "${s}" to "${r}". "${o ? r : s}" is not an animatable value.`, "value-not-animatable"), !1);
    }(t, a, l, h) && (p = !1, (s.W.instantAnimations || !u) && c?.((0, f.X)(t, i, e)), t[0] = t[t.length - 1], L(i), i.repeat = 0);
    let m = n ? this.resolvedAt && this.resolvedAt - this.createdAt > 40 ? this.resolvedAt : this.createdAt : void 0,
      {
        onComplete: v
      } = i;
    if (i.startTime ?? (i.startTime = m), i.finalKeyframe = e, i.keyframes = t, i.onComplete = () => {
      v?.(), this.notifyFinished();
    }, p && !d && function (t) {
      let {
        motionValue: e,
        name: i,
        repeatDelay: n,
        repeatType: s,
        damping: r,
        type: o,
        keyframes: a
      } = t;
      if (!i || !(j.M.has(i) || O.has(i))) return !1;
      let l = e?.owner?.current;
      if (!(l instanceof HTMLElement) && !(l instanceof SVGElement)) return !1;
      let {
        onUpdate: h,
        transformTemplate: u
      } = e.owner.getProps();
      return I() && (j.M.has(i) || O.has(i) && function (t) {
        for (let e = 0; e < t.length; e++) if ("string" == typeof t[e] && F.test(t[e])) return !0;
        return !1;
      }(a)) && ("transform" !== i || !u) && !h && !n && "mirror" !== s && 0 !== r && "inertia" !== o;
    }(i)) {
      i.element = i.motionValue?.owner?.current;
      try {
        o = new V(i);
      } catch {
        o = new w(i);
      }
    } else o = new w(i);
    this.pendingTimeline && (this.stopTimeline = o.attachTimeline(this.pendingTimeline), this.pendingTimeline = void 0), this._animation = o;
  }
  get finished() {
    return this._animation ? this._animation.finished : super.finished;
  }
  then(t, e) {
    return this.finished.finally(t).then(() => {});
  }
  get animation() {
    return this._animation || (this.keyframeResolver?.resume(), (0, S.q)()), this._animation;
  }
  get duration() {
    return this.animation.duration;
  }
  get iterationDuration() {
    return this.animation.iterationDuration;
  }
  get time() {
    return this.animation.time;
  }
  set time(t) {
    this.animation.time = t;
  }
  get speed() {
    return this.animation.speed;
  }
  get state() {
    return this.animation.state;
  }
  set speed(t) {
    this.animation.speed = t;
  }
  get startTime() {
    return this.animation.startTime;
  }
  attachTimeline(t) {
    return this._animation ? this.stopTimeline = this.animation.attachTimeline(t) : this.pendingTimeline = t, () => this.stop();
  }
  play() {
    this.animation.play();
  }
  pause() {
    this.animation.pause();
  }
  complete() {
    this.animation.complete();
  }
  cancel() {
    this._animation && this.animation.cancel(), this.keyframeResolver?.cancel();
  }
}
var U = require("./75319.cjs"),
  N = require("./25952.cjs");
let $ = {
    type: "spring",
    stiffness: 500,
    damping: 25,
    restSpeed: 10
  },
  X = {
    type: "keyframes",
    duration: .8
  },
  G = {
    type: "keyframes",
    ease: [.25, .1, .35, 1],
    duration: .3
  },
  K = new Set(["when", "delay", "delayChildren", "staggerChildren", "staggerDirection", "repeat", "repeatType", "repeatDelay", "from", "elapsed"]),
  z = (t, e, i, r = {}, o, a) => l => {
    let u = (0, U.r)(r, t) || {},
      d = u.delay || r.delay || 0,
      {
        elapsed: c = 0
      } = r;
    c -= (0, n.f)(d);
    let p = {
      keyframes: Array.isArray(i) ? i : [null, i],
      ease: "easeOut",
      velocity: e.getVelocity(),
      ...u,
      delay: -c,
      onUpdate: t => {
        e.set(t), u.onUpdate && u.onUpdate(t);
      },
      onComplete: () => {
        l(), u.onComplete && u.onComplete();
      },
      name: t,
      motionValue: e,
      element: a ? void 0 : o
    };
    !function (t) {
      for (let e in t) if (!K.has(e)) return !0;
      return !1;
    }(u) && Object.assign(p, ((t, {
      keyframes: e
    }) => e.length > 2 ? X : N.f.has(t) ? t.startsWith("scale") ? {
      type: "spring",
      stiffness: 550,
      damping: 0 === e[1] ? 2 * Math.sqrt(550) : 30,
      restSpeed: 10
    } : $ : G)(t, p)), p.duration && (p.duration = (0, n.f)(p.duration)), p.repeatDelay && (p.repeatDelay = (0, n.f)(p.repeatDelay)), void 0 !== p.from && (p.keyframes[0] = p.from);
    let m = !1;
    if (!1 !== p.type && (0 !== p.duration || p.repeatDelay) || (L(p), 0 === p.delay && (m = !0)), (s.W.instantAnimations || s.W.skipAnimations || o?.shouldSkipAnimations || u.skipAnimations) && (m = !0, L(p), p.delay = 0), p.allowFlatten = !u.type && !u.ease, m && !a && void 0 !== e.get()) {
      let t = (0, f.X)(p.keyframes, u);
      if (void 0 !== t) return void h.Gt.update(() => {
        p.onUpdate(t), p.onComplete();
      });
    }
    return u.isSync ? new w(p) : new W(p);
  };
