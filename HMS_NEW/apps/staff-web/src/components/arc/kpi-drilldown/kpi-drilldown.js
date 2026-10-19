// Port of the local reconstructed browser bundle, not original Arc TSX.
// Reference interaction engine retained; exact period counts and missing history are application bindings.
import * as r from "react/jsx-runtime";
import * as i from "react";
import { AnimatePresence, motion, useMotionValue, animate, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowUpRight, ArrowDownRight, X, GitCompareArrows } from "lucide-react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { motionTokens } from "../lib/motion-tokens";
import { periodDelta as H } from "./period-data";
import styles from "./kpi-drilldown.module.css";
let N = [{
    value: "7",
    label: "7 days"
  }, {
    value: "30",
    label: "30 days"
  }, {
    value: "90",
    label: "90 days"
  }],
  M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  T = motionTokens.spring.smooth,
  $ = {
    type: "spring",
    visualDuration: .5,
    bounce: 0
  },
  A = {
    duration: 0
  },
  L = {
    duration: motionTokens.duration.standard,
    ease: [...motionTokens.ease.standard]
  },
  P = {
    duration: .08,
    ease: [...motionTokens.ease.standard]
  };
function C(e, a) {
  return 1 === e.length ? Array(a).fill(e[0]) : Array.from({
    length: a
  }, (t, r) => {
    let i = r / (a - 1) * (e.length - 1),
      n = Math.floor(i),
      s = Math.min(e.length - 1, n + 1);
    return e[n] == null || e[s] == null ? null : e[n] + (e[s] - e[n]) * (i - n);
  });
}
function S(e, a) {
  if (e == null || !Number.isFinite(e)) return "—";
  let t = a.decimals ?? 0,
    r = e / (a.divisor ?? 1);
  return `${a.prefix ?? ""}${r.toLocaleString("en-US", {
    minimumFractionDigits: t,
    maximumFractionDigits: t
  })}${a.suffix ?? ""}`;
}
function R(e, a) {
  let t = new Date(`${e}T12:00:00Z`);
  return t.setUTCDate(t.getUTCDate() - a), `${M[t.getUTCMonth()]} ${t.getUTCDate()}`;
}
function E(e, a) {
  let t = e.getBoundingClientRect(),
    r = a.getBoundingClientRect();
  return {
    x: t.left - r.left,
    y: t.top - r.top,
    width: t.width,
    height: t.height
  };
}
// Gaps are unavailable history, never synthetic zeroes. Keep dates in their original positions.
function D(e, a, t, r, i, n = 0) {
  const scale = i - r || 1;
  return e.map((value, index) => value == null ? "" : `${index && e[index - 1] != null ? "L" : "M"}${(index / Math.max(1, e.length - 1) * a).toFixed(2)},${(n + (1 - (value - r) / scale) * t).toFixed(2)}`).join("");
}
function areaPath(line, values, width, bottom) {
  const first = values.findIndex(value => value != null);
  if (first < 0) return "";
  const last = values.findLastIndex(value => value != null);
  return `${line}L${last / Math.max(1, values.length - 1) * width},${bottom}L${first / Math.max(1, values.length - 1) * width},${bottom}Z`;
}
function extent(values, fn) {
  const present = values.filter(value => value != null);
  return present.length ? fn(...present) : 0;
}
function B(e) {
  let [a, t] = (0, i.useState)(0);
  return (0, i.useLayoutEffect)(() => {
    let a = e.current;
    if (!a || (t(a.offsetWidth), "u" < typeof ResizeObserver)) return;
    let r = new ResizeObserver(() => t(a.offsetWidth));
    return r.observe(a), () => r.disconnect();
  }, [e]), a;
}
function Y({
  id: e,
  children: a,
  reduce: t,
  className: i
}) {
  return (0, r.jsx)("span", {
    className: `${styles.swap} ${i ?? ""}`,
    children: (0, r.jsx)(AnimatePresence, {
      initial: !1,
      children: (0, r.jsx)(motion.span, {
        initial: {
          opacity: 0
        },
        animate: {
          opacity: 1,
          transition: t ? A : L
        },
        exit: {
          opacity: 0,
          transition: t ? A : P
        },
        children: a
      }, e)
    })
  });
}
function F({
  options: e,
  value: a,
  onChange: t,
  label: n,
  reduce: o
}) {
  let c = (0, i.useRef)(null),
    u = (0, useMotionValue)(0),
    p = (0, useMotionValue)(0),
    h = (0, useMotionValue)(0),
    m = (0, i.useRef)(!1);
  return (0, i.useLayoutEffect)(() => {
    let e = c.current?.querySelector('[aria-pressed="true"]');
    if (!e) return;
    if (!m.current || o) {
      u.jump(e.offsetLeft), p.jump(e.offsetWidth), h.jump(1), c.current?.setAttribute("data-ready", ""), m.current = !0;
      return;
    }
    let a = (0, animate)(u, e.offsetLeft, T),
      t = (0, animate)(p, e.offsetWidth, T);
    return () => {
      a.stop(), t.stop();
    };
  }, [o, h, a, p, u]), (0, i.useEffect)(() => {
    let e = c.current;
    if (!e || "u" < typeof ResizeObserver) return;
    let a = new ResizeObserver(() => {
      let a = e.querySelector('[aria-pressed="true"]');
      !a || u.isAnimating() || p.isAnimating() || (u.jump(a.offsetLeft), p.jump(a.offsetWidth));
    });
    return a.observe(e), () => a.disconnect();
  }, [p, u]), (0, r.jsx)("div", {
    className: styles.tabs,
    role: "group",
    "aria-label": n,
    children: (0, r.jsxs)("div", {
      ref: c,
      className: styles.tabTrack,
      children: [(0, r.jsx)(motion.span, {
        className: styles.indicator,
        style: {
          x: u,
          width: p,
          opacity: h
        },
        "aria-hidden": "true"
      }), e.map(e => (0, r.jsx)("button", {
        type: "button",
        className: styles.tab,
        "aria-pressed": e.value === a,
        onClick: () => t(e.value),
        children: e.label
      }, e.value))]
    })
  });
}
function O({
  kpi: e,
  value: a
}) {
  let {
    prefix: t = "",
    suffix: i = "",
    divisor: n = 1,
    decimals: s = 0
  } = e.format;
  return (0, r.jsx)(AnimatedCounter, {
    value: Number((a / n).toFixed(s)),
    prefix: t,
    suffix: i,
    decimals: s
  });
}
function z({
  delta: e,
  label: a,
  reduce: t
}) {
  if (!e.available) return (0, r.jsx)("span", { className: styles.delta, "data-flat": "", title: e.text, children: "—" });
  let i = e.flat ? ArrowRight : e.raw > 0 ? ArrowUpRight : ArrowDownRight,
    n = e.flat ? "flat" : e.raw > 0 ? "up" : "down";
  return (0, r.jsxs)("span", {
    className: styles.delta,
    "data-good": e.good && !e.flat ? "" : void 0,
    "data-flat": e.flat ? "" : void 0,
    children: [(0, r.jsx)(Y, {
      id: n,
      reduce: t,
      className: styles.deltaIcon,
      children: (0, r.jsx)(i, {
        size: 13,
        "aria-hidden": "true"
      })
    }), (0, r.jsx)(AnimatedCounter, {
      value: e.amount,
      decimals: 1,
      prefix: e.sign,
      suffix: e.unit
    }), a && (0, r.jsxs)("span", {
      className: styles.srOnly,
      children: [" ", a]
    })]
  });
}
function I({
  values: e,
  reduce: a
}) {
  let t = C(e, 40),
    i = extent(t, Math.min),
    n = extent(t, Math.max),
    l = D(t, 100, 28, i, n, 2);
  return (0, r.jsxs)("svg", {
    className: styles.spark,
    viewBox: "0 0 100 32",
    preserveAspectRatio: "none",
    "aria-hidden": "true",
    children: [(0, r.jsx)(motion.path, {
      d: areaPath(l, t, 100, 32),
      className: styles.sparkArea,
      initial: !1,
      animate: {
        d: areaPath(l, t, 100, 32)
      },
      transition: a ? A : T
    }), (0, r.jsx)(motion.path, {
      d: l,
      className: styles.sparkLine,
      initial: !1,
      animate: {
        d: l
      },
      transition: a ? A : T
    })]
  });
}
function W(e, a, t) {
  let r = (e, a) => e == null || a == null ? a : e + (a - e) * t;
  return {
    a: a.a.map((a, t) => r(e.a[t] ?? a, a)),
    b: a.b.map((a, t) => r(e.b[t] ?? a, a)),
    min: r(e.min, a.min),
    max: r(e.max, a.max),
    pad: r(e.pad, a.pad)
  };
}
function q({
  kpi: e,
  current: a,
  previous: t,
  compare: o,
  days: c,
  end: u,
  reduce: p
}) {
  let h = (0, i.useRef)(null),
    m = (0, i.useId)(),
    f = B(h),
    [_, y] = (0, i.useState)(null),
    g = Math.max(0, f - 56),
    b = (0, i.useMemo)(() => {
      let e, r, i, n, s, l;
      return e = C(a, 72), r = C(t, 72), n = extent((i = o ? [...e, ...r] : e), Math.min), l = ((s = extent(i, Math.max)) - n) * .12 || 1, {
        a: e,
        b: r,
        min: n - l,
        max: s + l,
        pad: l
      };
    }, [o, a, t]),
    v = (0, useMotionValue)(1),
    j = (0, i.useRef)({
      from: b,
      to: b,
      inner: 0,
      format: e.format
    }),
    k = (0, useMotionValue)(""),
    N = (0, useMotionValue)(""),
    M = (0, useMotionValue)(""),
    $ = (0, useMotionValue)(""),
    L = (0, useMotionValue)(""),
    P = (0, useMotionValue)(""),
    H = (0, i.useCallback)(() => {
      let {
          from: e,
          to: a,
          inner: t,
          format: r
        } = j.current,
        i = W(e, a, v.get()),
        n = D(i.a, t, 186, i.min, i.max, 10);
      k.set(n), N.set(areaPath(n, i.a, t, 196)), M.set(D(i.b, t, 186, i.min, i.max, 10)), $.set(S(i.max - i.pad, r)), L.set(S((i.max + i.min) / 2, r)), P.set(S(i.min + i.pad, r));
    }, [N, M, k, v, $, P, L]);
  (0, i.useLayoutEffect)(() => {
    j.current.inner = g, j.current.format = e.format, H();
  }, [g, e.format, H]), (0, i.useEffect)(() => v.on("change", H), [H, v]), (0, i.useLayoutEffect)(() => {
    let e = j.current;
    if (e.from = W(e.from, e.to, v.get()), e.to = b, p) {
      v.jump(1), H();
      return;
    }
    v.jump(0);
    let a = (0, animate)(v, 1, T);
    return () => a.stop();
  }, [H, v, p, b]);
  let E = e => 10 + (1 - (e - b.min) / (b.max - b.min)) * 186,
    Y = [b.pad, (b.max - b.min) / 2, b.max - b.min - b.pad].map(e => 10 + (1 - e / (b.max - b.min)) * 186),
    F = null === _ ? null : Math.round(_ / 71 * (c - 1));
  function O(e) {
    let a = e.currentTarget.getBoundingClientRect();
    y(Math.round(71 * Math.max(0, Math.min(1, (e.clientX - a.left) / Math.max(1, g)))));
  }
  let z = null === _ ? 0 : _ / 71 * g,
    I = `${e.label} over the last ${c} days, from ${S(a[0], e.format)} to ${S(a[a.length - 1], e.format)}.`,
    U = [0, Math.floor((c - 1) / 2), c - 1];
  return (0, r.jsxs)("div", {
    ref: h,
    className: styles.chart,
    role: "img",
    "aria-label": I,
    tabIndex: 0,
    onPointerMove: O,
    onPointerDown: O,
    onPointerLeave: () => y(null),
    onKeyDown: function (e) {
      let a = "ArrowRight" === e.key ? 1 : "ArrowLeft" === e.key ? -1 : 0;
      if ("Escape" === e.key && null !== _) {
        e.stopPropagation(), y(null);
        return;
      }
      if (!a) return;
      e.preventDefault();
      let t = 71 / Math.max(1, c - 1);
      y(e => Math.max(0, Math.min(71, Math.round((e ?? 71) + a * t))));
    },
    onBlur: () => y(null),
    children: [f > 0 && (0, r.jsxs)("svg", {
      width: f,
      height: 220,
      "aria-hidden": "true",
      children: [(0, r.jsx)("defs", {
        children: (0, r.jsx)("clipPath", {
          id: m,
          children: (0, r.jsx)("rect", {
            x: -2,
            y: 0,
            width: g + 4,
            height: 196
          })
        })
      }), [$, L, P].map((e, a) => (0, r.jsxs)("g", {
        children: [(0, r.jsx)("line", {
          x1: 0,
          x2: g,
          y1: Y[2 - a],
          y2: Y[2 - a],
          className: styles.gridLine
        }), (0, r.jsx)(motion.text, {
          x: g + 10,
          y: Y[2 - a] + 4,
          className: styles.axisText,
          children: e
        })]
      }, a)), (0, r.jsxs)("g", {
        clipPath: `url(#${m})`,
        children: [(0, r.jsx)(motion.path, {
          d: N,
          className: styles.chartArea
        }), (0, r.jsx)(motion.path, {
          d: M,
          className: styles.chartBefore,
          initial: !1,
          animate: {
            opacity: +!!o
          },
          transition: p ? A : {
            duration: motionTokens.duration.standard,
            ease: [...motionTokens.ease.standard]
          }
        }), (0, r.jsx)(motion.path, {
          d: k,
          className: styles.chartLine
        })]
      }), U.map((e, a) => (0, r.jsx)(G, {
        text: R(u, c - 1 - e),
        x: e / Math.max(1, c - 1) * g,
        anchor: 0 === a ? "start" : 2 === a ? "end" : "middle",
        reduce: p
      }, a)), null !== _ && (0, r.jsxs)("g", {
        className: styles.cursor,
        children: [(0, r.jsx)("line", {
          x1: z,
          x2: z,
          y1: 10,
          y2: 196
        }), o && b.b[_] != null && (0, r.jsx)("circle", {
          cx: z,
          cy: E(b.b[_]),
          r: 3,
          className: styles.cursorBefore
        }), b.a[_] != null && (0, r.jsx)("circle", {
          cx: z,
          cy: E(b.a[_]),
          r: 3.5
        })]
      })]
    }), (0, r.jsx)(AnimatePresence, {
      children: null !== _ && null !== F && (0, r.jsxs)(motion.div, {
        className: styles.tip,
        style: {
          left: Math.max(70, Math.min(g - 70, z))
        },
        initial: {
          opacity: 0
        },
        animate: {
          opacity: 1
        },
        exit: {
          opacity: 0
        },
        transition: {
          duration: p ? 0 : motionTokens.duration.instant
        },
        children: [(0, r.jsx)("span", {
          children: R(u, c - 1 - F)
        }), (0, r.jsx)("strong", {
          children: S(a[F], e.format)
        }), o && (0, r.jsxs)("small", {
          children: [S(t[F], e.format), " a period earlier"]
        })]
      })
    })]
  });
}
function G({
  text: e,
  x: a,
  anchor: t,
  reduce: i
}) {
  return (0, r.jsx)(AnimatePresence, {
    initial: !1,
    children: (0, r.jsx)(motion.text, {
      x: a,
      y: 214,
      className: styles.axisText,
      textAnchor: t,
      initial: {
        opacity: 0
      },
      animate: {
        opacity: 1
      },
      exit: {
        opacity: 0
      },
      transition: i ? A : {
        duration: motionTokens.duration.fast
      },
      children: e
    }, e)
  });
}
function U({
  kpi: e,
  value: a,
  dimension: t,
  dimensions: i,
  onDimension: n,
  reduce: l,
  days
}) {
  let d = e.periods[days].breakdowns[t] ?? [],
    o = i.find(e => e.value === t)?.label ?? "Segment",
    c = "rate" === e.kind ? "\xa0pts" : "%",
    {
      prefix: u = "",
      suffix: p = "",
      divisor: h = 1,
      decimals: m = 0
    } = e.format;
  return (0, r.jsxs)("section", {
    className: styles.breakdown,
    "aria-label": `${e.label} by ${o.toLowerCase()}`,
    children: [(0, r.jsxs)("div", {
      className: styles.breakdownHead,
      children: [(0, r.jsx)("h4", {
        children: "Breakdown"
      }), (0, r.jsx)(F, {
        options: i,
        value: t,
        onChange: n,
        label: "Break down by",
        reduce: l
      })]
    }), (0, r.jsxs)("table", {
      className: styles.table,
      children: [(0, r.jsx)("thead", {
        children: (0, r.jsxs)("tr", {
          children: [(0, r.jsx)("th", {
            scope: "col",
            className: styles.nameHead,
            children: (0, r.jsx)(Y, {
              id: o,
              reduce: l,
              children: o
            })
          }), (0, r.jsx)("th", {
            scope: "col",
            className: styles.shareHead,
            children: "rate" === e.kind ? "Accounts" : "Share"
          }), (0, r.jsx)("th", {
            scope: "col",
            className: `${styles.num} ${styles.valueHead}`,
            children: "Value"
          }), (0, r.jsx)("th", {
            scope: "col",
            className: `${styles.num} ${styles.changeHead}`,
            children: "Change"
          })]
        })
      }), (0, r.jsx)("tbody", {
        children: d.length ? d.map((t) => {
          let n = t.value,
            change = H(e, t.value, t.previous),
            d = change.raw,
            o = change.good,
            share = a > 0 ? t.value / a : 0;
          return (0, r.jsxs)("tr", {
            children: [(0, r.jsx)("th", {
              scope: "row",
              children: (0, r.jsx)(Y, {
                id: t.name,
                reduce: l,
                children: t.name
              })
            }), (0, r.jsxs)("td", {
              className: styles.share,
              children: [(0, r.jsx)("span", {
                className: styles.bar,
                children: (0, r.jsx)(motion.span, {
                  initial: !1,
                  animate: {
                    scaleX: share
                  },
                  transition: l ? A : T
                })
              }), (0, r.jsx)("span", {
                className: styles.percent,
                children: (0, r.jsx)(AnimatedCounter, {
                  value: Math.round(100 * share),
                  suffix: "%"
                })
              })]
            }), (0, r.jsx)("td", {
              className: styles.num,
              children: (0, r.jsx)(AnimatedCounter, {
                value: Number((n / h).toFixed(m)),
                prefix: u,
                suffix: p,
                decimals: m
              })
            }), (0, r.jsx)("td", {
              className: styles.num,
              children: (0, r.jsx)("span", {
                className: styles.rowDelta,
                "data-good": o ? "" : void 0,
                title: change.text,
                children: change.available ? (0, r.jsx)(AnimatedCounter, {
                  value: Math.abs(d),
                  decimals: 1,
                  prefix: d >= 0 ? "+" : "−",
                  suffix: c
                }) : "—"
              })
            })]
          }, t.id);
        }) : (0, r.jsx)("tr", { children: (0, r.jsx)("td", { colSpan: 4, children: "No recorded activity in these periods." }) })
      })]
    })]
  });
}
function J({
  kpi: e,
  origin: a,
  bounds: t,
  closing: n,
  onClosed: o,
  onClose: c,
  onMeasure: u,
  days: p,
  compare: m,
  end: f,
  dimension: _,
  dimensions: y,
  onDimension: g,
  reduce: b
}) {
  let v = (0, useMotionValue)(b ? 8 : a.x),
    j = (0, useMotionValue)(b ? 8 : a.y),
    k = (0, useMotionValue)(b ? t.width : a.width),
    N = (0, useMotionValue)(b ? t.height : a.height),
    M = (0, useMotionValue)(+!b),
    T = (0, useMotionValue)(0),
    L = (0, i.useRef)(null),
    P = (0, i.useRef)(null),
    C = (0, i.useId)(),
    R = (0, i.useMemo)(() => e.series.slice(-p), [p, e.series]),
    E = (0, i.useMemo)(() => e.series.slice(-(2 * p), -p), [p, e.series]),
    D = e.periods[p].current,
    B = e.periods[p].previous,
    F = H(e, D, B);
  return (0, i.useLayoutEffect)(() => {
    let e = P.current;
    if (!e || (u(e.offsetHeight + 2), "u" < typeof ResizeObserver)) return;
    let a = new ResizeObserver(() => u(e.offsetHeight + 2));
    return a.observe(e), () => a.disconnect();
  }, [u]), (0, i.useLayoutEffect)(() => {
    if (!n) {
      if (b) {
        v.jump(8), j.jump(8), k.jump(t.width), N.jump(t.height);
        return;
      }
      (0, animate)(v, 8, $), (0, animate)(j, 8, $), (0, animate)(k, t.width, $), (0, animate)(N, t.height, $);
    }
  }, [t.height, t.width, n, N, b, k, v, j]), (0, i.useEffect)(() => {
    n || ((0, animate)(M, 1, {
      duration: b ? motionTokens.duration.fast : 0
    }), (0, animate)(T, 1, {
      duration: b ? motionTokens.duration.fast : motionTokens.duration.considered,
      delay: .12 * !b,
      ease: [...motionTokens.ease.enter]
    }), L.current?.focus({
      preventScroll: !0
    }));
  }, [n, T, b, M]), (0, i.useEffect)(() => {
    if (!n) return;
    if (b) {
      let e = (0, animate)(M, 0, {
        duration: motionTokens.duration.fast
      });
      return e.then(o), () => e.stop();
    }
    let e = [(0, animate)(T, 0, {
        duration: motionTokens.duration.instant
      }), (0, animate)(v, n.x, $), (0, animate)(j, n.y, $), (0, animate)(k, n.width, $), (0, animate)(N, n.height, $)],
      a = !0;
    return Promise.all(e).then(() => {
      a && o();
    }), () => {
      a = !1, e.forEach(e => e.stop());
    };
  }, [n, T, N, o, b, M, k, v, j]), (0, r.jsx)(motion.div, {
    className: styles.panel,
    role: "region",
    "aria-labelledby": C,
    "data-closing": n ? "" : void 0,
    style: {
      x: v,
      y: j,
      width: k,
      height: N,
      opacity: M
    },
    onKeyDown: e => {
      "Escape" === e.key && (e.preventDefault(), c());
    },
    children: (0, r.jsxs)("div", {
      ref: P,
      className: styles.panelContent,
      style: {
        width: t.width - 2
      },
      children: [(0, r.jsxs)("div", {
        className: styles.panelHead,
        children: [(0, r.jsxs)("div", {
          className: styles.cardTop,
          children: [(0, r.jsx)("h3", {
            id: C,
            className: styles.label,
            children: e.label
          }), (0, r.jsx)("button", {
            ref: L,
            type: "button",
            className: styles.close,
            onClick: c,
            "aria-label": "Back to overview",
            children: (0, r.jsx)(X, {
              size: 16,
              "aria-hidden": "true"
            })
          })]
        }), (0, r.jsxs)("div", {
          className: styles.valueRow,
          children: [(0, r.jsx)("span", {
            className: styles.value,
            children: (0, r.jsx)(O, {
              kpi: e,
              value: D
            })
          }), (0, r.jsx)(z, {
            delta: F,
            label: `versus the previous ${p} days`,
            reduce: b
          }), (0, r.jsx)(motion.span, {
            className: styles.versus,
            style: {
              opacity: T
            },
            children: (0, r.jsxs)(Y, {
              id: `${p}`,
              reduce: b,
              children: ["vs ", S(B, e.format), " the ", p, " days before"]
            })
          })]
        })]
      }), (0, r.jsxs)(motion.div, {
        className: styles.panelBody,
        style: {
          opacity: T
        },
        children: [(0, r.jsx)("p", {
          className: styles.description,
          children: e.description
        }), (0, r.jsx)(q, {
          kpi: e,
          current: R,
          previous: E,
          compare: m,
          days: p,
          end: f,
          reduce: b
        }), (0, r.jsxs)("div", {
          className: styles.legend,
          "aria-hidden": "true",
          children: [(0, r.jsx)("span", {
            className: styles.legendNow,
            children: (0, r.jsxs)(Y, {
              id: `${p}`,
              reduce: b,
              children: ["Last ", p, " days"]
            })
          }), (0, r.jsx)(motion.span, {
            className: styles.legendBefore,
            initial: !1,
            animate: {
              opacity: +!!m
            },
            transition: b ? A : {
              duration: motionTokens.duration.standard
            },
            children: (0, r.jsxs)(Y, {
              id: `${p}`,
              reduce: b,
              children: ["Previous ", p, " days"]
            })
          })]
        }), (0, r.jsx)(U, {
          kpi: e,
          value: D,
          dimension: _,
          dimensions: y,
          onDimension: g,
          days: p,
          reduce: b
        })]
      })]
    })
  });
}
function K({
  kpis: e,
  dimensions: a,
  end: t,
  defaultRange: c = "30",
  selected: u,
  onSelectedChange: p,
  title: h = "Overview",
  className: f,
  range: rangeProp,
  onRangeChange
}) {
  let y = !!(0, useReducedMotion)(),
    [localRange, b] = (0, i.useState)(c),
    g = rangeProp ?? localRange,
    [v, k] = (0, i.useState)(!0),
    [M, T] = (0, i.useState)(a[0]?.value ?? "doctor"),
    [A, L] = (0, i.useState)(null),
    [P, C] = (0, i.useState)(null),
    [R, D] = (0, i.useState)(null),
    [Y, W] = (0, i.useState)(0),
    [q, G] = (0, i.useState)(0),
    U = (0, i.useRef)(null),
    Z = (0, i.useRef)(null),
    V = (0, i.useRef)(new Map()),
    X = B(U),
    Q = (0, useMotionValue)(0),
    ee = Number(g),
    ea = void 0 !== u ? u : A;
  (0, i.useLayoutEffect)(() => {
    let e = Z.current;
    if (!e) return;
    let a = () => W(e.offsetHeight + 2 * e.offsetTop);
    if (a(), "u" < typeof ResizeObserver) return;
    let t = new ResizeObserver(a);
    return t.observe(e), () => t.disconnect();
  }, []), (0, i.useLayoutEffect)(() => Q.on("change", e => {
    U.current && (U.current.style.minHeight = `${e}px`);
  }), [Q]);
  let et = P ? Math.max(Y, q + 16) : Y;
  function er(e) {
    void 0 === u && L(e), p?.(e);
  }
  (0, i.useLayoutEffect)(() => {
    if (!Y) return;
    let e = P && !R ? et : Y;
    if (y || 0 === Q.get()) return void Q.jump(P && !R ? e : Y);
    let a = (0, animate)(Q, e, $);
    return () => a.stop();
  }, [R, Q, Y, P, et, y]), (0, i.useEffect)(() => {
    let e = requestAnimationFrame(() => {
      let e = U.current;
      if (ea && P?.id === ea) {
        R && D(null);
        return;
      }
      if (ea) {
        let a = V.current.get(ea);
        a && e && (D(null), C({
          id: ea,
          origin: E(a, e)
        }));
      } else if (P && !R) {
        let a = V.current.get(P.id);
        a && e && D(E(a, e));
      }
    });
    return () => cancelAnimationFrame(e);
  }, [R, P, ea]);
  let ei = (0, i.useCallback)(() => {
      let e = P?.id;
      C(null), D(null), e && requestAnimationFrame(() => V.current.get(e)?.focus({
        preventScroll: !0
      }));
    }, [P?.id]),
    en = (0, i.useCallback)(e => G(e), []),
    es = e.find(e => e.id === P?.id) ?? null,
    el = (0, i.useMemo)(() => e.map(e => {
      let a = e.series.slice(-ee),
        r = e.periods[ee].current;
      return {
        kpi: e,
        current: a,
        value: r,
        delta: H(e, r, e.periods[ee].previous)
      };
    }), [ee, e]);
  return (0, r.jsxs)("div", {
    className: `${styles.root} ${f ?? ""}`,
    onKeyDown: e => {
      "Escape" === e.key && P && !R && (e.preventDefault(), er(null));
    },
    children: [(0, r.jsxs)("header", {
      className: styles.header,
      children: [(0, r.jsx)("h2", {
        children: h
      }), (0, r.jsxs)("div", {
        className: styles.controls,
        children: [(0, r.jsxs)("button", {
          type: "button",
          className: styles.compare,
          "aria-pressed": v,
          onClick: () => k(e => !e),
          children: [(0, r.jsx)(GitCompareArrows, {
            size: 14,
            "aria-hidden": "true"
          }), (0, r.jsx)("span", {
            children: "Compare"
          })]
        }), (0, r.jsx)(F, {
          options: N,
          value: g,
          onChange: e => { b(e); onRangeChange?.(e); },
          label: "Date range",
          reduce: y
        })]
      })]
    }), (0, r.jsxs)("div", {
      ref: U,
      className: styles.body,
      children: [(0, r.jsx)("ul", {
        ref: Z,
        className: styles.grid,
        "aria-hidden": !!P || void 0,
        children: el.map(({
          kpi: e,
          current: a,
          value: t,
          delta: i
        }) => (0, r.jsx)("li", {
          children: (0, r.jsxs)("button", {
            type: "button",
            ref: a => {
              a ? V.current.set(e.id, a) : V.current.delete(e.id);
            },
            className: styles.card,
            "data-hidden": P?.id === e.id ? "" : void 0,
            onClick: () => er(e.id),
            tabIndex: P ? -1 : void 0,
            "aria-label": `${e.label}, ${S(t, e.format)}, ${i.text} versus the previous ${ee} days. Open details`,
            children: [(0, r.jsx)("span", {
              className: styles.cardTop,
              children: (0, r.jsx)("span", {
                className: styles.label,
                children: e.label
              })
            }), (0, r.jsxs)("span", {
              className: styles.valueRow,
              children: [(0, r.jsx)("span", {
                className: styles.value,
                children: (0, r.jsx)(O, {
                  kpi: e,
                  value: t
                })
              }), (0, r.jsx)(z, {
                delta: i,
                reduce: y
              })]
            }), (0, r.jsx)(I, {
              values: a,
              reduce: y
            })]
          })
        }, e.id))
      }), (0, r.jsx)(AnimatePresence, {
        children: P && !R && (0, r.jsx)(motion.div, {
          className: styles.veil,
          initial: {
            opacity: 0
          },
          animate: {
            opacity: 1
          },
          exit: {
            opacity: 0
          },
          transition: {
            duration: y ? motionTokens.duration.instant : motionTokens.duration.standard
          },
          "aria-hidden": "true"
        }, "veil")
      }), P && es && X > 0 && (0, r.jsx)(J, {
        kpi: es,
        origin: P.origin,
        bounds: {
          width: X - 16,
          height: q || et - 16
        },
        closing: R,
        onClosed: ei,
        onClose: () => er(null),
        onMeasure: en,
        days: ee,
        compare: v,
        end: t,
        dimension: M,
        dimensions: a,
        onDimension: T,
        reduce: y
      })]
    })]
  });
}
export { K as KpiDrilldown };
export default K;
