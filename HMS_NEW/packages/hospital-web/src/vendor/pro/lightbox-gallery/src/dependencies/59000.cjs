// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  I: () => L,
  HospitalLightboxViewer: () => A
});
var r = require("react/jsx-runtime"),
  n = require("react"),
  a = require("./47650.cjs"),
  l = require("./18310.cjs"),
  s = require("./28245.cjs"),
  o = require("./55809.cjs"),
  u = require("./7890.cjs"),
  c = require("./92171.cjs"),
  d = require("./25354.cjs"),
  h = require("./80642.cjs"),
  g = require("./89959.cjs"),
  m = require("./55766.cjs"),
  p = require("./9005.cjs"),
  f = require("./78780.cjs"),
  y = require("./76721.cjs"),
  x = require("./2520.cjs"),
  b = require("./7770.cjs"),
  v = require("./85860.cjs"),
  w = interop.n(v);
let {
    spring: _,
    duration: j,
    ease: Y
  } = b.T,
  X = [...Y.enter],
  k = [...Y.standard],
  N = ({
    visualDuration: e,
    bounce: t
  }) => {
    let i = 2 * Math.PI / (1.2 * e);
    return {
      type: "spring",
      stiffness: i * i,
      damping: 2 * (1 - t) * i,
      mass: 1
    };
  },
  M = N({
    visualDuration: .44,
    bounce: .12
  }),
  C = N({
    visualDuration: .4,
    bounce: .06
  }),
  z = N(_.smooth),
  R = N(_.snappy),
  P = "(min-width: 900px) 260px, (min-width: 600px) 34vw, 50vw",
  E = (e, t, i) => Math.min(i, Math.max(t, e)),
  I = (e, t, i = .55) => e * t * i / (t + i * Math.abs(e)),
  S = (e, t, i) => 1 === t ? 16 * e : 2 === t ? e * i : e;
function T(e) {
  let t = e.w < 640,
    i = t ? 56 : 64,
    r = t ? 128 : 140;
  return {
    top: i,
    bottom: r,
    pad: t ? 12 : 72,
    stage: Math.max(120, e.h - i - r)
  };
}
function D(e, t) {
  let i = T(t),
    r = Math.min((t.w - 2 * i.pad) / e.width, (i.stage - 16) / e.height),
    n = e.width * r,
    a = e.height * r;
  return {
    width: n,
    height: a,
    left: (t.w - n) / 2,
    top: i.top + (i.stage - a) / 2
  };
}
function B(e, t, i) {
  let r = e.width * t / 2,
    n = e.height * t / 2,
    a = e.left + e.width / 2,
    l = e.top + e.height / 2,
    s = [i.w - a - r, r - a],
    o = [i.h - l - n, n - l];
  return {
    minX: s[0] > s[1] ? 0 : s[0],
    maxX: s[0] > s[1] ? 0 : s[1],
    minY: o[0] > o[1] ? 0 : o[0],
    maxY: o[0] > o[1] ? 0 : o[1]
  };
}
function L({
  images: e,
  minColumnWidth: t = 150,
  gap: i = 8,
  label: a = "Photo gallery",
  className: l
}) {
  let s = (0, n.useRef)(null),
    o = (0, n.useRef)([]),
    [u, c] = (0, n.useState)(3),
    [d, h] = (0, n.useState)(null),
    [g, m] = (0, n.useState)(0);
  (0, n.useLayoutEffect)(() => {
    let e = s.current;
    if (!e || "u" < typeof ResizeObserver) return;
    let r = new ResizeObserver(([e]) => {
      c(Math.max(2, Math.floor((e.contentRect.width + i) / (t + i))));
    });
    return r.observe(e), () => r.disconnect();
  }, [i, t]);
  let p = (0, n.useMemo)(() => {
      let t;
      return t = Array.from({
        length: u
      }, () => ({
        height: 0,
        items: []
      })), e.forEach((e, i) => {
        let r = t.reduce((e, t) => t.height < e.height - .01 ? t : e, t[0]);
        r.items.push(i), r.height += e.height / e.width;
      }), t.map(e => e.items);
    }, [e, u]),
    f = (0, n.useCallback)(e => o.current[e] ?? null, []),
    y = (0, n.useCallback)(e => {
      h(null), requestAnimationFrame(() => o.current[e]?.focus({ preventScroll: !0 }));
    }, []);
  return (0, r.jsxs)("div", {
    ref: s,
    className: l ? `${w().root} ${l}` : w().root,
    role: "region",
    "aria-label": a,
    children: [(0, r.jsx)("div", {
      className: w().grid,
      style: {
        gap: i
      },
      children: p.map((t, n) => (0, r.jsx)("div", {
        className: w().column,
        style: {
          gap: i
        },
        children: t.map(t => {
          let i = e[t];
          return (0, r.jsx)("button", {
            ref: e => {
              o.current[t] = e;
            },
            type: "button",
            className: w().thumb,
            "data-hidden": d && g === t ? "" : void 0,
            style: {
              aspectRatio: `${i.width} / ${i.height}`
            },
            "aria-label": `Open ${i.title ?? i.alt}, photo ${t + 1} of ${e.length}`,
            onClick: () => {
              let e;
              return e = o.current[t]?.getBoundingClientRect(), void (m(t), h({
                start: t,
                from: e ? {
                  left: e.left,
                  top: e.top,
                  width: e.width,
                  height: e.height
                } : null
              }));
            },
            children: (0, r.jsx)(x.W, {
              src: i.src,
              alt: "",
              width: i.width,
              height: i.height,
              sizes: P,
              draggable: !1,
              className: w().thumbImage
            })
          }, i.src);
        })
      }, n))
    }), d && (0, r.jsx)(A, {
      images: e,
      start: d.start,
      from: d.from,
      label: a,
      getThumb: f,
      onIndexChange: m,
      onClosed: y
    })]
  });
}
function A({
  images: e,
  start: t,
  from: i,
  label: b,
  getThumb: v,
  onIndexChange: _,
  onClosed: Y
}) {
  let N = !!(0, l.I)(),
    P = (0, n.useId)(),
    [L, $] = (0, n.useState)(() => ({
      w: window.innerWidth,
      h: window.innerHeight
    })),
    [H, O] = (0, n.useState)(t),
    [G, K] = (0, n.useState)(!1),
    [V, q] = (0, n.useState)(!1),
    J = (0, n.useRef)(t),
    Z = (0, n.useRef)(L),
    U = (0, n.useRef)(!1),
    F = (0, n.useRef)(null),
    Q = (0, n.useRef)(null),
    ee = (0, n.useRef)(null),
    et = (0, n.useRef)(null),
    ei = (0, n.useRef)({
      mode: "idle"
    }),
    er = (0, n.useRef)(new Map()),
    en = (0, n.useRef)(null),
    ea = (0, s.d)(-t * L.w),
    el = (0, s.d)(0),
    es = (0, s.d)(0),
    eo = (0, s.d)(1),
    eu = (0, s.d)(1),
    ec = (0, s.d)(1),
    ed = (0, s.d)(0),
    eh = (0, s.d)(0),
    eg = (0, s.d)(0),
    em = (0, o.G)(eg, [.6, 1], [0, 1]),
    ep = (0, o.G)(() => `${12 / Math.max(.05, eo.get() * ec.get())}px`);
  (0, u.L)(ec, "change", e => K(e > 1.01));
  let ef = (0, n.useCallback)(t => D(e[t], Z.current), [e]);
  (0, n.useLayoutEffect)(() => {
    let r = D(e[t], Z.current);
    N || !i ? (eu.jump(0), (0, c.i)(eu, 1, {
      duration: j.standard,
      ease: X
    })) : (el.jump(i.left - r.left), es.jump(i.top - r.top), eo.jump(i.width / r.width), (0, c.i)(el, 0, M), (0, c.i)(es, 0, M), (0, c.i)(eo, 1, M)), (0, c.i)(eg, 1, {
      duration: N ? j.standard : .34,
      ease: X
    }), Q.current?.focus({
      preventScroll: !0
    });
  }, []), (0, n.useEffect)(() => {
    let e = document.documentElement,
      t = window.innerWidth - e.clientWidth,
      i = {
        overflow: e.style.overflow,
        paddingRight: e.style.paddingRight
      };
    e.style.overflow = "hidden", t > 0 && (e.style.paddingRight = `${t}px`);
    let r = () => {
      let e = {
        w: window.innerWidth,
        h: window.innerHeight
      };
      Z.current = e, ea.jump(-J.current * e.w), ec.jump(1), ed.jump(0), eh.jump(0), $(e);
    };
    return window.addEventListener("resize", r), () => {
      window.removeEventListener("resize", r), e.style.overflow = i.overflow, e.style.paddingRight = i.paddingRight;
    };
  }, [ea, ec, ed, eh]);
  let ey = (0, n.useCallback)(() => {
      ec.stop(), ed.stop(), eh.stop();
    }, [ec, ed, eh]),
    ex = (0, n.useCallback)(e => {
      let t = B(ef(J.current), ec.get(), Z.current);
      if (N) {
        (0, c.i)(ed, E(ed.get(), t.minX, t.maxX), {
          duration: j.fast,
          ease: k
        }), (0, c.i)(eh, E(eh.get(), t.minY, t.maxY), {
          duration: j.fast,
          ease: k
        });
        return;
      }
      let i = {
        type: "inertia",
        power: .7,
        timeConstant: 300,
        bounceStiffness: 320,
        bounceDamping: 36,
        restDelta: .5
      };
      (0, c.i)(ed, ed.get(), {
        ...i,
        velocity: e.x,
        min: t.minX,
        max: t.maxX
      }), (0, c.i)(eh, eh.get(), {
        ...i,
        velocity: e.y,
        min: t.minY,
        max: t.maxY
      });
    }, [ef, ed, eh, N, ec]),
    eb = (0, n.useCallback)(e => {
      if (!e || N) {
        ec.jump(1), ed.jump(0), eh.jump(0);
        return;
      }
      (0, c.i)(ec, 1, R), (0, c.i)(ed, 0, R), (0, c.i)(eh, 0, R);
    }, [N, ec, ed, eh]),
    ev = (0, n.useCallback)((t, i = 0) => {
      if (U.current) return;
      let r = Z.current.w,
        n = J.current,
        a = E(t, 0, e.length - 1);
      a !== n && (eb(!1), Math.abs(a - n) > 1 && ea.jump(-(a - Math.sign(a - n)) * r + (ea.get() + n * r)), J.current = a, O(a), _(a)), N ? ea.jump(-a * r) : (0, c.i)(ea, -a * r, {
        ...z,
        velocity: i
      });
    }, [e.length, _, N, eb, ea]),
    ew = (0, n.useCallback)(t => {
      if (U.current) return;
      let i = t ?? {
        x: el.getVelocity(),
        y: es.getVelocity()
      };
      U.current = !0, q(!0);
      let r = J.current,
        n = Z.current,
        a = D(e[r], n),
        l = v(r);
      l?.scrollIntoView({
        block: "nearest",
        inline: "nearest"
      });
      let s = l?.getBoundingClientRect(),
        o = !!s && s.width > 0 && s.bottom > 0 && s.top < n.h && s.right > 0 && s.left < n.w,
        u = () => Y(r);
      if ((0, c.i)(eg, 0, {
        duration: N ? j.standard : .3,
        ease: k
      }), N || !o || !s) {
        eb(!1), ea.jump(-r * n.w), (0, c.i)(eu, 0, {
          duration: j.exit,
          ease: k
        }).then(u);
        return;
      }
      eb(!0), (0, c.i)(ea, -r * n.w, C), (0, c.i)(el, s.left - a.left, {
        ...C,
        velocity: i.x
      }), (0, c.i)(es, s.top - a.top, {
        ...C,
        velocity: i.y
      }), (0, c.i)(eo, s.width / a.width, {
        ...C,
        velocity: eo.getVelocity()
      }).then(u);
    }, [v, eu, eo, el, es, e, Y, N, eb, ea, eg]),
    e_ = (0, n.useCallback)((e, t, i, r) => {
      let n = ef(J.current),
        a = ec.get(),
        l = n.left + n.width / 2,
        s = n.top + n.height / 2,
        o = E(i, 1, 4),
        u = B(n, o, Z.current),
        d = E(e - l - (e - l - ed.get()) * (o / a), u.minX, u.maxX),
        h = E(t - s - (t - s - eh.get()) * (o / a), u.minY, u.maxY);
      r && !N ? ((0, c.i)(ec, o, R), (0, c.i)(ed, d, R), (0, c.i)(eh, h, R)) : (ec.jump(o), ed.jump(d), eh.jump(h));
    }, [ef, ed, eh, N, ec]),
    ej = (0, n.useCallback)((e, t) => {
      let i = ef(J.current);
      if (ec.get() > 1.01) return void eb(!0);
      let r = Z.current,
        n = Math.max(r.w / i.width, r.h / i.height);
      e_(e ?? i.left + i.width / 2, t ?? i.top + i.height / 2, E(n, 2, 4), !0);
    }, [ef, eb, e_, ec]);
  (0, n.useEffect)(() => {
    let e = F.current;
    if (!e) return;
    let t = {
        travel: 0,
        locked: !1,
        timer: 0
      },
      i = e => {
        if (e.preventDefault(), U.current) return;
        let i = Z.current,
          r = S(e.deltaX, e.deltaMode, i.w),
          n = S(e.deltaY, e.deltaMode, i.h);
        if (e.ctrlKey) {
          ey(), e_(e.clientX, e.clientY, ec.get() * Math.exp(-(.012 * E(n, -50, 50))), !1);
          return;
        }
        if (1.01 >= ec.get()) {
          if (window.clearTimeout(t.timer), t.timer = window.setTimeout(() => {
            t.travel = 0, t.locked = !1;
          }, 160), t.locked || Math.abs(r) <= Math.abs(n) || (t.travel += r, 70 > Math.abs(t.travel))) return;
          t.locked = !0, ev(J.current + Math.sign(t.travel));
          return;
        }
        ey();
        let a = B(ef(J.current), ec.get(), i);
        ed.jump(E(ed.get() - r, a.minX, a.maxX)), eh.jump(E(eh.get() - n, a.minY, a.maxY));
      },
      r = 1,
      n = e => {
        e.preventDefault(), ey(), r = ec.get();
      },
      a = e => {
        e.preventDefault(), U.current || e_(e.clientX, e.clientY, r * e.scale, !1);
      },
      l = e => e.preventDefault();
    return e.addEventListener("wheel", i, {
      passive: !1
    }), e.addEventListener("gesturestart", n), e.addEventListener("gesturechange", a), e.addEventListener("gestureend", l), () => {
      window.clearTimeout(t.timer), e.removeEventListener("wheel", i), e.removeEventListener("gesturestart", n), e.removeEventListener("gesturechange", a), e.removeEventListener("gestureend", l);
    };
  }, [ef, ev, ed, eh, ey, e_, ec]);
  let eY = (e, t) => {
      let i = ee.current?.getBoundingClientRect();
      return !!i && e >= i.left && e <= i.right && t >= i.top && t <= i.bottom;
    },
    eX = e => {
      if (!er.current.has(e.pointerId)) return;
      er.current.delete(e.pointerId), er.current.size || F.current?.removeAttribute("data-panning");
      let t = ei.current,
        i = Z.current;
      if ("pinch" === t.mode) {
        let t = ec.get();
        if (t < .86 && "pointercancel" !== e.type) {
          er.current.clear(), ei.current = {
            mode: "idle"
          }, ew();
          return;
        }
        t < 1 && (0, c.i)(eg, 1, {
          duration: j.fast,
          ease: X
        });
        let r = ef(J.current),
          n = [...er.current.entries()][0];
        if (n && t > 1.01) {
          let [e, t] = n;
          ei.current = {
            mode: "pan",
            id: e,
            x: t.x,
            y: t.y,
            baseStrip: ea.get(),
            basePanX: ed.get(),
            basePanY: eh.get(),
            grabX: .5,
            grabY: .5,
            onImage: !0,
            history: [{
              ...t,
              t: performance.now()
            }]
          };
        } else ei.current = {
          mode: "idle"
        };
        if (n && t > 1.01 && t <= 4) return;
        if (t <= 1.02) return void eb(!0);
        let a = E(t, 1, 4),
          l = B(r, a, i);
        return (0, c.i)(ec, a, R), (0, c.i)(ed, E(ed.get(), l.minX, l.maxX), R), void (0, c.i)(eh, E(eh.get(), l.minY, l.maxY), R);
      }
      if ("idle" === t.mode || e.pointerId !== t.id) return;
      ei.current = {
        mode: "idle"
      };
      let r = function (e) {
          let t = e[e.length - 1];
          if (!t || performance.now() - t.t > 60) return {
            x: 0,
            y: 0
          };
          let i = t;
          for (let r = e.length - 1; r >= 0 && t.t - e[r].t <= 80; r--) i = e[r];
          let r = (t.t - i.t) / 1e3;
          return r > 0 ? {
            x: (t.x - i.x) / r,
            y: (t.y - i.y) / r
          } : {
            x: 0,
            y: 0
          };
        }(t.history),
        n = e.clientX - t.x,
        a = e.clientY - t.y;
      if ("pending" === t.mode) {
        if ("pointercancel" === e.type) return;
        if (!t.onImage) return void ew();
        if ("mouse" === e.pointerType) return;
        let i = performance.now(),
          r = en.current;
        return void (r && i - r.t < 300 && 30 > Math.hypot(r.x - e.clientX, r.y - e.clientY) ? (en.current = null, ej(e.clientX, e.clientY)) : en.current = {
          x: e.clientX,
          y: e.clientY,
          t: i
        });
      }
      if ("swipe" === t.mode) {
        let e = n + ((e, t = .995) => e / 1e3 * t / (1 - t))(r.x),
          t = Math.abs(r.x) > 450 && Math.sign(r.x) === Math.sign(n) ? -Math.sign(r.x) : 0,
          a = e < -(.3 * i.w) ? 1 : e > .3 * i.w ? -1 : t;
        ev(J.current + a, r.x);
        return;
      }
      if ("dismiss" === t.mode) {
        if (a > 0 && (r.y > 500 || a > 110 && r.y > -150)) return void ew(r);
        let e = N ? {
          duration: j.fast,
          ease: k
        } : null;
        return (0, c.i)(el, 0, e ?? {
          ...R,
          velocity: r.x
        }), (0, c.i)(es, 0, e ?? {
          ...R,
          velocity: r.y
        }), (0, c.i)(eo, 1, e ?? R), void (0, c.i)(eg, 1, {
          duration: j.standard,
          ease: X
        });
      }
      "pan" === t.mode && ex(r);
    };
  (0, n.useEffect)(() => {
    let t = et.current,
      i = t?.querySelector(`[data-index="${H}"]`);
    if (!t || !i) return;
    let r = e[H],
      n = E(48 * r.width / r.height, 36, 72);
    t.scrollTo({
      left: i.offsetLeft + n / 2 - t.clientWidth / 2,
      behavior: N ? "auto" : "smooth"
    });
  }, [e, H, N]);
  let ek = T(L),
    eN = e[H],
    eM = [H - 1, H, H + 1].filter(t => t >= 0 && t < e.length);
  return (0, a.createPortal)((0, r.jsxs)("div", {
    ref: F,
    className: w().overlay,
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": P,
    onKeyDown: e => {
      if ("Escape" === e.key) {
        e.preventDefault(), ew();
        return;
      }
      if ("ArrowRight" === e.key) {
        e.preventDefault(), ev(J.current + 1);
        return;
      }
      if ("ArrowLeft" === e.key) {
        e.preventDefault(), ev(J.current - 1);
        return;
      }
      if ("+" === e.key || "=" === e.key) {
        e.preventDefault();
        let t = ef(J.current);
        e_(t.left + t.width / 2, t.top + t.height / 2, 1.5 * ec.get(), !0);
        return;
      }
      if ("-" === e.key) {
        e.preventDefault();
        let t = ef(J.current);
        e_(t.left + t.width / 2, t.top + t.height / 2, ec.get() / 1.5, !0);
        return;
      }
      if ("0" === e.key) {
        e.preventDefault(), eb(!0);
        return;
      }
      if ("Tab" === e.key) {
        let t = [...(F.current?.querySelectorAll("button:not([disabled])") ?? [])];
        if (!t.length) return;
        let i = t[0],
          r = t[t.length - 1];
        e.shiftKey && document.activeElement === i ? (e.preventDefault(), r.focus()) : e.shiftKey || document.activeElement !== r || (e.preventDefault(), i.focus());
      }
    },
    "data-closing": V || void 0,
    "data-zoomed": G || void 0,
    children: [(0, r.jsx)(d.PY1.div, {
      className: w().veil,
      style: {
        opacity: eg
      },
      "aria-hidden": "true"
    }), (0, r.jsx)("div", {
      className: w().stage,
      onPointerDown: e => {
        if (U.current || "mouse" === e.pointerType && 0 !== e.button) return;
        if (e.currentTarget.setPointerCapture(e.pointerId), er.current.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY
        }), 2 === er.current.size) {
          let [e, t] = [...er.current.values()];
          (0, c.i)(ea, -J.current * Z.current.w, R), (0, c.i)(el, 0, R), (0, c.i)(es, 0, R), (0, c.i)(eo, 1, R), (0, c.i)(eg, 1, {
            duration: j.fast
          }), ey(), ei.current = {
            mode: "pinch",
            distance: Math.hypot(e.x - t.x, e.y - t.y) || 1,
            zoom: ec.get(),
            midX: (e.x + t.x) / 2,
            midY: (e.y + t.y) / 2,
            panX: ed.get(),
            panY: eh.get()
          };
          return;
        }
        if (er.current.size > 2) return;
        ea.stop(), ed.stop(), eh.stop(), ec.get() > 1.01 && ec.stop();
        let t = ef(J.current);
        ei.current = {
          mode: "pending",
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          baseStrip: ea.get(),
          basePanX: ed.get(),
          basePanY: eh.get(),
          grabX: E((e.clientX - t.left) / t.width, 0, 1),
          grabY: E((e.clientY - t.top) / t.height, 0, 1),
          onImage: eY(e.clientX, e.clientY),
          history: [{
            x: e.clientX,
            y: e.clientY,
            t: performance.now()
          }]
        };
      },
      onPointerMove: t => {
        if (!er.current.has(t.pointerId)) return;
        er.current.set(t.pointerId, {
          x: t.clientX,
          y: t.clientY
        });
        let i = ei.current,
          r = Z.current;
        if ("pinch" === i.mode) {
          if (er.current.size < 2) return;
          let [e, t] = [...er.current.values()],
            r = (e.x + t.x) / 2,
            n = (e.y + t.y) / 2,
            a = i.zoom * Math.hypot(e.x - t.x, e.y - t.y) / i.distance,
            l = a < 1 ? 1 - I(1 - a, 1, .4) : a > 4 ? 4 + I(a - 4, 4, .4) : a,
            s = ef(J.current),
            o = s.left + s.width / 2,
            u = s.top + s.height / 2;
          ec.set(l), eg.set(l < 1 ? E(1 - (1 - l) * 4, .25, 1) : 1), ed.set(i.midX - o - (i.midX - o - i.panX) * (l / i.zoom) + (r - i.midX)), eh.set(i.midY - u - (i.midY - u - i.panY) * (l / i.zoom) + (n - i.midY));
          return;
        }
        if ("idle" === i.mode || t.pointerId !== i.id) return;
        i.history.push({
          x: t.clientX,
          y: t.clientY,
          t: performance.now()
        }), i.history.length > 12 && i.history.shift();
        let n = t.clientX - i.x,
          a = t.clientY - i.y;
        if ("pending" === i.mode) {
          if (6 > Math.hypot(n, a)) return;
          i.mode = ec.get() > 1.01 ? "pan" : Math.abs(n) > Math.abs(a) ? "swipe" : "dismiss", "pan" === i.mode && F.current?.setAttribute("data-panning", "");
        }
        if ("swipe" === i.mode) {
          let t = -(e.length - 1) * r.w,
            a = i.baseStrip + n;
          ea.set(a > 0 ? I(a, r.w) : a < t ? t + I(a - t, r.w) : a);
        } else if ("dismiss" === i.mode) {
          let e = E(Math.max(0, a) / (.6 * r.h), 0, 1),
            t = 1 - .4 * e,
            l = ef(J.current);
          eo.set(t), el.set(n + (1 - t) * l.width * i.grabX), es.set((a < 0 ? -I(-a, r.h, .35) : a) + (1 - t) * l.height * i.grabY), eg.set(1 - .85 * e);
        } else if ("pan" === i.mode) {
          let e = B(ef(J.current), ec.get(), r),
            t = (e, t, i, r) => e < t ? t - I(t - e, r) : e > i ? i + I(e - i, r) : e;
          ed.set(t(i.basePanX + n, e.minX, e.maxX, r.w)), eh.set(t(i.basePanY + a, e.minY, e.maxY, r.h));
        }
      },
      onPointerUp: eX,
      onPointerCancel: eX,
      onDoubleClick: e => {
        !U.current && eY(e.clientX, e.clientY) && ej(e.clientX, e.clientY);
      },
      children: (0, r.jsx)(d.PY1.div, {
        className: w().strip,
        style: {
          x: ea
        },
        children: eM.map(t => {
          let i = D(e[t], L),
            n = t === H;
          return (0, r.jsx)("div", {
            className: w().slide,
            style: {
              left: t * L.w,
              width: L.w,
              height: L.h
            },
            "aria-hidden": !n || void 0,
            children: (0, r.jsx)(W, {
              image: e[t],
              frame: i,
              active: n,
              imageRef: n ? ee : void 0,
              hero: n ? {
                x: el,
                y: es,
                scale: eo,
                opacity: eu
              } : null,
              zoom: n ? {
                scale: ec,
                x: ed,
                y: eh,
                radius: ep
              } : null
            })
          }, e[t].src);
        })
      })
    }), (0, r.jsxs)(d.PY1.div, {
      className: w().topBar,
      style: {
        opacity: em,
        height: ek.top
      },
      children: [(0, r.jsxs)("p", {
        className: w().counter,
        "aria-live": "polite",
        children: [(0, r.jsx)("span", {
          className: w().num,
          children: H + 1
        }), " of ", (0, r.jsx)("span", {
          className: w().num,
          children: e.length
        })]
      }), (0, r.jsxs)("h2", {
        id: P,
        className: w().srOnly,
        children: [b, ": ", eN.title ?? eN.alt]
      }), (0, r.jsxs)("div", {
        className: w().actions,
        children: [(0, r.jsx)("button", {
          type: "button",
          className: w().iconButton,
          onClick: () => ej(),
          "aria-label": G ? "Zoom out" : "Zoom in",
          "aria-pressed": G,
          children: G ? (0, r.jsx)(g.A, {
            size: 20,
            strokeWidth: 1.75,
            "aria-hidden": "true"
          }) : (0, r.jsx)(m.A, {
            size: 20,
            strokeWidth: 1.75,
            "aria-hidden": "true"
          })
        }), (0, r.jsx)("button", {
          ref: Q,
          type: "button",
          className: w().iconButton,
          onClick: () => ew(),
          "aria-label": "Close viewer",
          children: (0, r.jsx)(p.A, {
            size: 20,
            strokeWidth: 1.75,
            "aria-hidden": "true"
          })
        })]
      })]
    }), (0, r.jsxs)(d.PY1.div, {
      className: w().sideNav,
      style: {
        opacity: em
      },
      children: [(0, r.jsx)("button", {
        type: "button",
        className: w().navButton,
        "data-side": "prev",
        onClick: () => ev(H - 1),
        disabled: 0 === H,
        "aria-label": "Previous photo",
        children: (0, r.jsx)(f.A, {
          size: 20,
          strokeWidth: 1.75,
          "aria-hidden": "true"
        })
      }), (0, r.jsx)("button", {
        type: "button",
        className: w().navButton,
        "data-side": "next",
        onClick: () => ev(H + 1),
        disabled: H === e.length - 1,
        "aria-label": "Next photo",
        children: (0, r.jsx)(y.A, {
          size: 20,
          strokeWidth: 1.75,
          "aria-hidden": "true"
        })
      })]
    }), (0, r.jsxs)(d.PY1.div, {
      className: w().bottom,
      style: {
        opacity: em,
        height: ek.bottom
      },
      children: [(0, r.jsx)("div", {
        className: w().captions,
        children: (0, r.jsx)(h.N, {
          initial: !1,
          children: (0, r.jsxs)(d.PY1.div, {
            className: w().caption,
            initial: N ? {
              opacity: 0
            } : {
              opacity: 0,
              y: 6
            },
            animate: {
              opacity: 1,
              y: 0
            },
            exit: {
              opacity: 0,
              transition: {
                duration: j.fast
              }
            },
            transition: N ? {
              duration: j.fast
            } : {
              duration: j.standard,
              ease: X,
              delay: .04
            },
            children: [eN.title && (0, r.jsx)("p", {
              className: w().captionTitle,
              children: eN.title
            }), eN.caption && (0, r.jsx)("p", {
              className: w().captionText,
              children: eN.caption
            })]
          }, H)
        })
      }), (0, r.jsx)("div", {
        ref: et,
        className: w().thumbStrip,
        role: "group",
        "aria-label": "All photos",
        children: e.map((e, t) => {
          let i = E(48 * e.width / e.height, 36, 72);
          return (0, r.jsx)("button", {
            type: "button",
            "data-index": t,
            className: w().stripThumb,
            "data-active": t === H || void 0,
            style: {
              width: t === H ? i : 36
            },
            onClick: () => ev(t),
            "aria-label": `Show ${e.title ?? e.alt}`,
            "aria-current": t === H ? "true" : void 0,
            children: (0, r.jsx)(x.W, {
              src: e.src,
              alt: "",
              width: e.width,
              height: e.height,
              sizes: "80px",
              draggable: !1
            })
          }, e.src);
        })
      })]
    })]
  }), document.body);
}
function W({
  image: e,
  frame: t,
  active: i,
  hero: a,
  zoom: l,
  imageRef: s
}) {
  let [o, u] = (0, n.useState)(!1);
  return (0, r.jsx)(d.PY1.div, {
    className: w().frame,
    style: {
      left: t.left,
      top: t.top,
      width: t.width,
      height: t.height,
      ...(a ?? {})
    },
    children: (0, r.jsxs)(d.PY1.div, {
      ref: s,
      className: w().zoom,
      style: l ? {
        scale: l.scale,
        x: l.x,
        y: l.y,
        borderRadius: l.radius
      } : {
        borderRadius: 12
      },
      children: [(0, r.jsx)(x.W, {
        src: e.src,
        alt: "",
        width: e.width,
        height: e.height,
        sizes: P,
        draggable: !1,
        className: w().layer
      }), (0, r.jsx)(x.W, {
        src: e.src,
        alt: i ? e.alt : "",
        width: e.width,
        height: e.height,
        sizes: "100vw",
        draggable: !1,
        className: w().layer,
        "data-loaded": o || void 0,
        onLoad: () => u(!0),
        loading: i ? "eager" : "lazy"
      })]
    })
  });
}
