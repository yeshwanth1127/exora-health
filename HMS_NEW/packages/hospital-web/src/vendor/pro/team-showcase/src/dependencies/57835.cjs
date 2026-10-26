// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  I: () => r
});
var n = require("./28153.cjs");
let s = ["setup", "read", "resolveKeyframes", "preUpdate", "update", "preRender", "render", "postRender"];
function r(t, e) {
  let i = !1,
    r = !0,
    o = {
      delta: 0,
      timestamp: 0,
      isProcessing: !1
    },
    a = () => i = !0,
    l = s.reduce((t, e) => (t[e] = function (t) {
      let e = new Set(),
        i = new Set(),
        n = !1,
        s = !1,
        r = new Set(),
        o = {
          delta: 0,
          timestamp: 0,
          isProcessing: !1
        };
      function a(e) {
        r.has(e) && (i.add(e), t()), e(o);
      }
      let l = {
        schedule: (t, s = !1, o = !1) => {
          let a = o && n ? e : i;
          return s && r.add(t), a.add(t), t;
        },
        cancel: t => {
          i.delete(t), r.delete(t);
        },
        process: t => {
          if (o = t, n) {
            s = !0;
            return;
          }
          n = !0;
          let r = e;
          e = i, i = r, e.forEach(a), e.clear(), n = !1, s && (s = !1, l.process(t));
        }
      };
      return l;
    }(a), t), {}),
    {
      setup: h,
      read: u,
      resolveKeyframes: d,
      preUpdate: c,
      update: p,
      preRender: m,
      render: f,
      postRender: v
    } = l,
    y = () => {
      let s = n.W.useManualTiming,
        a = s ? o.timestamp : performance.now();
      i = !1, s || (o.delta = r ? 1e3 / 60 : Math.max(Math.min(a - o.timestamp, 40), 1)), o.timestamp = a, o.isProcessing = !0, h.process(o), u.process(o), d.process(o), c.process(o), p.process(o), m.process(o), f.process(o), v.process(o), o.isProcessing = !1, i && e && (r = !1, t(y));
    };
  return {
    schedule: s.reduce((e, n) => {
      let s = l[n];
      return e[n] = (e, n = !1, a = !1) => (!i && (i = !0, r = !0, o.isProcessing || t(y)), s.schedule(e, n, a)), e;
    }, {}),
    cancel: t => {
      for (let e = 0; e < s.length; e++) l[s[e]].cancel(t);
    },
    state: o,
    steps: l
  };
}
