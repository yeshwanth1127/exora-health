// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  CopyButton: () => A
});
var t = require("react/jsx-runtime"),
  s = require("react"),
  o = require("./25354.cjs"),
  n = require("./80642.cjs"),
  r = require("./18310.cjs"),
  l = require("./35484.cjs"),
  d = require("./99314.cjs"),
  c = require("./7770.cjs"),
  h = require("./55665.cjs"),
  m = require("./13858.cjs"),
  p = interop.n(m);
let g = {
    type: "spring",
    visualDuration: .5,
    bounce: .06
  },
  u = {
    duration: .36,
    ease: [...c.T.ease.enter]
  },
  y = {
    duration: .2,
    ease: [...c.T.ease.standard]
  },
  w = {
    duration: c.T.duration.instant
  },
  _ = `blur(${c.T.blur.soft}px)`,
  j = {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)"
  },
  f = {
    ...j,
    opacity: 0
  },
  x = {
    opacity: 0,
    transition: w
  },
  b = {
    opacity: 0,
    scale: .6,
    filter: _
  },
  v = {
    opacity: 0,
    scale: .6,
    filter: _,
    transition: {
      duration: .24,
      ease: [...c.T.ease.standard]
    }
  },
  N = {
    scale: g,
    opacity: {
      ...u,
      delay: .03
    },
    filter: {
      ...u,
      delay: .03
    }
  },
  k = {
    opacity: 0,
    y: 4,
    filter: _
  },
  C = {
    opacity: 0,
    y: -3,
    filter: _,
    transition: y
  };
function T({
  reduced: e
}) {
  return (0, t.jsx)("svg", {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    children: (0, t.jsx)(o.PY1.path, {
      d: "M4 12l5 5L20 6",
      initial: !e && {
        pathLength: 0,
        opacity: 0
      },
      animate: {
        pathLength: 1,
        opacity: 1
      },
      transition: {
        pathLength: {
          duration: .5,
          ease: [...c.T.ease.standard],
          delay: .05
        },
        opacity: {
          duration: .01,
          delay: .05
        }
      }
    })
  });
}
let P = (e, a) => e.map((e, i) => ({
  id: `${a}:${i}`,
  char: e,
  order: i
}));
function S({
  text: e,
  reduced: a
}) {
  let i = function (e) {
    let [a, i] = (0, s.useState)(() => ({
      text: e,
      seq: 0,
      glyphs: P([...e], 0)
    }));
    if (a.text === e) return a.glyphs;
    let t = [...a.text],
      o = [...e],
      n = 0,
      r = 0;
    for (; n < t.length && n < o.length && t[n] === o[n];) n++;
    for (; r < t.length - n && r < o.length - n && t[t.length - 1 - r] === o[o.length - 1 - r];) r++;
    n < 2 && (n = 0), r < 2 && (r = 0);
    let l = a.seq + 1,
      d = [...a.glyphs.slice(0, n), ...P(o.slice(n, o.length - r), l), ...a.glyphs.slice(a.glyphs.length - r)];
    return i({
      text: e,
      seq: l,
      glyphs: d
    }), d;
  }(e);
  return (0, t.jsx)(o.PY1.span, {
    className: p().glyphs,
    layoutRoot: !0,
    children: (0, t.jsx)(n.N, {
      mode: "popLayout",
      initial: !1,
      children: i.map(i => (0, t.jsx)(o.PY1.span, {
        className: p().glyph,
        layout: !a && "position",
        layoutDependency: e,
        initial: a ? f : k,
        animate: j,
        exit: a ? x : C,
        transition: a ? w : {
          ...u,
          delay: Math.min(.02 * i.order, .12),
          layout: g
        },
        children: i.char
      }, i.id))
    })
  });
}
function A({
  value: e,
  label: a = "Copy",
  className: i,
  iconOnly: s = !1,
  variant: c = "outline",
  disabled: m,
  onCopied: g
}) {
  let {
      state: u,
      copy: y
    } = (0, h.q)(),
    _ = (0, r.I)() ?? !1,
    k = "copied" === u ? "Copied" : "error" === u ? "Failed" : a;
  async function C() {
    (await y(e)) && g?.();
  }
  return (0, t.jsxs)(t.Fragment, {
    children: [(0, t.jsxs)("button", {
      type: "button",
      className: [p().button, s && p().iconOnly, "plain" === c && p().plain, i].filter(Boolean).join(" "),
      onClick: () => void C(),
      "aria-label": a,
      "data-copy-state": u,
      disabled: m,
      children: [(0, t.jsx)("span", {
        className: p().icon,
        "aria-hidden": "true",
        children: (0, t.jsx)(n.N, {
          initial: !1,
          children: (0, t.jsx)(o.PY1.span, {
            className: p().iconInner,
            "data-state": u,
            initial: _ ? f : b,
            animate: j,
            exit: _ ? x : v,
            transition: _ ? w : N,
            children: "copied" === u ? (0, t.jsx)(T, {
              reduced: _
            }) : "error" === u ? (0, t.jsx)(l.A, {
              size: 16,
              strokeWidth: 1.75
            }) : (0, t.jsx)(d.A, {
              size: 16,
              strokeWidth: 1.75
            })
          }, u)
        })
      }), !s && (0, t.jsxs)("span", {
        className: p().label,
        "aria-hidden": "true",
        children: [(0, t.jsx)("span", {
          className: p().measure,
          children: a
        }), (0, t.jsx)("span", {
          className: p().measure,
          children: "Copied"
        }), (0, t.jsx)("span", {
          className: p().measure,
          children: "Failed"
        }), (0, t.jsx)(S, {
          text: k,
          reduced: _
        })]
      })]
    }), (0, t.jsx)("span", {
      className: p().srOnly,
      role: "status",
      "aria-live": "polite",
      children: "idle" === u ? "" : "error" === u ? `${a}: Could not copy` : `${a}: Copied`
    })]
  });
}
