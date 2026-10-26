// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  o: () => y
});
var n = require("./5556.cjs"),
  s = require("./38621.cjs"),
  r = require("./94712.cjs"),
  o = require("./78987.cjs"),
  a = require("./17964.cjs"),
  l = require("./26262.cjs");
let h = .01,
  u = 2,
  d = .005,
  c = .5;
function p(t, e) {
  return t * Math.sqrt(1 - e * e);
}
let m = ["duration", "bounce"],
  f = ["stiffness", "damping", "mass"];
function v(t, e) {
  return e.some(e => void 0 !== t[e]);
}
function y(t = .3, e = .3) {
  let i,
    l,
    g,
    x = "object" != typeof t ? {
      visualDuration: t,
      keyframes: [0, 1],
      bounce: e
    } : t,
    w = x.keyframes[0],
    S = x.keyframes[x.keyframes.length - 1],
    b = {
      done: !1,
      value: w
    },
    {
      stiffness: T,
      damping: P,
      mass: A,
      duration: k,
      velocity: E,
      isResolvedFromDuration: V
    } = function (t) {
      let e = {
        velocity: 0,
        stiffness: 100,
        damping: 10,
        mass: 1,
        isResolvedFromDuration: !1,
        ...t
      };
      if (!v(t, f) && v(t, m)) if (e.velocity = 0, t.visualDuration) {
        let i = 2 * Math.PI / (1.2 * t.visualDuration),
          n = i * i,
          s = 2 * (0, r.q)(.05, 1, 1 - (t.bounce || 0)) * Math.sqrt(n);
        e = {
          ...e,
          mass: 1,
          stiffness: n,
          damping: s
        };
      } else {
        let i = function ({
          duration: t = 800,
          bounce: e = .3,
          velocity: i = 0,
          mass: o = 1
        }) {
          let a, l;
          (0, n.$)(t <= (0, s.f)(10), "Spring duration must be 10 seconds or less", "spring-duration-limit");
          let h = 1 - e;
          h = (0, r.q)(.05, 1, h), t = (0, r.q)(.01, 10, (0, s.X)(t)), h < 1 ? (a = e => {
            let n = e * h,
              s = n * t;
            return .001 - (n - i) / p(e, h) * Math.exp(-s);
          }, l = e => {
            let n = e * h * t,
              s = h * h * e * e * t,
              r = Math.exp(-n),
              o = p(e * e, h);
            return (n * i + i - s) * r * (-a(e) + .001 > 0 ? -1 : 1) / o;
          }) : (a = e => -.001 + Math.exp(-e * t) * ((e - i) * t + 1), l = e => t * t * (i - e) * Math.exp(-e * t));
          let u = function (t, e, i) {
            let n = i;
            for (let i = 1; i < 12; i++) n -= t(n) / e(n);
            return n;
          }(a, l, 5 / t);
          if (t = (0, s.f)(t), isNaN(u)) return {
            stiffness: 100,
            damping: 10,
            duration: t
          };
          {
            let e = u * u * o;
            return {
              stiffness: e,
              damping: 2 * h * Math.sqrt(o * e),
              duration: t
            };
          }
        }({
          ...t,
          velocity: 0
        });
        (e = {
          ...e,
          ...i,
          mass: 1
        }).isResolvedFromDuration = !0;
      }
      return e;
    }({
      ...x,
      velocity: -(0, s.X)(x.velocity || 0)
    }),
    C = P / (2 * Math.sqrt(T * A)),
    M = (0, s.X)(Math.sqrt(T / A)),
    D = C * M,
    R = {
      target: S,
      delta: S - w,
      velocity: E || 0,
      restSpeed: 0,
      restDelta: 0
    },
    L = () => {
      let t = 5 > Math.abs(R.delta);
      R.restSpeed = x.restSpeed || (t ? h : u), R.restDelta = x.restDelta || (t ? d : c);
    };
  if (L(), C < 1) {
    let t = p(M, C),
      e = {
        A: 0,
        sinC: 0,
        cosC: 0,
        t: -1,
        env: 0,
        sin: 0,
        cos: 0
      };
    g = () => {
      e.A = (R.velocity + D * R.delta) / t, e.sinC = D * e.A + R.delta * t, e.cosC = D * R.delta - e.A * t;
    };
    let n = i => {
      i !== e.t && (e.t = i, e.env = Math.exp(-D * i), e.sin = Math.sin(t * i), e.cos = Math.cos(t * i));
    };
    i = t => (n(t), R.target - e.env * (e.A * e.sin + R.delta * e.cos)), l = t => (n(t), e.env * (e.sinC * e.sin + e.cosC * e.cos));
  } else if (1 === C) {
    i = t => R.target - Math.exp(-M * t) * (R.delta + (R.velocity + M * R.delta) * t);
    let t = {
      C: 0
    };
    g = () => {
      t.C = R.velocity + M * R.delta;
    }, l = e => Math.exp(-M * e) * (M * t.C * e - R.velocity);
  } else {
    let t = M * Math.sqrt(C * C - 1);
    i = e => {
      let i = Math.exp(-D * e),
        n = Math.min(t * e, 300);
      return R.target - i * ((R.velocity + D * R.delta) * Math.sinh(n) + t * R.delta * Math.cosh(n)) / t;
    };
    let e = {
      P: 0,
      sinh: 0,
      cosh: 0
    };
    g = () => {
      e.P = (R.velocity + D * R.delta) / t, e.sinh = D * e.P - R.delta * t, e.cosh = D * R.delta - e.P * t;
    }, l = i => {
      let n = Math.exp(-D * i),
        s = Math.min(t * i, 300);
      return n * (e.sinh * Math.sinh(s) + e.cosh * Math.cosh(s));
    };
  }
  g();
  let B = !v(x, f) && v(x, m),
    j = V && k || null,
    F = {
      calculatedDuration: j,
      retarget: (t, e) => {
        R.target = t[t.length - 1], R.delta = R.target - t[0], R.velocity = B ? 0 : -(0, s.X)(e), x.restSpeed && x.restDelta || L(), F.calculatedDuration = j, b.done = !1, g();
      },
      velocity: t => (0, s.f)(l(t)),
      next: t => {
        let e = i(t);
        return V ? b.done = t >= k : b.done = Math.abs((0, s.f)(l(t))) <= R.restSpeed && Math.abs(R.target - e) <= R.restDelta, b.value = b.done ? R.target : e, b;
      },
      toString: () => {
        let t = Math.min((0, a.t)(F), a.Y),
          e = (0, o.K)(e => F.next(t * e).value, t, 30);
        return t + "ms " + e;
      },
      toTransition: () => {}
    };
  return F;
}
y.applyToOptions = t => {
  let e = (0, l.X)(t, 100, y);
  return t.ease = e.ease, t.duration = (0, s.f)(e.duration), t.type = "keyframes", t;
};
