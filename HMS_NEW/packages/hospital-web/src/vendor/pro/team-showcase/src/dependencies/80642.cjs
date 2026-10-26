// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  N: () => k
});
var n = require("react/jsx-runtime"),
  o = require("react"),
  s = require("./39551.cjs"),
  l = require("./28819.cjs"),
  i = require("./65239.cjs"),
  u = require("./15131.cjs"),
  a = require("./78757.cjs"),
  c = require("./24866.cjs");
function h(e, t) {
  if ("function" == typeof e) return e(t);
  null != e && (e.current = t);
}
class f extends o.Component {
  getSnapshotBeforeUpdate(e) {
    let t = this.props.childRef.current;
    if ((0, a.s)(t) && e.isPresent && !this.props.isPresent && !1 !== this.props.pop) {
      let e = t.offsetParent,
        r = (0, a.s)(e) && e.offsetWidth || 0,
        n = (0, a.s)(e) && e.offsetHeight || 0,
        o = getComputedStyle(t),
        s = this.props.sizeRef.current;
      s.height = parseFloat(o.height), s.width = parseFloat(o.width), s.top = t.offsetTop, s.left = t.offsetLeft, s.right = r - s.width - s.left, s.bottom = n - s.height - s.top, s.direction = o.direction;
    }
    return null;
  }
  componentDidUpdate() {}
  render() {
    return this.props.children;
  }
}
function p({
  children: e,
  isPresent: t,
  anchorX: r,
  anchorY: s,
  root: l,
  pop: i
}) {
  let u = (0, o.useId)(),
    a = (0, o.useRef)(null),
    d = (0, o.useRef)({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      direction: "ltr"
    }),
    {
      nonce: m
    } = (0, o.useContext)(c.Q),
    g = function (...e) {
      return o.useCallback(function (...e) {
        return t => {
          let r = !1,
            n = e.map(e => {
              let n = h(e, t);
              return r || "function" != typeof n || (r = !0), n;
            });
          if (r) return () => {
            for (let t = 0; t < n.length; t++) {
              let r = n[t];
              "function" == typeof r ? r() : h(e[t], null);
            }
          };
        };
      }(...e), e);
    }(a, !1 !== i ? e.props?.ref ?? e?.ref : void 0);
  return (0, o.useInsertionEffect)(() => {
    let {
      width: e,
      height: n,
      top: o,
      left: c,
      right: h,
      bottom: f,
      direction: p
    } = d.current;
    if (t || !1 === i || !a.current || !e || !n) return;
    let g = "rtl" === p,
      y = "left" === r ? g ? `right: ${h}` : `left: ${c}` : g ? `left: ${c}` : `right: ${h}`,
      x = "bottom" === s ? `bottom: ${f}` : `top: ${o}`;
    a.current.dataset.motionPopId = u;
    let k = document.createElement("style");
    m && (k.nonce = m);
    let v = l ?? document.head;
    return v.appendChild(k), k.sheet && k.sheet.insertRule(`
          [data-motion-pop-id="${u}"] {
            position: absolute !important;
            width: ${e}px !important;
            height: ${n}px !important;
            ${y}px !important;
            ${x}px !important;
          }
        `), () => {
      a.current?.removeAttribute("data-motion-pop-id"), v.contains(k) && v.removeChild(k);
    };
  }, [t]), (0, n.jsx)(f, {
    isPresent: t,
    childRef: a,
    sizeRef: d,
    pop: i,
    children: !1 === i ? e : o.cloneElement(e, {
      ref: g
    })
  });
}
let d = ({
  children: e,
  initial: t,
  isPresent: r,
  onExitComplete: s,
  custom: a,
  presenceAffectsLayout: c,
  mode: h,
  anchorX: f,
  anchorY: d,
  root: g
}) => {
  let y = (0, l.M)(m),
    x = (0, o.useId)(),
    k = (0, o.useRef)(r),
    v = (0, o.useRef)(s);
  (0, i.E)(() => {
    k.current = r, v.current = s;
  });
  let E = !0,
    R = (0, o.useMemo)(() => (E = !1, {
      id: x,
      initial: t,
      isPresent: r,
      custom: a,
      onExitComplete: e => {
        for (let t of (y.set(e, !0), y.values())) if (!t) return;
        s && s();
      },
      register: e => (y.set(e, !1), () => {
        y.delete(e), k.current || y.size || v.current?.();
      })
    }), [r, y, s]);
  return c && E && (R = {
    ...R
  }), (0, o.useMemo)(() => {
    y.forEach((e, t) => y.set(t, !1));
  }, [r]), o.useEffect(() => {
    r || y.size || !s || s();
  }, [r]), e = (0, n.jsx)(p, {
    pop: "popLayout" === h,
    isPresent: r,
    anchorX: f,
    anchorY: d,
    root: g,
    children: e
  }), (0, n.jsx)(u.t.Provider, {
    value: R,
    children: e
  });
};
function m() {
  return new Map();
}
var g = require("./79196.cjs");
let y = e => e.key || "";
function x(e) {
  let t = [];
  return o.Children.forEach(e, e => {
    (0, o.isValidElement)(e) && t.push(e);
  }), t;
}
let k = ({
  children: e,
  custom: t,
  initial: r = !0,
  onExitComplete: u,
  presenceAffectsLayout: a = !0,
  mode: c = "sync",
  propagate: h = !1,
  anchorX: f = "left",
  anchorY: p = "top",
  root: m
}) => {
  let [k, v] = (0, g.xQ)(h),
    E = (0, o.useMemo)(() => x(e), [e]),
    R = h && !k ? [] : E.map(y),
    w = (0, o.useRef)(!0),
    P = (0, o.useRef)(E),
    C = (0, l.M)(() => new Map()),
    M = (0, o.useRef)(new Set()),
    [$, b] = (0, o.useState)(E),
    [z, j] = (0, o.useState)(E);
  (0, i.E)(() => {
    !h || k || z.length || v?.();
  }, [k, h, z.length, v]), (0, i.E)(() => {
    w.current = !1, P.current = E;
    for (let e = 0; e < z.length; e++) {
      let t = y(z[e]);
      R.includes(t) ? (C.delete(t), M.current.delete(t)) : !0 !== C.get(t) && C.set(t, !1);
    }
  }, [z, R.length, R.join("-")]);
  let A = [];
  if (E !== $) {
    let e = [...E],
      t = 0;
    for (let r of z) {
      let n = R.indexOf(y(r));
      -1 === n ? (e.splice(t++, 0, r), A.push(r)) : t = n + A.length + 1;
    }
    return "wait" === c && A.length && (e = A), j(x(e)), b(E), null;
  }
  let {
    forceRender: S
  } = (0, o.useContext)(s.L);
  return (0, n.jsx)(n.Fragment, {
    children: z.map(e => {
      let o = y(e),
        s = (!h || !!k) && (E === z || R.includes(o));
      return (0, n.jsx)(d, {
        isPresent: s,
        initial: (!w.current || !!r) && void 0,
        custom: t,
        presenceAffectsLayout: a,
        mode: c,
        root: m,
        onExitComplete: s ? void 0 : () => {
          if (M.current.has(o) || !C.has(o)) return;
          M.current.add(o), C.set(o, !0);
          let e = !0;
          C.forEach(t => {
            t || (e = !1);
          }), e && (S?.(), j(P.current), h && v?.(), u && u());
        },
        anchorX: f,
        anchorY: p,
        children: e
      }, o);
    })
  });
};
