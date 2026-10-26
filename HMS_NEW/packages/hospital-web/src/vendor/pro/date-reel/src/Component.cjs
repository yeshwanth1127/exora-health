// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("./interop.cjs");
interop.r(exports), interop.d(exports, {
  DateReelDemo: () => C,
  DateReel: () => A,
  default: () => I
});
var n = require("react/jsx-runtime"),
  a = require("react"),
  l = require("./dependencies/18310.cjs"),
  o = require("./dependencies/92571.cjs"),
  u = require("./dependencies/64577.cjs"),
  i = require("./dependencies/40426.cjs"),
  c = interop.n(i);
let s = 20 * Math.PI / 180,
  d = 1 / (2 * Math.sin(s / 2)),
  m = new Date(2026, 8, 24, 9, 30),
  p = (e, t) => (e % t + t) % t,
  h = (e, t, r) => Math.min(r, Math.max(t, e)),
  f = e => new Date(e.getFullYear(), e.getMonth(), e.getDate()),
  g = (e, t) => new Date(e.getFullYear(), e.getMonth(), e.getDate() + t, e.getHours(), e.getMinutes()),
  y = (e, t) => Math.round((f(e).getTime() - f(t).getTime()) / 864e5),
  M = (e, t) => new Date(e, t + 1, 0).getDate(),
  v = e => e.charAt(0).toLocaleUpperCase() + e.slice(1),
  _ = e => String(e).padStart(2, "0"),
  w = e => ({
    p: e,
    v: 0,
    mode: 0,
    target: e,
    k: 0,
    stiff: 0,
    damp: 0,
    delay: 0,
    wheelAt: 0,
    samples: []
  }),
  b = e => .55 * e * 2.4 / (2.4 + .55 * e),
  x = [{
    label: "This evening",
    value: e => new Date(e.getFullYear(), e.getMonth(), e.getDate(), 18, 0)
  }, {
    label: "Tomorrow",
    value: e => new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1, 9, 0)
  }, {
    label: "Monday",
    value: e => new Date(e.getFullYear(), e.getMonth(), e.getDate() + ((8 - e.getDay()) % 7 || 7), 9, 0)
  }],
  k = {
    day: "Day",
    month: "Month",
    date: "Day of month",
    year: "Year",
    hour: "Hour",
    minute: "Minute",
    period: "AM or PM",
    at: "at",
    presets: "Quick picks",
    confirm: "Schedule",
    pending: "Scheduling",
    done: "Scheduled",
    failed: "Try again"
  };
function D(e, t, r, n, a) {
  let l;
  if ("date" === t) return {
    headline: n.full.format(e).replace(/,? \d{4}$/, ""),
    detail: `${function (e, t, r) {
      let n = y(e, t);
      if (45 > Math.abs(n)) return v(r.relative.format(n, "day"));
      let a = (e.getFullYear() - t.getFullYear()) * 12 + e.getMonth() - t.getMonth();
      return 18 > Math.abs(a) ? v(r.relative.format(a, "month")) : v(r.relative.format(Math.trunc(a / 12), "year"));
    }(e, r, n)}, ${e.getFullYear()}`
  };
  let o = n.time.format(e);
  return "time" === t ? {
    headline: o,
    detail: n.full.format(e)
  } : {
    headline: `${1 >= Math.abs(l = y(e, r)) ? v(n.relative.format(l, "day")) : l > 1 && l < 7 ? n.shortDay.format(e) : n.monthDay.format(e)} ${a} ${o}`,
    detail: n.full.format(e)
  };
}
function j(e, t, r, n, a, l, o, u) {
  let i = Math.min(60 / o - 1, Math.round(e.getMinutes() / o)),
    c = e.getHours(),
    s = 12 === u ? [c % 12, i, +(c >= 12)] : [c, i];
  return "time" === t ? s : "date" === t ? [e.getMonth(), e.getDate() - 1, h(e.getFullYear() - n, 0, a - 1)] : [h(y(e, r), 0, l - 1), ...s];
}
function A({
  mode: e = "datetime",
  value: t,
  defaultValue: r,
  onChange: i,
  today: N,
  minDate: R,
  maxDate: T,
  minuteStep: F = 5,
  hourCycle: C = 12,
  locale: I = "en-US",
  presets: Y = x,
  title: L,
  onConfirm: S,
  labels: E,
  intro: z = !0,
  speed: $ = 1,
  paused: P = !1,
  accent: q,
  label: U,
  className: O,
  style: H
}) {
  let B = (0, a.useMemo)(() => ({
      ...k,
      ...E
    }), [E]),
    K = (0, l.I)() ?? !1,
    W = (0, a.useId)(),
    [Q] = (0, a.useState)(() => t ?? r ?? m),
    [Z, G] = (0, a.useState)(Q),
    [J, X] = (0, a.useState)(""),
    [V, ee] = (0, a.useState)("idle"),
    [et, er] = (0, a.useState)(-1),
    en = f(N ?? Q).getTime(),
    ea = (0, a.useMemo)(() => new Date(en), [en]),
    el = f(R ?? ("date" === e ? new Date(ea.getFullYear() - 100, 0, 1) : g(ea, -30))).getTime(),
    eo = f(T ?? ("date" === e ? new Date(ea.getFullYear() + 10, 11, 31) : g(ea, 365))).getTime(),
    eu = (0, a.useMemo)(() => new Date(el), [el]),
    ei = (0, a.useMemo)(() => new Date(Math.max(el, eo)), [el, eo]),
    ec = y(ei, eu) + 1,
    es = eu.getFullYear(),
    ed = ei.getFullYear() - es + 1,
    em = (0, a.useMemo)(() => {
      let e, t, r;
      return t = (e = e => new Intl.DateTimeFormat(I, e))({
        hour: "numeric",
        hour12: !0
      }), r = e => t.formatToParts(new Date(2026, 0, 1, e)).find(e => "dayPeriod" === e.type)?.value ?? (e < 12 ? "AM" : "PM"), {
        dayLabel: e({
          weekday: "short",
          month: "short",
          day: "numeric"
        }),
        month: e({
          month: "long"
        }),
        time: e({
          hour: "numeric",
          minute: "2-digit",
          hour12: 12 === C
        }),
        full: e({
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric"
        }),
        shortDay: e({
          weekday: "long"
        }),
        monthDay: e({
          weekday: "short",
          month: "short",
          day: "numeric"
        }),
        relative: new Intl.RelativeTimeFormat(I, {
          numeric: "auto"
        }),
        periods: [r(9), r(21)]
      };
    }, [I, C]),
    ep = (0, a.useMemo)(() => function (e, t, r, n, a, l, o, u, i, c) {
      let s = 12 === i ? {
          key: "hour",
          name: c.hour,
          count: 12,
          loop: !0,
          align: "end",
          page: 3,
          sizer: ["12"],
          label: e => String(0 === e ? 12 : e)
        } : {
          key: "hour",
          name: c.hour,
          count: 24,
          loop: !0,
          align: "end",
          page: 6,
          sizer: ["00"],
          label: _
        },
        d = {
          key: "minute",
          name: c.minute,
          count: 60 / u,
          loop: !0,
          align: "start",
          page: Math.max(1, Math.round(15 / u)),
          sizer: ["00"],
          label: e => _(e * u)
        },
        m = {
          key: "period",
          name: c.period,
          count: 2,
          loop: !1,
          align: "start",
          page: 1,
          sizer: [...t.periods],
          label: e => t.periods[e] ?? ""
        },
        p = 12 === i ? [s, d, m] : [s, d];
      if ("time" === e) return p;
      if ("date" === e) {
        let e = Array.from({
          length: 12
        }, (e, r) => t.month.format(new Date(2026, r, 1)));
        return [{
          key: "month",
          name: c.month,
          count: 12,
          loop: !0,
          align: "start",
          page: 3,
          sizer: e,
          label: t => e[t]
        }, {
          key: "date",
          name: c.date,
          count: 31,
          loop: !0,
          align: "end",
          page: 7,
          sizer: ["00"],
          label: e => String(e + 1)
        }, {
          key: "year",
          name: c.year,
          count: o,
          loop: !1,
          align: "start",
          page: 10,
          sizer: ["0000"],
          label: e => String(l + e)
        }];
      }
      let h = y(a, r),
        f = v(t.relative.format(0, "day")),
        M = e => e === h ? f : t.dayLabel.format(g(r, e)),
        w = new Map([[f, f]]);
      for (let e = 0; e < Math.min(n, 400); e++) {
        let t = M(e).replace(/\d/g, "0");
        w.has(t) || w.set(t, t);
      }
      let b = [...w.values()];
      return [{
        key: "day",
        name: c.day,
        count: n,
        loop: !1,
        align: "end",
        page: 7,
        sizer: b,
        label: M
      }, ...p];
    }(e, em, eu, ec, ea, es, ed, F, C, B), [e, em, eu, ec, ea, es, ed, F, C, B]),
    eh = (0, a.useCallback)(t => j(t, e, eu, es, ed, ec, F, C), [e, eu, es, ed, ec, F, C]),
    ef = (0, a.useCallback)((t, r) => {
      let n = (e, t, r) => ({
        h: 12 === C ? p(e, 12) + 12 * (1 === r) : p(e, 24),
        m: p(t, 60 / F) * F
      });
      if ("date" === e) {
        let e = es + h(t[2], 0, ed - 1),
          n = p(t[0], 12);
        return new Date(e, n, Math.min(p(t[1], 31) + 1, M(e, n)), r.getHours(), r.getMinutes());
      }
      if ("time" === e) {
        let e = n(t[0], t[1], t[2]);
        return new Date(r.getFullYear(), r.getMonth(), r.getDate(), e.h, e.m);
      }
      let a = g(eu, h(t[0], 0, ec - 1)),
        l = n(t[1], t[2], t[3]);
      return new Date(a.getFullYear(), a.getMonth(), a.getDate(), l.h, l.m);
    }, [e, C, F, es, ed, eu, ec]),
    eg = (0, a.useRef)(null),
    ey = (0, a.useRef)([]),
    eM = (0, a.useRef)([]),
    ev = (0, a.useRef)([]),
    e_ = (0, a.useRef)([]),
    ew = (0, a.useRef)([]),
    eb = (0, a.useRef)(null),
    ex = (0, a.useRef)(null),
    ek = (0, a.useRef)(36),
    [eD] = (0, a.useState)(() => ({
      current: j(Q, e, eu, es, ed, ec, F, C).map(w)
    })),
    ej = (0, a.useRef)(0),
    eA = (0, a.useRef)(0),
    eN = (0, a.useRef)(!1),
    eR = (0, a.useRef)(z),
    eT = (0, a.useRef)(!1),
    eF = (0, a.useRef)(!1),
    eC = (0, a.useRef)(""),
    eI = (0, a.useRef)(null),
    eY = (0, a.useRef)(Z),
    eL = (0, a.useRef)(null),
    eS = (0, a.useRef)({
      text: "",
      at: 0
    }),
    eE = (0, a.useRef)([]),
    ez = K || P,
    e$ = (0, a.useRef)({
      columns: ep,
      fromIndexes: ef,
      toIndexes: eh,
      f: em,
      today: ea,
      mode: e,
      L: B,
      instant: ez,
      speed: $,
      onChange: i
    });
  (0, a.useLayoutEffect)(() => {
    e$.current = {
      columns: ep,
      fromIndexes: ef,
      toIndexes: eh,
      f: em,
      today: ea,
      mode: e,
      L: B,
      instant: ez,
      speed: $,
      onChange: i
    };
  });
  let eP = ep.map(e => `${e.key}:${e.count}`).join("|"),
    eq = () => eD.current.map((e, t) => {
      let r = e$.current.columns[t],
        n = Math.round(e.p);
      return r.loop ? p(n, r.count) : h(n, 0, r.count - 1);
    }),
    eU = (0, a.useCallback)(() => {
      let {
          columns: e,
          fromIndexes: t,
          f: r,
          today: n,
          mode: a,
          L: l
        } = e$.current,
        o = d * ek.current,
        u = 31;
      if ("date" === a) {
        let t = e.findIndex(e => "month" === e.key),
          r = e.findIndex(e => "year" === e.key),
          n = p(Math.round(eD.current[t]?.p ?? 0), 12);
        u = M(Number(e[r]?.label(h(Math.round(eD.current[r]?.p ?? 0), 0, e[r].count - 1)) ?? 2026), n);
      }
      e.forEach((e, t) => {
        let r = eD.current[t];
        if (!r) return;
        let n = Math.round(r.p),
          a = e_.current[t] ??= [],
          l = ew.current[t] ??= [];
        for (let i = 0; i < 11; i++) {
          let c = n + i - 5,
            d = (c - r.p) * s,
            m = eM.current[t]?.[i],
            h = ev.current[t]?.[i];
          if (!m || !h) continue;
          let f = !e.loop && (c < 0 || c >= e.count),
            g = e.loop ? p(c, e.count) : c,
            y = f ? "" : e.label(g);
          a[i] !== y && (a[i] = y, m.textContent = y, h.textContent = y);
          let M = "date" === e.key && g + 1 > u;
          if (l[i] !== M && (l[i] = M, m.toggleAttribute("data-off", M), h.toggleAttribute("data-off", M)), Math.abs(d) >= Math.PI / 2) {
            m.style.opacity = "0", h.style.opacity = "0";
            continue;
          }
          let v = Math.cos(d),
            _ = 4 / (5 - v),
            w = `translate3d(0, ${(o * Math.sin(d)).toFixed(2)}px, 0) scale(${_.toFixed(4)}, ${(v * _).toFixed(4)})`;
          m.style.transform = w, h.style.transform = w, m.style.opacity = (v ** 1.5).toFixed(3), h.style.opacity = "1";
        }
      });
      let i = eq(),
        c = eI.current ? `pin:${eI.current.getTime()}` : i.join(",");
      if (c !== eC.current) {
        eC.current = c;
        let e = D(eI.current ?? t(i, eY.current), a, n, r, l.at);
        eb.current && (eb.current.textContent = e.headline), ex.current && (ex.current.textContent = e.detail);
      }
    }, []),
    eO = (0, a.useCallback)(() => {
      let {
        columns: e,
        fromIndexes: t,
        mode: r,
        f: n,
        today: a,
        L: l,
        instant: o
      } = e$.current;
      eT.current = !1;
      let u = eq();
      if ("date" === r) {
        let r = e.findIndex(e => "date" === e.key),
          n = t(u, eY.current).getDate() - 1;
        if (u[r] !== n) {
          let e = eD.current[r],
            t = Math.round(e.p) - (u[r] - n);
          if (o) e.p = t, e.target = t, eU();else {
            e.target = t, e.mode = 3, e.stiff = 300, e.damp = 2 * Math.sqrt(300), eT.current = !0, eB();
            return;
          }
        }
      }
      let i = t(eq(), eY.current);
      if (i.getTime() !== eY.current.getTime() && (eY.current = i, G(i), eF.current)) {
        let e = D(i, r, a, n, l.at);
        X(`${e.headline}. ${e.detail}`), ee(e => "idle" === e ? e : "idle"), e$.current.onChange?.(i);
      }
    }, [eU]),
    eH = (0, a.useCallback)(e => {
      let t = Math.min(.05, (e - (eA.current || e)) / 1e3);
      eA.current = e;
      let r = t * e$.current.speed,
        n = !1;
      for (let t of eD.current) {
        if (0 === t.mode || (n = !0, 1 === t.mode)) continue;
        if (t.delay > 0) {
          t.delay -= r;
          continue;
        }
        if (4 === t.mode) {
          let n = t.p;
          t.p += (t.target - t.p) * (1 - Math.exp(-22 * r)), t.v = r > 0 ? (t.p - n) / r : 0, e - t.wheelAt > 100 && (t.mode = 3, t.target = eK(eD.current.indexOf(t), t.target), t.stiff = 260, t.damp = 2 * Math.sqrt(260));
          continue;
        }
        if (2 === t.mode) {
          let e = (t.target - t.p) * Math.exp(-t.k * r);
          if (t.p = t.target - e, t.v = t.k * e, .45 > Math.abs(e)) {
            let e = Math.min(Math.max(t.k, 8), 1.75 * t.k);
            t.mode = 3, t.stiff = e * e, t.damp = 2 * e;
          }
          continue;
        }
        let a = 1 / 240;
        for (let e = 0; e < r; e += a) {
          let n = Math.min(a, r - e);
          t.v += (-t.stiff * (t.p - t.target) - t.damp * t.v) * n, t.p += t.v * n;
        }
        .0015 > Math.abs(t.p - t.target) && .02 > Math.abs(t.v) && (t.p = t.target, t.v = 0, t.mode = 0);
      }
      eU(), n ? ej.current = requestAnimationFrame(eH) : (ej.current = 0, eA.current = 0, eI.current && (eI.current = null, eU()), eT.current && eO());
    }, [eU, eO]);
  function eB() {
    ej.current || !eN.current || document.hidden || (ej.current = requestAnimationFrame(eH));
  }
  function eK(e, t) {
    let r = e$.current.columns[e],
      n = Math.round(t);
    return r.loop ? n : h(n, 0, r.count - 1);
  }
  function eW(e, t, r = 260, n = 0) {
    let a = eD.current[e];
    if (a) {
      if (eT.current = !0, e$.current.instant) {
        a.p = t, a.target = t, a.v = 0, a.mode = 0, eU(), ej.current || eO();
        return;
      }
      a.target = t, a.mode = 3, a.stiff = r, a.damp = 2 * Math.sqrt(r), a.delay = n, eB();
    }
  }
  let eQ = (e, t = 0) => {
      let r = e$.current.toIndexes(e);
      e$.current.instant || (eI.current = e$.current.fromIndexes(r, eY.current), eC.current = ""), e$.current.columns.forEach((e, n) => {
        let a = eD.current[n],
          l = e.loop ? Math.round(a.target) + (p(r[n] - Math.round(a.target), e.count) + e.count / 2) % e.count - e.count / 2 : r[n];
        eW(n, Math.round(l), 150, t * n);
      });
    },
    eZ = t?.getTime();
  (0, a.useEffect)(() => {
    if (void 0 === eZ || eZ === eY.current.getTime()) return;
    let e = new Date(eZ);
    eF.current = !1, eQ(e);
  }, [eZ]);
  let eG = (0, a.useRef)(eP);
  (0, a.useLayoutEffect)(() => {
    eG.current === eP || (eG.current = eP, eD.current = eh(eY.current).map(w), e_.current = [], ew.current = [], eC.current = "", eU());
  }, [eP, ep, eh, eU, eD]), (0, a.useLayoutEffect)(() => {
    let e = eg.current;
    if (!e) return;
    (!eR.current || e$.current.instant) && e.removeAttribute("data-intro");
    let t = () => {
      let t = e.querySelector("[data-row]"),
        r = t?.getBoundingClientRect().height || 36;
      Math.abs(r - ek.current) > .1 && (ek.current = r, eU());
    };
    t(), eU();
    let r = new ResizeObserver(t);
    r.observe(e);
    let n = new IntersectionObserver(([t]) => {
      if (eN.current = t.isIntersecting, !t.isIntersecting) {
        cancelAnimationFrame(ej.current), ej.current = 0, eA.current = 0;
        return;
      }
      eR.current && (eR.current = !1, e$.current.instant || (e$.current.columns.forEach((e, t) => {
        let r = eD.current[t],
          n = e.loop ? r.p - (5 + 2 * t) : r.p >= 1 ? Math.max(0, r.p - 6) : Math.min(e.count - 1, r.p + 6);
        if (n === r.p) return;
        let a = r.p;
        r.p = n, r.target = a, r.mode = 2, r.k = 3, r.delay = .07 * t;
      }), eI.current = eY.current, eC.current = "", eU()), e.removeAttribute("data-intro")), eD.current.some(e => 0 !== e.mode) && eB();
    }, {
      threshold: .25
    });
    n.observe(e);
    let a = () => {
      document.hidden ? (cancelAnimationFrame(ej.current), ej.current = 0, eA.current = 0) : eD.current.some(e => 0 !== e.mode) && eB();
    };
    return document.addEventListener("visibilitychange", a), () => {
      r.disconnect(), n.disconnect(), document.removeEventListener("visibilitychange", a), cancelAnimationFrame(ej.current), ej.current = 0;
    };
  }, [eU]), (0, a.useEffect)(() => {
    if (!ez) {
      eD.current.some(e => 0 !== e.mode && 1 !== e.mode) && eB();
      return;
    }
    let e = !1;
    eD.current.forEach((t, r) => {
      (2 === t.mode || 3 === t.mode || 4 === t.mode) && (t.p = 4 === t.mode ? eK(r, t.target) : t.target, t.v = 0, t.mode = 0, e = !0);
    }), e && (cancelAnimationFrame(ej.current), ej.current = 0, eU(), eO());
  }, [ez]), (0, a.useEffect)(() => {
    let e = ey.current.map((e, t) => {
      if (!e) return () => {};
      let r = e => {
        if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
        e.preventDefault();
        let r = eD.current[t],
          n = e$.current.columns[t];
        if (!r || !n || 1 === r.mode) return;
        let a = 1 === e.deltaMode ? 16 : 2 === e.deltaMode ? 240 : 1,
          l = e.deltaY * a / (1.4 * ek.current);
        if (eF.current = !0, eT.current = !0, eI.current = null, !e$.current.instant) {
          4 !== r.mode && (r.target = r.p), r.target += l, n.loop || (r.target = h(r.target, -.35, n.count - .65)), r.mode = 4, r.wheelAt = performance.now(), eB();
          return;
        }
        r.p += l, n.loop || (r.p = h(r.p, -.35, n.count - .65)), r.v = 0, r.target = r.p, r.mode = 4, r.wheelAt = performance.now(), eU(), window.clearTimeout(eE.current[t]), eE.current[t] = window.setTimeout(() => {
          r.p = eK(t, r.p), r.target = r.p, r.mode = 0, eU(), eO();
        }, 140);
      };
      return e.addEventListener("wheel", r, {
        passive: !1
      }), () => e.removeEventListener("wheel", r);
    });
    return () => e.forEach(e => e());
  }, [eP]);
  let eJ = e => {
      let t = eL.current;
      if (!t || t.pointer !== e.pointerId) return;
      let r = eD.current[t.col],
        n = e$.current.columns[t.col],
        a = e.clientY - t.y;
      Math.abs(a) > 3 && (t.moved = !0);
      let l = t.p - a / ek.current;
      !n.loop && (l < 0 ? l = -b(-l) : l > n.count - 1 && (l = n.count - 1 + b(l - (n.count - 1)))), r.p = l;
      let o = performance.now();
      for (r.samples.push({
        t: o,
        p: l
      }); r.samples.length > 2 && o - r.samples[0].t > 100;) r.samples.shift();
      eN.current ? ej.current || (ej.current = requestAnimationFrame(eH)) : eU();
    },
    eX = e => {
      let t = eL.current;
      if (!t || t.pointer !== e.pointerId) return;
      eL.current = null, eg.current?.removeAttribute("data-dragging");
      let r = t.col,
        n = eD.current[r],
        a = e$.current.columns[r];
      if (!t.moved) {
        let t = e.currentTarget.getBoundingClientRect(),
          a = Math.round(Math.asin(h((e.clientY - (t.top + t.height / 2)) / (d * ek.current), -.98, .98)) / s);
        n.mode = 0, eW(r, eK(r, Math.round(n.p) + a));
        return;
      }
      let l = performance.now(),
        o = n.samples[0],
        u = n.samples[n.samples.length - 1],
        i = o && u && u.t - o.t > 8 && l - u.t < 90 ? (u.p - o.p) / ((u.t - o.t) / 1e3) : 0;
      if (i = h(i, -60, 60), e$.current.instant) {
        n.mode = 0, n.p = eK(r, n.p + .3 * i), n.target = n.p, eU(), eO();
        return;
      }
      let c = !a.loop && (n.p < 0 || n.p > a.count - 1),
        m = eK(r, n.p + .32 * i);
      if (n.v = i, c || .5 > Math.abs(i)) n.mode = 3, n.target = eK(r, n.p), n.stiff = 260, n.damp = 2 * Math.sqrt(260);else {
        let e = i / (m - n.p),
          t = !a.loop && Math.round(n.p + .32 * i) !== m;
        !t && e > 2.2 && e < 14 ? (n.mode = 2, n.target = m, n.k = e) : (n.mode = 3, n.target = m, n.stiff = 170, n.damp = 2 * Math.sqrt(170) * (t ? .62 : 1));
      }
      eB();
    },
    eV = async () => {
      if (S && "pending" !== V) {
        ee("pending");
        try {
          await S(eY.current), ee("done"), X(`${B.done}. ${D(eY.current, e, ea, em, B.at).headline}`);
        } catch {
          ee("failed"), X(B.failed);
        }
      }
    },
    e0 = eh(Z),
    e1 = D(Z, e, ea, em, B.at),
    e2 = !1 === Y ? [] : Y;
  return (0, n.jsxs)("div", {
    ref: eg,
    role: "group",
    "aria-label": U ?? ("time" === e ? "Time" : "date" === e ? "Date" : "Date and time"),
    className: [c().root, O].filter(Boolean).join(" "),
    style: {
      ...(q ? {
        "--dr-accent": q
      } : void 0),
      ...H
    },
    "data-mode": e,
    "data-intro": z ? "" : void 0,
    children: [(0, n.jsxs)("div", {
      className: c().body,
      children: [(0, n.jsxs)("div", {
        className: c().header,
        children: [L && (0, n.jsx)("h3", {
          className: c().title,
          children: L
        }), (0, n.jsxs)("p", {
          className: c().summary,
          "aria-hidden": "true",
          children: [(0, n.jsx)("span", {
            ref: eb,
            className: c().headline,
            children: e1.headline
          }), (0, n.jsx)("span", {
            ref: ex,
            className: c().detail,
            children: e1.detail
          })]
        })]
      }), (0, n.jsxs)("div", {
        className: c().stage,
        children: [(0, n.jsx)("div", {
          className: c().lens,
          "aria-hidden": "true"
        }), (0, n.jsx)("div", {
          className: c().reels,
          children: ep.map((e, t) => {
            let r = e0[t];
            return (0, n.jsxs)("div", {
              ref: e => {
                ey.current[t] = e;
              },
              className: c().reel,
              "data-align": e.align,
              style: {
                "--dr-i": t
              },
              "data-active": et === t ? "" : void 0,
              role: "spinbutton",
              tabIndex: 0,
              "aria-label": e.name,
              "aria-valuemin": 0,
              "aria-valuemax": e.count - 1,
              "aria-valuenow": r,
              "aria-valuetext": e.label(r),
              onPointerDown: e => {
                if (0 !== e.button || eL.current) return;
                let r = eD.current[t];
                r && (e.currentTarget.setPointerCapture(e.pointerId), e.currentTarget.focus({
                  preventScroll: !0
                }), r.mode = 1, r.v = 0, r.samples = [{
                  t: performance.now(),
                  p: r.p
                }], eL.current = {
                  col: t,
                  pointer: e.pointerId,
                  y: e.clientY,
                  p: r.p,
                  moved: !1
                }, eI.current = null, eF.current = !0, eT.current = !0, eg.current?.setAttribute("data-dragging", ""));
              },
              onPointerMove: eJ,
              onPointerUp: eX,
              onPointerCancel: eX,
              onKeyDown: e => {
                let r = e$.current.columns[t],
                  n = eD.current[t];
                if (!r || !n) return;
                let a = 0 === n.mode || 3 === n.mode ? Math.round(n.target) : Math.round(n.p),
                  l = null;
                switch (e.key) {
                  case "ArrowUp":
                    l = a - 1;
                    break;
                  case "ArrowDown":
                    l = a + 1;
                    break;
                  case "PageUp":
                    l = a - r.page;
                    break;
                  case "PageDown":
                    l = a + r.page;
                    break;
                  case "Home":
                    l = r.loop ? a - p(a, r.count) : 0;
                    break;
                  case "End":
                    l = r.loop ? a - p(a, r.count) + r.count - 1 : r.count - 1;
                    break;
                  case "ArrowLeft":
                  case "ArrowRight":
                    {
                      let r = t + ("ArrowLeft" === e.key ? -1 : 1);
                      ey.current[r] && (e.preventDefault(), ey.current[r]?.focus());
                      return;
                    }
                  default:
                    {
                      if (1 !== e.key.length || e.metaKey || e.ctrlKey || e.altKey) return;
                      let t = performance.now(),
                        n = (t - eS.current.at < 900 ? eS.current.text : "") + e.key.toLocaleLowerCase();
                      eS.current = {
                        text: n,
                        at: t
                      };
                      let o = e => {
                          for (let t = 0; t < r.count; t++) {
                            let n = p(a + 1 + t - (e.length > 1), r.count),
                              l = r.label(n).toLocaleLowerCase();
                            if (l.startsWith(e) || l.replace(/^0/, "").startsWith(e)) return n;
                          }
                          return -1;
                        },
                        u = o(n);
                      if (u < 0 && n.length > 1 && (eS.current.text = e.key.toLocaleLowerCase(), u = o(eS.current.text)), u < 0) return;
                      l = r.loop ? a + (p(u - a, r.count) + r.count / 2) % r.count - r.count / 2 : u;
                    }
                }
                e.preventDefault(), eF.current = !0, eI.current = null, eW(t, eK(t, Math.round(l)), 300);
              },
              onFocus: () => er(t),
              onBlur: () => er(e => e === t ? -1 : e),
              children: [(0, n.jsx)("span", {
                className: c().sizer,
                "aria-hidden": "true",
                "data-row": !0,
                children: e.sizer.map(e => (0, n.jsx)("span", {
                  children: e
                }, e))
              }), (0, n.jsx)("span", {
                className: c().drum,
                "aria-hidden": "true",
                children: Array.from({
                  length: 11
                }, (a, l) => {
                  let o = r + l - 5,
                    u = !e.loop && (o < 0 || o >= e.count) ? "" : e.label(e.loop ? p(o, e.count) : o);
                  return (0, n.jsx)("span", {
                    ref: e => {
                      (eM.current[t] ??= [])[l] = e;
                    },
                    className: c().item,
                    children: u
                  }, l);
                })
              }), (0, n.jsx)("span", {
                className: c().window,
                "aria-hidden": "true",
                children: Array.from({
                  length: 11
                }, (a, l) => {
                  let o = r + l - 5,
                    u = !e.loop && (o < 0 || o >= e.count) ? "" : e.label(e.loop ? p(o, e.count) : o);
                  return (0, n.jsx)("span", {
                    ref: e => {
                      (ev.current[t] ??= [])[l] = e;
                    },
                    className: c().lensItem,
                    children: u
                  }, l);
                })
              })]
            }, e.key);
          })
        })]
      }), (e2.length > 0 || S) && (0, n.jsxs)("div", {
        className: c().footer,
        children: [e2.length > 0 && (0, n.jsx)("div", {
          className: c().presets,
          role: "group",
          "aria-label": B.presets,
          children: e2.map(e => {
            let t = 6e4 > Math.abs(("function" == typeof e.value ? e.value(ea) : e.value).getTime() - Z.getTime());
            return (0, n.jsx)("button", {
              type: "button",
              className: c().preset,
              "aria-pressed": t,
              onClick: () => {
                let t;
                return t = "function" == typeof e.value ? e.value(ea) : e.value, void (eF.current = !0, eQ(new Date(h(t.getTime(), eu.getTime(), ei.getTime() + 864e5 - 6e4)), .06));
              },
              children: e.label
            }, e.label);
          })
        }), S && (0, n.jsx)("button", {
          type: "button",
          className: c().confirm,
          "data-state": V,
          onClick: eV,
          "aria-disabled": "pending" === V,
          children: (0, n.jsxs)("span", {
            className: c().confirmStack,
            children: [(0, n.jsx)("span", {
              "data-show": "idle" === V || void 0,
              children: B.confirm
            }), (0, n.jsxs)("span", {
              "data-show": "pending" === V || void 0,
              children: [(0, n.jsx)(o.A, {
                className: c().spin,
                size: 16,
                strokeWidth: 1.75,
                "aria-hidden": "true"
              }), B.pending]
            }), (0, n.jsxs)("span", {
              "data-show": "done" === V || void 0,
              children: [(0, n.jsx)(u.A, {
                size: 16,
                strokeWidth: 1.75,
                "aria-hidden": "true"
              }), B.done]
            }), (0, n.jsx)("span", {
              "data-show": "failed" === V || void 0,
              children: B.failed
            })]
          })
        })]
      })]
    }), (0, n.jsx)("span", {
      id: `${W}-status`,
      className: c().srOnly,
      role: "status",
      "aria-live": "polite",
      children: J
    })]
  });
}
var N = require("./dependencies/72575.cjs"),
  R = interop.n(N);
let T = new Date(2026, 8, 24),
  F = new Date(2026, 8, 25, 9, 0);
function C() {
  return (0, n.jsx)("div", {
    className: R().demo,
    children: (0, n.jsx)(A, {
      title: "Send later",
      today: T,
      defaultValue: F,
      onConfirm: () => new Promise(e => setTimeout(e, 900))
    })
  });
}
let I = C;
