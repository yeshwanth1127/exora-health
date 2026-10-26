// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
Object.defineProperty(exports, "__esModule", {
  value: !0
}), Object.defineProperty(exports, "getImgProps", {
  enumerable: !0,
  get: function () {
    return u;
  }
});
let i = require("./53887.cjs"),
  n = require("./12590.cjs"),
  a = require("./55762.cjs"),
  o = ["-moz-initial", "fill", "none", "scale-down", void 0];
function l(e) {
  return void 0 !== e.default;
}
function s(e) {
  return void 0 === e ? e : "number" == typeof e ? Number.isFinite(e) ? e : NaN : "string" == typeof e && /^[0-9]+$/.test(e) ? parseInt(e, 10) : NaN;
}
function u({
  src: e,
  sizes: t,
  unoptimized: r = !1,
  priority: d = !1,
  preload: c = !1,
  loading: f,
  className: p,
  quality: g,
  width: m,
  height: h,
  fill: b = !1,
  style: y,
  overrideSrc: _,
  onLoad: v,
  onLoadingComplete: w,
  placeholder: j = "empty",
  blurDataURL: x,
  fetchPriority: P,
  decoding: S = "async",
  layout: O,
  objectFit: C,
  objectPosition: E,
  lazyBoundary: R,
  lazyRoot: z,
  ...M
}, I) {
  var $;
  let k,
    D,
    A,
    {
      imgConf: N,
      showAltText: L,
      blurComplete: T,
      defaultLoader: U
    } = I,
    q = N || a.imageConfigDefault;
  if ("allSizes" in q) k = q;else {
    let e = [...q.deviceSizes, ...q.imageSizes].sort((e, t) => e - t),
      t = q.deviceSizes.sort((e, t) => e - t),
      r = q.qualities?.sort((e, t) => e - t);
    k = {
      ...q,
      allSizes: e,
      deviceSizes: t,
      qualities: r
    };
  }
  if (void 0 === U) throw Object.defineProperty(Error("images.loaderFile detected but the file is missing default export.\nRead more: https://nextjs.org/docs/messages/invalid-images-config"), "__NEXT_ERROR_CODE", {
    value: "E163",
    enumerable: !1,
    configurable: !0
  });
  let F = M.loader || U;
  delete M.loader, delete M.srcSet;
  let W = "__next_img_default" in F;
  if (W) {
    if ("custom" === k.loader) throw Object.defineProperty(Error(`Image with src "${e}" is missing "loader" prop.
Read more: https://nextjs.org/docs/messages/next-image-missing-loader`), "__NEXT_ERROR_CODE", {
      value: "E252",
      enumerable: !1,
      configurable: !0
    });
  } else {
    let e = F;
    F = t => {
      let {
        config: r,
        ...i
      } = t;
      return e(i);
    };
  }
  if (O) {
    "fill" === O && (b = !0);
    let e = {
      intrinsic: {
        maxWidth: "100%",
        height: "auto"
      },
      responsive: {
        width: "100%",
        height: "auto"
      }
    }[O];
    e && (y = {
      ...y,
      ...e
    });
    let r = {
      responsive: "100vw",
      fill: "100vw"
    }[O];
    r && !t && (t = r);
  }
  let B = "",
    G = s(m),
    H = s(h);
  if (($ = e) && "object" == typeof $ && (l($) || void 0 !== $.src)) {
    let t = l(e) ? e.default : e;
    if (!t.src) throw Object.defineProperty(Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include src. Received ${JSON.stringify(t)}`), "__NEXT_ERROR_CODE", {
      value: "E460",
      enumerable: !1,
      configurable: !0
    });
    if (!t.height || !t.width) throw Object.defineProperty(Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include height and width. Received ${JSON.stringify(t)}`), "__NEXT_ERROR_CODE", {
      value: "E48",
      enumerable: !1,
      configurable: !0
    });
    if (D = t.blurWidth, A = t.blurHeight, x = x || t.blurDataURL, B = t.src, !b) if (G || H) {
      if (G && !H) {
        let e = G / t.width;
        H = Math.round(t.height * e);
      } else if (!G && H) {
        let e = H / t.height;
        G = Math.round(t.width * e);
      }
    } else G = t.width, H = t.height;
  }
  let X = !d && !c && ("lazy" === f || void 0 === f);
  (!(e = "string" == typeof e ? e : B) || e.startsWith("data:") || e.startsWith("blob:")) && (r = !0, X = !1), k.unoptimized && (r = !0), W && !k.dangerouslyAllowSVG && e.split("?", 1)[0].endsWith(".svg") && (r = !0);
  let V = s(g),
    J = Object.assign(b ? {
      position: "absolute",
      height: "100%",
      width: "100%",
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      objectFit: C,
      objectPosition: E
    } : {}, L ? {} : {
      color: "transparent"
    }, y),
    Q = T || "empty" === j ? null : "blur" === j ? `url("data:image/svg+xml;charset=utf-8,${(0, n.getImageBlurSvg)({
      widthInt: G,
      heightInt: H,
      blurWidth: D,
      blurHeight: A,
      blurDataURL: x || "",
      objectFit: J.objectFit
    })}")` : `url("${j}")`,
    Y = o.includes(J.objectFit) ? "fill" === J.objectFit ? "100% 100%" : "cover" : J.objectFit,
    K = Q ? {
      backgroundSize: Y,
      backgroundPosition: J.objectPosition || "50% 50%",
      backgroundRepeat: "no-repeat",
      backgroundImage: Q
    } : {},
    Z = function ({
      config: e,
      src: t,
      unoptimized: r,
      width: n,
      quality: a,
      sizes: o,
      loader: l
    }) {
      if (r) {
        if (t.startsWith("/") && !t.startsWith("//")) {
          let e = (0, i.getDeploymentId)();
          if (t.includes("/_next/static/immutable") && !(0, i.getAssetToken)()) e = void 0;else if (e) {
            let r = t.indexOf("?");
            if (-1 !== r) {
              let i = new URLSearchParams(t.slice(r + 1));
              i.get("dpl") || (i.append("dpl", e), t = t.slice(0, r) + "?" + i.toString());
            } else t += `?dpl=${e}`;
          }
        }
        return {
          src: t,
          srcSet: void 0,
          sizes: void 0
        };
      }
      let {
          widths: s,
          kind: u
        } = function ({
          deviceSizes: e,
          allSizes: t
        }, r, i) {
          if (i) {
            let r = /(^|\s)(1?\d?\d)vw/g,
              n = [];
            for (let e; e = r.exec(i);) n.push(parseInt(e[2]));
            if (n.length) {
              let r = .01 * Math.min(...n);
              return {
                widths: t.filter(t => t >= e[0] * r),
                kind: "w"
              };
            }
            return {
              widths: t,
              kind: "w"
            };
          }
          return "number" != typeof r ? {
            widths: e,
            kind: "w"
          } : {
            widths: [...new Set([r, 2 * r].map(e => t.find(t => t >= e) || t[t.length - 1]))],
            kind: "x"
          };
        }(e, n, o),
        d = s.length - 1;
      return {
        sizes: o || "w" !== u ? o : "100vw",
        srcSet: s.map((r, i) => `${l({
          config: e,
          src: t,
          quality: a,
          width: r
        })} ${"w" === u ? r : i + 1}${u}`).join(", "),
        src: l({
          config: e,
          src: t,
          quality: a,
          width: s[d]
        })
      };
    }({
      config: k,
      src: e,
      unoptimized: r,
      width: G,
      quality: V,
      sizes: t,
      loader: F
    }),
    ee = X ? "lazy" : f;
  return {
    props: {
      ...M,
      loading: ee,
      fetchPriority: P,
      width: G,
      height: H,
      decoding: S,
      className: p,
      style: {
        ...J,
        ...K
      },
      sizes: Z.sizes,
      srcSet: Z.srcSet,
      src: _ || Z.src
    },
    meta: {
      unoptimized: r,
      preload: c || d,
      placeholder: j,
      fill: b
    }
  };
}
