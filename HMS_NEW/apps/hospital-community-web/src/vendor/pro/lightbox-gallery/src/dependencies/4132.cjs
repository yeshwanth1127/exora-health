// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  h: () => v,
  q: () => f
});
var n = require("./74212.cjs"),
  s = require("./58974.cjs"),
  r = require("./83399.cjs"),
  o = require("./21023.cjs"),
  a = require("./32766.cjs"),
  l = require("./27933.cjs");
let h = new Set(),
  u = !1,
  d = !1,
  c = !1;
function p() {
  if (d) {
    let t = [],
      e = new Set(),
      i = new Set();
    h.forEach(n => {
      n.needsMeasurement && (t.push(n), e.add(n.element), a.dB.has(n.name) && i.add(n.element));
    });
    let n = new Map();
    i.forEach(t => {
      let e = (0, a.W9)(t);
      e.length && (n.set(t, e), t.render());
    }), t.forEach(t => t.measureInitialState()), e.forEach(t => {
      t.render();
      let e = n.get(t);
      e && e.forEach(([e, i]) => {
        t.getValue(e)?.set(i);
      });
    }), t.forEach(t => t.measureEndState()), t.forEach(t => {
      void 0 !== t.suspendedScrollY && window.scrollTo(0, t.suspendedScrollY);
    });
  }
  d = !1, u = !1, h.forEach(t => t.complete(c)), h.clear();
}
function m() {
  h.forEach(t => {
    t.readKeyframes(), t.needsMeasurement && (d = !0);
  });
}
function f() {
  c = !0, m(), p(), c = !1;
}
class v {
  constructor(t, e, i, n, s, r = !1) {
    this.state = "pending", this.isAsync = !1, this.needsMeasurement = !1, this.unresolvedKeyframes = [...t], this.onComplete = e, this.name = i, this.motionValue = n, this.element = s, this.isAsync = r;
  }
  scheduleResolve() {
    this.state = "scheduled", this.isAsync ? (h.add(this), u || (u = !0, l.Gt.read(m), l.Gt.resolveKeyframes(p))) : (this.readKeyframes(), this.complete());
  }
  readKeyframes() {
    let {
      unresolvedKeyframes: t,
      name: e,
      element: i,
      motionValue: a
    } = this;
    if (null === t[0]) {
      let l = a?.get(),
        h = t[t.length - 1];
      if (void 0 !== l) t[0] = l;else if (i && e) {
        let a = function (t, e, i) {
          if ("string" == typeof t) {
            if ((0, n.i)(t) || (0, s.$)(t)) return parseFloat(t);else if (!r.f.test(t) && r.f.test(i)) return (0, o.J)(e, i);
          }
          return t ?? void 0;
        }(i.readValue(e, h), e, h);
        void 0 !== a && (t[0] = a);
      }
      void 0 === t[0] && (t[0] = h), a && void 0 === l && a.set(t[0]);
    }
    for (let e = 1; e < t.length; e++) t[e] ?? (t[e] = t[e - 1]);
  }
  setFinalKeyframe() {}
  measureInitialState() {}
  renderEndStyles() {}
  measureEndState() {}
  complete(t = !1) {
    this.state = "complete", this.onComplete(this.unresolvedKeyframes, this.finalKeyframe, t), h.delete(this);
  }
  cancel() {
    "scheduled" === this.state && (h.delete(this), this.state = "pending");
  }
  resume() {
    "pending" === this.state && this.scheduleResolve();
  }
}
