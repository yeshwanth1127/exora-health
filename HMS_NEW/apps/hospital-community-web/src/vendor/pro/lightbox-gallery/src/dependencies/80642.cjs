// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  N: () => j
});
var r = require("react/jsx-runtime"),
  o = require("react"),
  l = require("./39551.cjs"),
  u = require("./28819.cjs"),
  i = require("./65239.cjs"),
  a = require("./15131.cjs"),
  s = require("./78757.cjs"),
  c = require("./24866.cjs");
function d(e, t) {
  if ("function" == typeof e) return e(t);
  null != e && (e.current = t);
}
class f extends o.Component {
  getSnapshotBeforeUpdate(e) {
    let t = this.props.childRef.current;
    if ((0, s.s)(t) && e.isPresent && !this.props.isPresent && !1 !== this.props.pop) {
      let e = t.offsetParent,
        n = (0, s.s)(e) && e.offsetWidth || 0,
        r = (0, s.s)(e) && e.offsetHeight || 0,
        o = getComputedStyle(t),
        l = this.props.sizeRef.current;
      l.height = parseFloat(o.height), l.width = parseFloat(o.width), l.top = t.offsetTop, l.left = t.offsetLeft, l.right = n - l.width - l.left, l.bottom = r - l.height - l.top, l.direction = o.direction;
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
  anchorX: n,
  anchorY: l,
  root: u,
  pop: i
}) {
  let a = (0, o.useId)(),
    s = (0, o.useRef)(null),
    h = (0, o.useRef)({
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
    y = function (...e) {
      return o.useCallback(function (...e) {
        return t => {
          let n = !1,
            r = e.map(e => {
              let r = d(e, t);
              return n || "function" != typeof r || (n = !0), r;
            });
          if (n) return () => {
            for (let t = 0; t < r.length; t++) {
              let n = r[t];
              "function" == typeof n ? n() : d(e[t], null);
            }
          };
        };
      }(...e), e);
    }(s, !1 !== i ? e.props?.ref ?? e?.ref : void 0);
  return (0, o.useInsertionEffect)(() => {
    let {
      width: e,
      height: r,
      top: o,
      left: c,
      right: d,
      bottom: f,
      direction: p
    } = h.current;
    if (t || !1 === i || !s.current || !e || !r) return;
    let y = "rtl" === p,
      g = "left" === n ? y ? `right: ${d}` : `left: ${c}` : y ? `left: ${c}` : `right: ${d}`,
      b = "bottom" === l ? `bottom: ${f}` : `top: ${o}`;
    s.current.dataset.motionPopId = a;
    let j = document.createElement("style");
    m && (j.nonce = m);
    let v = u ?? document.head;
    return v.appendChild(j), j.sheet && j.sheet.insertRule(`
          [data-motion-pop-id="${a}"] {
            position: absolute !important;
            width: ${e}px !important;
            height: ${r}px !important;
            ${g}px !important;
            ${b}px !important;
          }
        `), () => {
      s.current?.removeAttribute("data-motion-pop-id"), v.contains(j) && v.removeChild(j);
    };
  }, [t]), (0, r.jsx)(f, {
    isPresent: t,
    childRef: s,
    sizeRef: h,
    pop: i,
    children: !1 === i ? e : o.cloneElement(e, {
      ref: y
    })
  });
}
let h = ({
  children: e,
  initial: t,
  isPresent: n,
  onExitComplete: l,
  custom: s,
  presenceAffectsLayout: c,
  mode: d,
  anchorX: f,
  anchorY: h,
  root: y
}) => {
  let g = (0, u.M)(m),
    b = (0, o.useId)(),
    j = (0, o.useRef)(n),
    v = (0, o.useRef)(l);
  (0, i.E)(() => {
    j.current = n, v.current = l;
  });
  let x = !0,
    _ = (0, o.useMemo)(() => (x = !1, {
      id: b,
      initial: t,
      isPresent: n,
      custom: s,
      onExitComplete: e => {
        for (let t of (g.set(e, !0), g.values())) if (!t) return;
        l && l();
      },
      register: e => (g.set(e, !1), () => {
        g.delete(e), j.current || g.size || v.current?.();
      })
    }), [n, g, l]);
  return c && x && (_ = {
    ..._
  }), (0, o.useMemo)(() => {
    g.forEach((e, t) => g.set(t, !1));
  }, [n]), o.useEffect(() => {
    n || g.size || !l || l();
  }, [n]), e = (0, r.jsx)(p, {
    pop: "popLayout" === d,
    isPresent: n,
    anchorX: f,
    anchorY: h,
    root: y,
    children: e
  }), (0, r.jsx)(a.t.Provider, {
    value: _,
    children: e
  });
};
function m() {
  return new Map();
}
var y = require("./79196.cjs");
let g = e => e.key || "";
function b(e) {
  let t = [];
  return o.Children.forEach(e, e => {
    (0, o.isValidElement)(e) && t.push(e);
  }), t;
}
let j = ({
  children: e,
  custom: t,
  initial: n = !0,
  onExitComplete: a,
  presenceAffectsLayout: s = !0,
  mode: c = "sync",
  propagate: d = !1,
  anchorX: f = "left",
  anchorY: p = "top",
  root: m
}) => {
  let [j, v] = (0, y.xQ)(d),
    x = (0, o.useMemo)(() => b(e), [e]),
    _ = d && !j ? [] : x.map(g),
    P = (0, o.useRef)(!0),
    k = (0, o.useRef)(x),
    w = (0, u.M)(() => new Map()),
    M = (0, o.useRef)(new Set()),
    [E, O] = (0, o.useState)(x),
    [S, C] = (0, o.useState)(x);
  (0, i.E)(() => {
    !d || j || S.length || v?.();
  }, [j, d, S.length, v]), (0, i.E)(() => {
    P.current = !1, k.current = x;
    for (let e = 0; e < S.length; e++) {
      let t = g(S[e]);
      _.includes(t) ? (w.delete(t), M.current.delete(t)) : !0 !== w.get(t) && w.set(t, !1);
    }
  }, [S, _.length, _.join("-")]);
  let R = [];
  if (x !== E) {
    let e = [...x],
      t = 0;
    for (let n of S) {
      let r = _.indexOf(g(n));
      -1 === r ? (e.splice(t++, 0, n), R.push(n)) : t = r + R.length + 1;
    }
    return "wait" === c && R.length && (e = R), C(b(e)), O(x), null;
  }
  let {
    forceRender: A
  } = (0, o.useContext)(l.L);
  return (0, r.jsx)(r.Fragment, {
    children: S.map(e => {
      let o = g(e),
        l = (!d || !!j) && (x === S || _.includes(o));
      return (0, r.jsx)(h, {
        isPresent: l,
        initial: (!P.current || !!n) && void 0,
        custom: t,
        presenceAffectsLayout: s,
        mode: c,
        root: m,
        onExitComplete: l ? void 0 : () => {
          if (M.current.has(o) || !w.has(o)) return;
          M.current.add(o), w.set(o, !0);
          let e = !0;
          w.forEach(t => {
            t || (e = !1);
          }), e && (A?.(), C(k.current), d && v?.(), a && a());
        },
        anchorX: f,
        anchorY: p,
        children: e
      }, o);
    })
  });
};
