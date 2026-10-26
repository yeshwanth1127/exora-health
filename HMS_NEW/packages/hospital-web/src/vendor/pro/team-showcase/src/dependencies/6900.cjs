// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  KG: () => l,
  OQ: () => h,
  bt: () => a
});
var n = require("./73852.cjs"),
  s = require("./79537.cjs"),
  r = require("./37035.cjs"),
  o = require("./27933.cjs");
let a = {
  current: void 0
};
class l {
  constructor(t, e = {}) {
    this.canTrackVelocity = null, this.events = {}, this.updateAndNotify = t => {
      let e = r.k.now();
      if (this.updatedAt !== e && this.setPrevFrameValue(), this.prev = this.current, this.setCurrent(t), this.current !== this.prev && (this.notifyChange(), this.dependents)) for (let t of this.dependents) t.dirty();
    }, this.hasAnimated = !1, this.setCurrent(t), this.owner = e.owner;
  }
  setCurrent(t) {
    this.current = t, this.updatedAt = r.k.now(), null === this.canTrackVelocity && void 0 !== t && (this.canTrackVelocity = !isNaN(parseFloat(this.current)));
  }
  setPrevFrameValue(t = this.current) {
    this.prevFrameValue = t, this.prevUpdatedAt = this.updatedAt;
  }
  onChange(t) {
    return this.on("change", t);
  }
  on(t, e) {
    var i;
    return "change" === t ? this.onChangeSubscribe(e) : ((i = this.events)[t] || (i[t] = new n.v())).add(e);
  }
  onChangeSubscribe(t) {
    let {
      events: e
    } = this;
    return e.change || this.changeSubscriber ? (e.change || (e.change = new n.v(), e.change.add(this.changeSubscriber), this.changeSubscriber = void 0), e.change.add(t)) : this.changeSubscriber = t, () => {
      this.changeSubscriber === t ? this.changeSubscriber = void 0 : e.change?.remove(t), this.stopIfUnobserved();
    };
  }
  stopIfUnobserved() {
    o.Gt.read(() => {
      this.changeSubscriber || this.events.change?.getSize() || this.stop();
    });
  }
  clearListeners() {
    for (let t in this.changeSubscriber = void 0, this.events) this.events[t].clear();
  }
  attach(t, e) {
    this.passiveEffect = t, this.stopPassiveEffect = e;
  }
  set(t) {
    this.passiveEffect ? this.passiveEffect(t, this.updateAndNotify) : this.updateAndNotify(t);
  }
  setWithVelocity(t, e, i) {
    this.set(e), this.prev = void 0, this.prevFrameValue = t, this.prevUpdatedAt = this.updatedAt - i;
  }
  jump(t, e = !0) {
    this.updateAndNotify(t), this.prev = t, this.prevUpdatedAt = this.prevFrameValue = void 0, e && this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
  }
  dirty() {
    this.notifyChange();
  }
  notifyChange() {
    let {
      current: t,
      changeSubscriber: e
    } = this;
    e ? e(t) : this.events.change?.notify(t);
  }
  addDependent(t) {
    this.dependents || (this.dependents = new Set()), this.dependents.add(t);
  }
  removeDependent(t) {
    this.dependents && this.dependents.delete(t);
  }
  get() {
    return a.current && a.current.push(this), this.current;
  }
  getPrevious() {
    return this.prev;
  }
  getVelocity() {
    let t = r.k.now();
    if (!this.canTrackVelocity || void 0 === this.prevFrameValue || t - this.updatedAt > 30) return 0;
    let e = Math.min(this.updatedAt - this.prevUpdatedAt, 30);
    return (0, s.f)(parseFloat(this.current) - parseFloat(this.prevFrameValue), e);
  }
  start(t) {
    return this.stop(), new Promise(e => {
      let i;
      this.hasAnimated = !0;
      let n = !1;
      i = t(() => {
        n = !0, this.events.animationComplete?.notify(), this.animation === i && this.clearAnimation(), e();
      }), n || (this.animation = i), this.events.animationStart?.notify();
    });
  }
  stop() {
    this.animation && (this.animation.stop(), this.events.animationCancel && this.events.animationCancel.notify()), this.clearAnimation();
  }
  isAnimating() {
    return !!this.animation;
  }
  clearAnimation() {
    this.animation = void 0;
  }
  destroy() {
    this.dependents?.clear(), this.events.destroy?.notify(), this.clearListeners(), this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
  }
}
function h(t, e) {
  return new l(t, e);
}
