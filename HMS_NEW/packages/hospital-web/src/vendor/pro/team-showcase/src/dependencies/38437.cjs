// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
Object.defineProperty(exports, "__esModule", {
  value: !0
}), Object.defineProperty(exports, "Image", {
  enumerable: !0,
  get: function () {
    return w;
  }
});
let i = require("./73623.cjs"),
  n = require("./66388.cjs"),
  a = require("react/jsx-runtime"),
  o = n._(require("react")),
  l = i._(require("./47650.cjs")),
  s = i._(require("./46686.cjs")),
  u = require("./95413.cjs"),
  d = require("./55762.cjs"),
  c = require("./17150.cjs"),
  f = require("./60751.cjs"),
  p = i._(require("./36095.cjs")),
  g = require("./21172.cjs"),
  m = {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    qualities: [75],
    path: "",
    loader: "default",
    dangerouslyAllowSVG: !1,
    unoptimized: !0
  };
function h(e, t, r, i, n, a, o) {
  let l = e?.src;
  e && e["data-loaded-src"] !== l && (e["data-loaded-src"] = l, ("decode" in e ? e.decode() : Promise.resolve()).catch(() => {}).then(() => {
    if (e.parentElement && e.isConnected) {
      if ("empty" !== t && n(!0), r?.current) {
        let t = new Event("load");
        Object.defineProperty(t, "target", {
          writable: !1,
          value: e
        });
        let i = !1,
          n = !1;
        r.current({
          ...t,
          nativeEvent: t,
          currentTarget: e,
          target: e,
          isDefaultPrevented: () => i,
          isPropagationStopped: () => n,
          persist: () => {},
          preventDefault: () => {
            i = !0, t.preventDefault();
          },
          stopPropagation: () => {
            n = !0, t.stopPropagation();
          }
        });
      }
      i?.current && i.current(e);
    }
  }));
}
function b(e) {
  return o.use ? {
    fetchPriority: e
  } : {
    fetchpriority: e
  };
}
let y = o.useLayoutEffect,
  _ = (0, o.forwardRef)(({
    src: e,
    srcSet: t,
    sizes: r,
    height: i,
    width: n,
    decoding: l,
    className: s,
    style: u,
    fetchPriority: d,
    placeholder: c,
    loading: f,
    unoptimized: p,
    fill: m,
    onLoadRef: _,
    onLoadingCompleteRef: v,
    setBlurComplete: w,
    setShowAltText: j,
    sizesInput: x,
    onLoad: P,
    onError: S,
    ...O
  }, C) => {
    let E = (0, o.useRef)(!1),
      R = (0, o.useRef)(null);
    y(() => {
      let {
          current: e
        } = E,
        {
          current: t
        } = R;
      e || null === t || (S && (t.src = t.src), t.complete && h(t, c, _, v, w, p, x), E.current = !0);
    }, [e, c, _, v, S, p, x]);
    let z = (0, g.useMergedRef)(C, R);
    return (0, a.jsx)("img", {
      ...O,
      ...b(d),
      loading: f,
      width: n,
      height: i,
      decoding: l,
      "data-nimg": m ? "fill" : "1",
      className: s,
      style: u,
      sizes: r,
      srcSet: t,
      src: e,
      ref: z,
      onLoad: e => {
        h(e.currentTarget, c, _, v, w, p, x);
      },
      onError: e => {
        j(!0), "empty" !== c && w(!0), S && S(e);
      }
    });
  });
function v({
  isAppRouter: e,
  imgAttributes: t
}) {
  let r = {
    as: "image",
    imageSrcSet: t.srcSet,
    imageSizes: t.sizes,
    crossOrigin: t.crossOrigin,
    referrerPolicy: t.referrerPolicy,
    ...b(t.fetchPriority)
  };
  return e && l.default.preload ? (l.default.preload(t.src, r), null) : (0, a.jsx)(s.default, {
    children: (0, a.jsx)("link", {
      rel: "preload",
      href: t.srcSet ? void 0 : t.src,
      ...r
    }, "__nimg-" + t.src + t.srcSet + t.sizes)
  });
}
let w = (0, o.forwardRef)((e, t) => {
  let r = (0, o.useContext)(f.RouterContext),
    i = (0, o.useContext)(c.ImageConfigContext),
    n = (0, o.useMemo)(() => {
      let e = m || i || d.imageConfigDefault,
        t = [...e.deviceSizes, ...e.imageSizes].sort((e, t) => e - t),
        r = e.deviceSizes.sort((e, t) => e - t),
        n = e.qualities?.sort((e, t) => e - t);
      return {
        ...e,
        allSizes: t,
        deviceSizes: r,
        qualities: n,
        localPatterns: e.localPatterns
      };
    }, [i]),
    {
      onLoad: l,
      onLoadingComplete: s
    } = e,
    g = (0, o.useRef)(l);
  (0, o.useEffect)(() => {
    g.current = l;
  }, [l]);
  let h = (0, o.useRef)(s);
  (0, o.useEffect)(() => {
    h.current = s;
  }, [s]);
  let [b, y] = (0, o.useState)(!1),
    [w, j] = (0, o.useState)(!1),
    {
      props: x,
      meta: P
    } = (0, u.getImgProps)(e, {
      defaultLoader: p.default,
      imgConf: n,
      blurComplete: b,
      showAltText: w
    });
  return (0, a.jsxs)(a.Fragment, {
    children: [(0, a.jsx)(_, {
      ...x,
      unoptimized: P.unoptimized,
      placeholder: P.placeholder,
      fill: P.fill,
      onLoadRef: g,
      onLoadingCompleteRef: h,
      setBlurComplete: y,
      setShowAltText: j,
      sizesInput: e.sizes,
      ref: t
    }), P.preload ? (0, a.jsx)(v, {
      isAppRouter: !r,
      imgAttributes: x
    }) : null]
  });
});
("function" == typeof exports.default || "object" == typeof exports.default && null !== exports.default) && void 0 === exports.default.__esModule && (Object.defineProperty(exports.default, "__esModule", {
  value: !0
}), Object.assign(exports.default, exports), module.exports = exports.default);
