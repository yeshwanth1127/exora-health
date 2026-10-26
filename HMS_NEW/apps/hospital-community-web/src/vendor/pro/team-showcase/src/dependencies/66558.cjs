// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  A: () => u
});
var i = require("react/jsx-runtime"),
  n = require("react"),
  r = require("./18310.cjs"),
  s = require("./57700.cjs"),
  o = require("./25354.cjs"),
  l = require("./7770.cjs"),
  c = require("./42686.cjs"),
  d = interop.n(c);
function u({
  options: e,
  value: a,
  onValueChange: t,
  label: c,
  onOptionIntent: p,
  className: h
}) {
  let m = (0, n.useId)(),
    g = (0, r.I)(),
    _ = (0, n.useRef)(null);
  (0, n.useLayoutEffect)(() => {
    let e = _.current;
    if (!e) return;
    let a = () => {
      let a = e.scrollWidth - e.clientWidth - e.scrollLeft;
      e.toggleAttribute("data-fade-start", e.scrollLeft > 1), e.toggleAttribute("data-fade-end", a > 1);
    };
    a(), e.addEventListener("scroll", a, {
      passive: !0
    });
    let t = "u" < typeof ResizeObserver ? null : new ResizeObserver(a);
    return t?.observe(e), () => {
      e.removeEventListener("scroll", a), t?.disconnect();
    };
  }, [e.length]);
  let A = (0, n.useRef)(!0);
  (0, n.useEffect)(() => {
    let e = _.current,
      a = e?.querySelector('[aria-pressed="true"]');
    if (!e || !a || e.scrollWidth <= e.clientWidth) {
      A.current = !1;
      return;
    }
    let t = a.offsetLeft - 20,
      i = a.offsetLeft + a.offsetWidth + 20 - e.clientWidth,
      n = e.scrollLeft > t ? t : e.scrollLeft < i ? i : e.scrollLeft;
    n !== e.scrollLeft && e.scrollTo({
      left: Math.max(0, n),
      behavior: A.current || g ? "auto" : "smooth"
    }), A.current = !1;
  }, [a, g]);
  let f = Math.max(0, e.findIndex(e => e.value === a)),
    b = a => {
      let i = e.length - 1,
        n = "ArrowRight" === a.key || "ArrowDown" === a.key ? f === i ? 0 : f + 1 : "ArrowLeft" === a.key || "ArrowUp" === a.key ? 0 === f ? i : f - 1 : "Home" === a.key ? 0 : "End" === a.key ? i : -1;
      !(n < 0) && e[n] && (a.preventDefault(), t(e[n].value), _.current?.querySelector(`[data-value="${CSS.escape(e[n].value)}"]`)?.focus({
        preventScroll: !0
      }));
    };
  return (0, i.jsx)("div", {
    className: `${d().root} ${h ?? ""}`,
    role: "group",
    "aria-label": c,
    children: (0, i.jsx)(s.o, {
      id: m,
      children: (0, i.jsx)(o.PY1.div, {
        ref: _,
        layoutScroll: !0,
        className: d().track,
        children: e.map((e, n) => (0, i.jsxs)("button", {
          id: `${m}-${e.value}`,
          className: d().button,
          type: "button",
          "data-value": e.value,
          "aria-pressed": a === e.value,
          tabIndex: n === f ? 0 : -1,
          onClick: () => t(e.value),
          onKeyDown: b,
          onPointerEnter: p ? () => p(e.value) : void 0,
          onFocus: p ? () => p(e.value) : void 0,
          children: [a === e.value && (0, i.jsx)(o.PY1.span, {
            className: d().selection,
            layoutId: "selection",
            layoutDependency: a,
            transition: g ? {
              duration: 0
            } : l.T.spring.morph,
            "aria-hidden": "true"
          }), (0, i.jsxs)("span", {
            className: d().label,
            children: [e.label, e.accessory]
          })]
        }, e.value))
      })
    })
  });
}
