// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  m: () => y
});
var n = require("./5556.cjs"),
  s = require("./38621.cjs"),
  r = require("./72025.cjs"),
  o = require("./94980.cjs"),
  a = require("./69166.cjs"),
  l = require("./47736.cjs"),
  h = require("./40660.cjs"),
  u = require("./14432.cjs"),
  d = require("./9331.cjs");
let c = (0, require("./7145.cjs").J)(() => {
  try {
    document.createElement("div").animate({
      opacity: 0
    }, {
      easing: "linear(0, 1)"
    });
  } catch (t) {
    return !1;
  }
  return !0;
}, "linearEasing");
var p = require("./78987.cjs");
let m = ([t, e, i, n]) => `cubic-bezier(${t}, ${e}, ${i}, ${n})`,
  f = {
    linear: "linear",
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    circIn: m([0, .65, .55, 1]),
    circOut: m([.55, 0, 1, .45]),
    backIn: m([.31, .01, .66, -.59]),
    backOut: m([.33, 1.53, .69, .99])
  };
var v = require("./70954.cjs");
class y extends h.q {
  constructor(t) {
    if (super(), this.finishedTime = null, this.isStopped = !1, this.manualStartTime = null, !t) return;
    const {
      element: e,
      name: i,
      keyframes: s,
      pseudoElement: r,
      allowFlatten: a = !1,
      finalKeyframe: h,
      onComplete: y
    } = t;
    this.isPseudoElement = !!r, this.allowFlatten = a, this.options = t, (0, n.V)("string" != typeof t.type, 'Mini animate() doesn\'t support "type" as a string.', "mini-spring");
    const g = function ({
      type: t,
      ...e
    }) {
      return (0, v.W)(t) && c() ? t.applyToOptions(e) : (e.duration ?? (e.duration = 300), e.ease ?? (e.ease = "easeOut"), e);
    }(t);
    this.animation = function (t, e, i, {
      delay: n = 0,
      duration: s = 300,
      repeat: r = 0,
      repeatType: o = "loop",
      ease: a = "easeOut",
      times: l
    } = {}, h) {
      let u = {
        [e]: i
      };
      l && (u.offset = l);
      let v = function t(e, i) {
        if (e) return "function" == typeof e ? c() ? (0, p.K)(e, i) : "ease-out" : (0, d.D)(e) ? m(e) : Array.isArray(e) ? e.map(e => t(e, i) || f.easeOut) : f[e];
      }(a, s);
      Array.isArray(v) && (u.easing = v);
      let y = {
        delay: n,
        duration: s,
        easing: Array.isArray(v) ? "linear" : v,
        fill: "both",
        iterations: r + 1,
        direction: "reverse" === o ? "alternate" : "normal"
      };
      return h && (y.pseudoElement = h), t.animate(u, y);
    }(e, i, s, g, r), !1 === g.autoplay && this.animation.pause(), this.animation.onfinish = () => {
      if (this.finishedTime = this.time, !r) {
        let t = (0, l.X)(s, this.options, h, this.speed);
        this.updateMotionValue && this.updateMotionValue(t), (0, o.e)(e, i, t), this.animation.cancel();
      }
      y?.(), this.notifyFinished();
    }, (0, u.U)(this, t, g);
  }
  play() {
    this.isStopped || (this.manualStartTime = null, this.animation.play(), "finished" === this.state && this.updateFinished());
  }
  pause() {
    this.animation.pause();
  }
  complete() {
    this.animation.finish?.();
  }
  cancel() {
    try {
      this.animation.cancel();
    } catch (t) {}
  }
  stop() {
    if (this.isStopped) return;
    this.isStopped = !0;
    let {
      state: t
    } = this;
    "idle" !== t && "finished" !== t && (this.updateMotionValue ? this.updateMotionValue() : this.commitStyles(), this.isPseudoElement || this.cancel());
  }
  commitStyles() {
    let t = this.options?.element;
    !this.isPseudoElement && t?.isConnected && this.animation.commitStyles?.();
  }
  get duration() {
    let t = this.animation.effect?.getComputedTiming?.().duration || 0;
    return (0, s.X)(Number(t));
  }
  get iterationDuration() {
    let {
      delay: t = 0
    } = this.options || {};
    return this.duration + (0, s.X)(t);
  }
  get time() {
    return (0, s.X)(Number(this.animation.currentTime) || 0);
  }
  set time(t) {
    let e = null !== this.finishedTime;
    this.manualStartTime = null, this.finishedTime = null, this.animation.currentTime = (0, s.f)(t), e && this.animation.pause();
  }
  get speed() {
    return this.animation.playbackRate;
  }
  set speed(t) {
    t < 0 && (this.finishedTime = null), this.animation.playbackRate = t;
  }
  get state() {
    return null !== this.finishedTime ? "finished" : this.animation.playState;
  }
  get startTime() {
    return this.manualStartTime ?? Number(this.animation.startTime);
  }
  set startTime(t) {
    this.manualStartTime = this.animation.startTime = t;
  }
  attachTimeline({
    timeline: t,
    rangeStart: e,
    rangeEnd: i,
    observe: n
  }) {
    return (this.allowFlatten && this.animation.effect?.updateTiming({
      easing: "linear"
    }), this.animation.onfinish = null, t && (0, a.J)()) ? (this.animation.timeline = t, e && (this.animation.rangeStart = e), i && (this.animation.rangeEnd = i), r.l) : n(this);
  }
}
