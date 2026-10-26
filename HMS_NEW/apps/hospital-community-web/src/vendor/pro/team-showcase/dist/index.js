import __arcMedia0 from "./media/people/andre-williams.jpg";
import __arcMedia1 from "./media/people/ava-mitchell.jpg";
import __arcMedia2 from "./media/people/chloe-nguyen.jpg";
import __arcMedia3 from "./media/people/daniel-kim.jpg";
import __arcMedia4 from "./media/people/diane-foster.jpg";
import __arcMedia5 from "./media/people/emma-collins.jpg";
import __arcMedia6 from "./media/people/hannah-walsh.jpg";
import __arcMedia7 from "./media/people/jasmine-brooks.jpg";
import __arcMedia8 from "./media/people/jordan-reyes.jpg";
import __arcMedia9 from "./media/people/marcus-johnson.jpg";
import __arcMedia10 from "./media/people/mateo-alvarez.jpg";
import __arcMedia11 from "./media/people/nathan-cole.jpg";
import __arcMedia12 from "./media/people/olivia-bennett.jpg";
import __arcMedia13 from "./media/people/portrait/emma-collins.jpg";
import __arcMedia14 from "./media/people/portrait/marcus-johnson.jpg";
import __arcMedia15 from "./media/people/portrait/sofia-ramirez.jpg";
import __arcMedia16 from "./media/people/ryan-sullivan.jpg";
import __arcMedia17 from "./media/people/sofia-ramirez.jpg";
import __arcMedia18 from "./media/people/tyler-hayes.jpg";
import __arcMedia19 from "./media/photos/alpine-lake.jpg";
import __arcMedia20 from "./media/photos/bedroom.jpg";
import __arcMedia21 from "./media/photos/ceramic-lamp.jpg";
import __arcMedia22 from "./media/photos/chef-plating.jpg";
import __arcMedia23 from "./media/photos/coastline.jpg";
import __arcMedia24 from "./media/photos/concert-hall.jpg";
import __arcMedia25 from "./media/photos/curved-facade.jpg";
import __arcMedia26 from "./media/photos/glass-carafe.jpg";
import __arcMedia27 from "./media/photos/home-office.jpg";
import __arcMedia28 from "./media/photos/linen-throw.jpg";
import __arcMedia29 from "./media/photos/lisbon-bridge.jpg";
import __arcMedia30 from "./media/photos/lisbon-rooftops.jpg";
import __arcMedia31 from "./media/photos/lisbon-tram.jpg";
import __arcMedia32 from "./media/photos/living-room.jpg";
import __arcMedia33 from "./media/photos/lounge-chair.jpg";
import __arcMedia34 from "./media/photos/mountain-ridges.jpg";
import __arcMedia35 from "./media/photos/pool-house.jpg";
import __arcMedia36 from "./media/photos/reading-chair.jpg";
import __arcMedia37 from "./media/photos/restaurant.jpg";
import __arcMedia38 from "./media/photos/salmon-dinner.jpg";
import __arcMedia39 from "./media/photos/sea-at-dusk.jpg";
import __arcMedia40 from "./media/photos/stacked-bowls.jpg";
import __arcMedia41 from "./media/photos/stoneware-cups.jpg";
import __arcMedia42 from "./media/photos/sunroom.jpg";
import __arcMedia43 from "./media/photos/table-lamp.jpg";
import __arcMedia44 from "./media/photos/terracotta-waves.jpg";
import __arcMedia45 from "./media/photos/wine-bar.jpg";
import * as HostReact from 'react';
import * as HostJSX from 'react/jsx-runtime';
const module = {exports:{}};
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/interop.cjs
var require_interop = __commonJS({
  "src/interop.cjs"(exports) {
    "use strict";
    exports.d = (target, definitions) => {
      for (const key of Object.keys(definitions)) {
        if (!Object.prototype.hasOwnProperty.call(target, key)) {
          Object.defineProperty(target, key, { enumerable: true, get: definitions[key] });
        }
      }
    };
    exports.r = (target) => {
      if (typeof Symbol !== "undefined" && Symbol.toStringTag) Object.defineProperty(target, Symbol.toStringTag, { value: "Module" });
      Object.defineProperty(target, "__esModule", { value: true });
    };
    exports.n = (value) => {
      const getter = value && value.__esModule ? () => value.default : () => value;
      Object.defineProperty(getter, "a", { get: getter });
      return getter;
    };
    exports.t = (value, mode, load) => {
      if (mode & 1) {
        if (typeof load !== "function") throw new Error("Webpack interop.t mode 1 needs a resolved-module loader");
        value = load(value);
      }
      if (mode & 8) return value;
      if (mode & 4 && value && typeof value === "object" && value.__esModule) return value;
      const namespace = /* @__PURE__ */ Object.create(null);
      exports.r(namespace);
      const definitions = /* @__PURE__ */ Object.create(null);
      definitions.default = () => value;
      if (mode & 2 && value != null && typeof value !== "string") {
        for (const key in Object(value)) {
          if (key !== "default" && !Object.prototype.hasOwnProperty.call(definitions, key)) {
            definitions[key] = () => value[key];
          }
        }
      }
      exports.d(namespace, definitions);
      return namespace;
    };
    exports.o = (object, property) => Object.prototype.hasOwnProperty.call(object, property);
    exports.g = globalThis;
    exports.nc = void 0;
  }
});

// src/dependencies/73623.cjs
var require__ = __commonJS({
  "src/dependencies/73623.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    function n(e) {
      return e && e.__esModule ? e : {
        default: e
      };
    }
    interop.r(exports), interop.d(exports, {
      _: () => n
    });
  }
});

// src/dependencies/53887.cjs
var require__2 = __commonJS({
  "src/dependencies/53887.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    var r;
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    var n = {
      getAssetToken: function() {
        return o;
      },
      getAssetTokenQuery: function() {
        return i;
      },
      getDeploymentId: function() {
        return u;
      },
      getDeploymentIdQuery: function() {
        return l;
      }
    };
    for (a in n) Object.defineProperty(exports, a, {
      enumerable: true,
      get: n[a]
    });
    var a;
    function u() {
      return r;
    }
    function l(e = false) {
      return r ? `${e ? "&" : "?"}dpl=${r}` : "";
    }
    function o() {
      return false;
    }
    function i(e = false) {
      return "";
    }
    r = document.documentElement.dataset.dplId, delete document.documentElement.dataset.dplId;
  }
});

// src/dependencies/12590.cjs
var require__3 = __commonJS({
  "src/dependencies/12590.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    function r({
      widthInt: e,
      heightInt: t,
      blurWidth: i,
      blurHeight: n,
      blurDataURL: a,
      objectFit: o
    }) {
      let l = i ? 40 * i : e, s = n ? 40 * n : t, u = l && s ? `viewBox='0 0 ${l} ${s}'` : "";
      return `%3Csvg xmlns='http://www.w3.org/2000/svg' ${u}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='${u ? "none" : "contain" === o ? "xMidYMid" : "cover" === o ? "xMidYMid slice" : "none"}' style='filter: url(%23b);' href='${a}'/%3E%3C/svg%3E`;
    }
    Object.defineProperty(exports, "__esModule", {
      value: true
    }), Object.defineProperty(exports, "getImageBlurSvg", {
      enumerable: true,
      get: function() {
        return r;
      }
    });
  }
});

// src/dependencies/55762.cjs
var require__4 = __commonJS({
  "src/dependencies/55762.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    var r = {
      VALID_LOADERS: function() {
        return n;
      },
      imageConfigDefault: function() {
        return a;
      }
    };
    for (i in r) Object.defineProperty(exports, i, {
      enumerable: true,
      get: r[i]
    });
    var i;
    var n = ["default", "imgix", "cloudinary", "akamai", "custom"];
    var a = {
      deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
      imageSizes: [32, 48, 64, 96, 128, 256, 384],
      path: "",
      loader: "default",
      loaderFile: "",
      domains: [],
      disableStaticImages: false,
      minimumCacheTTL: 14400,
      formats: ["image/webp"],
      maximumDiskCacheSize: void 0,
      maximumRedirects: 3,
      maximumResponseBody: 5e7,
      dangerouslyAllowLocalIP: false,
      dangerouslyAllowSVG: false,
      contentSecurityPolicy: "script-src 'none'; frame-src 'none'; sandbox;",
      contentDispositionType: "attachment",
      localPatterns: void 0,
      remotePatterns: [],
      qualities: [75],
      unoptimized: true,
      customCacheHandler: false
    };
  }
});

// src/dependencies/95413.cjs
var require__5 = __commonJS({
  "src/dependencies/95413.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    Object.defineProperty(exports, "__esModule", {
      value: true
    }), Object.defineProperty(exports, "getImgProps", {
      enumerable: true,
      get: function() {
        return u;
      }
    });
    var i = require__2();
    var n = require__3();
    var a = require__4();
    var o = ["-moz-initial", "fill", "none", "scale-down", void 0];
    function l(e) {
      return void 0 !== e.default;
    }
    function s(e) {
      return void 0 === e ? e : "number" == typeof e ? Number.isFinite(e) ? e : NaN : "string" == typeof e && /^[0-9]+$/.test(e) ? parseInt(e, 10) : NaN;
    }
    function u({
      src: e,
      sizes: t,
      unoptimized: r = false,
      priority: d = false,
      preload: c = false,
      loading: f,
      className: p,
      quality: g,
      width: m,
      height: h,
      fill: b = false,
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
      let k, D, A, {
        imgConf: N,
        showAltText: L,
        blurComplete: T,
        defaultLoader: U
      } = I, q = N || a.imageConfigDefault;
      if ("allSizes" in q) k = q;
      else {
        let e2 = [...q.deviceSizes, ...q.imageSizes].sort((e3, t3) => e3 - t3), t2 = q.deviceSizes.sort((e3, t3) => e3 - t3), r2 = q.qualities?.sort((e3, t3) => e3 - t3);
        k = {
          ...q,
          allSizes: e2,
          deviceSizes: t2,
          qualities: r2
        };
      }
      if (void 0 === U) throw Object.defineProperty(Error("images.loaderFile detected but the file is missing default export.\nRead more: https://nextjs.org/docs/messages/invalid-images-config"), "__NEXT_ERROR_CODE", {
        value: "E163",
        enumerable: false,
        configurable: true
      });
      let F = M.loader || U;
      delete M.loader, delete M.srcSet;
      let W = "__next_img_default" in F;
      if (W) {
        if ("custom" === k.loader) throw Object.defineProperty(Error(`Image with src "${e}" is missing "loader" prop.
Read more: https://nextjs.org/docs/messages/next-image-missing-loader`), "__NEXT_ERROR_CODE", {
          value: "E252",
          enumerable: false,
          configurable: true
        });
      } else {
        let e2 = F;
        F = (t2) => {
          let {
            config: r2,
            ...i2
          } = t2;
          return e2(i2);
        };
      }
      if (O) {
        "fill" === O && (b = true);
        let e2 = {
          intrinsic: {
            maxWidth: "100%",
            height: "auto"
          },
          responsive: {
            width: "100%",
            height: "auto"
          }
        }[O];
        e2 && (y = {
          ...y,
          ...e2
        });
        let r2 = {
          responsive: "100vw",
          fill: "100vw"
        }[O];
        r2 && !t && (t = r2);
      }
      let B = "", G = s(m), H = s(h);
      if (($ = e) && "object" == typeof $ && (l($) || void 0 !== $.src)) {
        let t2 = l(e) ? e.default : e;
        if (!t2.src) throw Object.defineProperty(Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include src. Received ${JSON.stringify(t2)}`), "__NEXT_ERROR_CODE", {
          value: "E460",
          enumerable: false,
          configurable: true
        });
        if (!t2.height || !t2.width) throw Object.defineProperty(Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include height and width. Received ${JSON.stringify(t2)}`), "__NEXT_ERROR_CODE", {
          value: "E48",
          enumerable: false,
          configurable: true
        });
        if (D = t2.blurWidth, A = t2.blurHeight, x = x || t2.blurDataURL, B = t2.src, !b) if (G || H) {
          if (G && !H) {
            let e2 = G / t2.width;
            H = Math.round(t2.height * e2);
          } else if (!G && H) {
            let e2 = H / t2.height;
            G = Math.round(t2.width * e2);
          }
        } else G = t2.width, H = t2.height;
      }
      let X = !d && !c && ("lazy" === f || void 0 === f);
      (!(e = "string" == typeof e ? e : B) || e.startsWith("data:") || e.startsWith("blob:")) && (r = true, X = false), k.unoptimized && (r = true), W && !k.dangerouslyAllowSVG && e.split("?", 1)[0].endsWith(".svg") && (r = true);
      let V = s(g), J = Object.assign(b ? {
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
      }, y), Q = T || "empty" === j ? null : "blur" === j ? `url("data:image/svg+xml;charset=utf-8,${(0, n.getImageBlurSvg)({
        widthInt: G,
        heightInt: H,
        blurWidth: D,
        blurHeight: A,
        blurDataURL: x || "",
        objectFit: J.objectFit
      })}")` : `url("${j}")`, Y = o.includes(J.objectFit) ? "fill" === J.objectFit ? "100% 100%" : "cover" : J.objectFit, K = Q ? {
        backgroundSize: Y,
        backgroundPosition: J.objectPosition || "50% 50%",
        backgroundRepeat: "no-repeat",
        backgroundImage: Q
      } : {}, Z = (function({
        config: e2,
        src: t2,
        unoptimized: r2,
        width: n2,
        quality: a2,
        sizes: o2,
        loader: l2
      }) {
        if (r2) {
          if (t2.startsWith("/") && !t2.startsWith("//")) {
            let e3 = (0, i.getDeploymentId)();
            if (t2.includes("/_next/static/immutable") && !(0, i.getAssetToken)()) e3 = void 0;
            else if (e3) {
              let r3 = t2.indexOf("?");
              if (-1 !== r3) {
                let i2 = new URLSearchParams(t2.slice(r3 + 1));
                i2.get("dpl") || (i2.append("dpl", e3), t2 = t2.slice(0, r3) + "?" + i2.toString());
              } else t2 += `?dpl=${e3}`;
            }
          }
          return {
            src: t2,
            srcSet: void 0,
            sizes: void 0
          };
        }
        let {
          widths: s2,
          kind: u2
        } = (function({
          deviceSizes: e3,
          allSizes: t3
        }, r3, i2) {
          if (i2) {
            let r4 = /(^|\s)(1?\d?\d)vw/g, n3 = [];
            for (let e4; e4 = r4.exec(i2); ) n3.push(parseInt(e4[2]));
            if (n3.length) {
              let r5 = 0.01 * Math.min(...n3);
              return {
                widths: t3.filter((t4) => t4 >= e3[0] * r5),
                kind: "w"
              };
            }
            return {
              widths: t3,
              kind: "w"
            };
          }
          return "number" != typeof r3 ? {
            widths: e3,
            kind: "w"
          } : {
            widths: [...new Set([r3, 2 * r3].map((e4) => t3.find((t4) => t4 >= e4) || t3[t3.length - 1]))],
            kind: "x"
          };
        })(e2, n2, o2), d2 = s2.length - 1;
        return {
          sizes: o2 || "w" !== u2 ? o2 : "100vw",
          srcSet: s2.map((r3, i2) => `${l2({
            config: e2,
            src: t2,
            quality: a2,
            width: r3
          })} ${"w" === u2 ? r3 : i2 + 1}${u2}`).join(", "),
          src: l2({
            config: e2,
            src: t2,
            quality: a2,
            width: s2[d2]
          })
        };
      })({
        config: k,
        src: e,
        unoptimized: r,
        width: G,
        quality: V,
        sizes: t,
        loader: F
      }), ee = X ? "lazy" : f;
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
  }
});

// src/dependencies/66388.cjs
var require__6 = __commonJS({
  "src/dependencies/66388.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    function n(e) {
      if ("function" != typeof WeakMap) return null;
      var t = /* @__PURE__ */ new WeakMap(), r = /* @__PURE__ */ new WeakMap();
      return (n = function(e2) {
        return e2 ? r : t;
      })(e);
    }
    function a(e, t) {
      if (!t && e && e.__esModule) return e;
      if (null === e || "object" != typeof e && "function" != typeof e) return {
        default: e
      };
      var r = n(t);
      if (r && r.has(e)) return r.get(e);
      var a2 = {
        __proto__: null
      }, u = Object.defineProperty && Object.getOwnPropertyDescriptor;
      for (var l in e) if ("default" !== l && Object.prototype.hasOwnProperty.call(e, l)) {
        var o = u ? Object.getOwnPropertyDescriptor(e, l) : null;
        o && (o.get || o.set) ? Object.defineProperty(a2, l, o) : a2[l] = e[l];
      }
      return a2.default = e, r && r.set(e, a2), a2;
    }
    interop.r(exports), interop.d(exports, {
      _: () => a
    });
  }
});

// src/dependencies/58730.cjs
var require__7 = __commonJS({
  "src/dependencies/58730.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    var n = HostReact;
    function a(e) {
      var t = "https://react.dev/errors/" + e;
      if (1 < arguments.length) {
        t += "?args[]=" + encodeURIComponent(arguments[1]);
        for (var r = 2; r < arguments.length; r++) t += "&args[]=" + encodeURIComponent(arguments[r]);
      }
      return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
    }
    function u() {
    }
    var l = {
      d: {
        f: u,
        r: function() {
          throw Error(a(522));
        },
        D: u,
        C: u,
        L: u,
        m: u,
        X: u,
        S: u,
        M: u
      },
      p: 0,
      findDOMNode: null
    };
    var o = Symbol.for("react.portal");
    var i = Symbol.for("react.recoverable");
    var s = Symbol.for("react.optimistic_key");
    var c = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    function f(e, t) {
      return "font" === e ? "" : "string" == typeof t ? "use-credentials" === t ? t : "" : void 0;
    }
    exports.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = l, exports.browser = function() {
      var e = Error(a(603));
      return Object.defineProperty(e, "$$typeof", {
        value: i
      }), e;
    }, exports.createPortal = function(e, t) {
      var r = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
      if (!t || 1 !== t.nodeType && 9 !== t.nodeType && 11 !== t.nodeType) throw Error(a(299));
      return (function(e2, t2, r2) {
        var n2 = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
        return {
          $$typeof: o,
          key: null == n2 ? null : n2 === s ? s : "" + n2,
          children: e2,
          containerInfo: t2,
          implementation: r2
        };
      })(e, t, null, r);
    }, exports.flushSync = function(e) {
      var t = c.T, r = l.p;
      try {
        if (c.T = null, l.p = 2, e) return e();
      } finally {
        c.T = t, l.p = r, l.d.f();
      }
    }, exports.preconnect = function(e, t) {
      "string" == typeof e && (t = t ? "string" == typeof (t = t.crossOrigin) ? "use-credentials" === t ? t : "" : void 0 : null, l.d.C(e, t));
    }, exports.prefetchDNS = function(e) {
      "string" == typeof e && l.d.D(e);
    }, exports.preinit = function(e, t) {
      if ("string" == typeof e && t && "string" == typeof t.as) {
        var r = t.as, n2 = f(r, t.crossOrigin), a2 = "string" == typeof t.integrity ? t.integrity : void 0, u2 = "string" == typeof t.fetchPriority ? t.fetchPriority : void 0;
        "style" === r ? l.d.S(e, "string" == typeof t.precedence ? t.precedence : void 0, {
          crossOrigin: n2,
          integrity: a2,
          fetchPriority: u2
        }) : "script" === r && l.d.X(e, {
          crossOrigin: n2,
          integrity: a2,
          fetchPriority: u2,
          nonce: "string" == typeof t.nonce ? t.nonce : void 0
        });
      }
    }, exports.preinitModule = function(e, t) {
      if ("string" == typeof e) if ("object" == typeof t && null !== t) {
        if (null == t.as || "script" === t.as) {
          var r = f(t.as, t.crossOrigin);
          l.d.M(e, {
            crossOrigin: r,
            integrity: "string" == typeof t.integrity ? t.integrity : void 0,
            nonce: "string" == typeof t.nonce ? t.nonce : void 0,
            fetchPriority: "string" == typeof t.fetchPriority ? t.fetchPriority : void 0
          });
        }
      } else null == t && l.d.M(e);
    }, exports.preload = function(e, t) {
      if ("string" == typeof e && "object" == typeof t && null !== t && "string" == typeof t.as) {
        var r = t.as, n2 = f(r, t.crossOrigin);
        l.d.L(e, r, {
          crossOrigin: n2,
          integrity: "string" == typeof t.integrity ? t.integrity : void 0,
          nonce: "string" == typeof t.nonce ? t.nonce : void 0,
          type: "string" == typeof t.type ? t.type : void 0,
          fetchPriority: "string" == typeof t.fetchPriority ? t.fetchPriority : void 0,
          referrerPolicy: "string" == typeof t.referrerPolicy ? t.referrerPolicy : void 0,
          imageSrcSet: "string" == typeof t.imageSrcSet ? t.imageSrcSet : void 0,
          imageSizes: "string" == typeof t.imageSizes ? t.imageSizes : void 0,
          media: "string" == typeof t.media ? t.media : void 0
        });
      }
    }, exports.preloadModule = function(e, t) {
      if ("string" == typeof e) if (t) {
        var r = f(t.as, t.crossOrigin);
        l.d.m(e, {
          as: "string" == typeof t.as && "script" !== t.as ? t.as : void 0,
          crossOrigin: r,
          integrity: "string" == typeof t.integrity ? t.integrity : void 0,
          nonce: "string" == typeof t.nonce ? t.nonce : void 0,
          fetchPriority: "string" == typeof t.fetchPriority ? t.fetchPriority : void 0
        });
      } else l.d.m(e);
    }, exports.requestFormReset = function(e) {
      l.d.r(e);
    }, exports.unstable_batchedUpdates = function(e, t) {
      return e(t);
    }, exports.useFormState = function(e, t, r) {
      return c.H.useFormState(e, t, r);
    }, exports.useFormStatus = function() {
      return c.H.useHostTransitionStatus();
    }, exports.version = "19.3.0-canary-cbb046ab-20260731";
  }
});

// src/dependencies/47650.cjs
var require__8 = __commonJS({
  "src/dependencies/47650.cjs"(exports, module2) {
    "use strict";
    var interop = require_interop();
    !(function e() {
      if ("u" > typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" == typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE) try {
        __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(e);
      } catch (e2) {
        console.error(e2);
      }
    })(), module2.exports = require__7();
  }
});

// src/dependencies/76899.cjs
var require__9 = __commonJS({
  "src/dependencies/76899.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    Object.defineProperty(exports, "__esModule", {
      value: true
    }), Object.defineProperty(exports, "default", {
      enumerable: true,
      get: function() {
        return o;
      }
    });
    var i = HostReact;
    var n = i.useLayoutEffect;
    var a = i.useEffect;
    function o(e) {
      let {
        headManager: t,
        reduceComponentsToState: r
      } = e;
      function o2() {
        if (t && t.mountedInstances) {
          let e2 = i.Children.toArray(Array.from(t.mountedInstances).filter(Boolean));
          t.updateHead(r(e2));
        }
      }
      return n(() => (t?.mountedInstances?.add(e.children), () => {
        t?.mountedInstances?.delete(e.children);
      })), n(() => (t && (t._pendingUpdate = o2), () => {
        t && (t._pendingUpdate = o2);
      })), a(() => (t && t._pendingUpdate && (t._pendingUpdate(), t._pendingUpdate = null), () => {
        t && t._pendingUpdate && (t._pendingUpdate(), t._pendingUpdate = null);
      })), null;
    }
  }
});

// src/dependencies/75368.cjs
var require__10 = __commonJS({
  "src/dependencies/75368.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    Object.defineProperty(exports, "__esModule", {
      value: true
    }), Object.defineProperty(exports, "HeadManagerContext", {
      enumerable: true,
      get: function() {
        return n;
      }
    });
    var n = require__()._(HostReact).default.createContext({});
  }
});

// src/dependencies/46686.cjs
var require__11 = __commonJS({
  "src/dependencies/46686.cjs"(exports, module2) {
    "use strict";
    var interop = require_interop();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    var i = {
      default: function() {
        return m;
      },
      defaultHead: function() {
        return c;
      }
    };
    for (n in i) Object.defineProperty(exports, n, {
      enumerable: true,
      get: i[n]
    });
    var n;
    var a = require__();
    var o = require__6();
    var l = HostJSX;
    var s = o._(HostReact);
    var u = a._(require__9());
    var d = require__10();
    function c() {
      return [(0, l.jsx)("meta", {
        charSet: "utf-8"
      }, "charset"), (0, l.jsx)("meta", {
        name: "viewport",
        content: "width=device-width"
      }, "viewport")];
    }
    function f(e, t) {
      return "string" == typeof t || "number" == typeof t ? e : t.type === s.default.Fragment ? e.concat(s.default.Children.toArray(t.props.children).reduce((e2, t2) => "string" == typeof t2 || "number" == typeof t2 ? e2 : e2.concat(t2), [])) : e.concat(t);
    }
    var p = ["name", "httpEquiv", "charSet", "itemProp"];
    function g(e) {
      let t, r, i2, n2;
      return e.reduce(f, []).reverse().concat(c().reverse()).filter((t = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), i2 = /* @__PURE__ */ new Set(), n2 = {}, (e2) => {
        let a2 = true, o2 = false;
        if (e2.key && "number" != typeof e2.key && e2.key.indexOf("$") > 0) {
          o2 = true;
          let r2 = e2.key.slice(e2.key.indexOf("$") + 1);
          t.has(r2) ? a2 = false : t.add(r2);
        }
        switch (e2.type) {
          case "title":
          case "base":
            r.has(e2.type) ? a2 = false : r.add(e2.type);
            break;
          case "meta":
            for (let t2 = 0, r2 = p.length; t2 < r2; t2++) {
              let r3 = p[t2];
              if (e2.props.hasOwnProperty(r3)) if ("charSet" === r3) i2.has(r3) ? a2 = false : i2.add(r3);
              else {
                let t3 = e2.props[r3], i3 = n2[r3] || /* @__PURE__ */ new Set();
                ("name" !== r3 || !o2) && i3.has(t3) ? a2 = false : (i3.add(t3), n2[r3] = i3);
              }
            }
        }
        return a2;
      })).reverse().map((e2, t2) => {
        let r2 = e2.key || t2;
        return s.default.cloneElement(e2, {
          key: r2
        });
      });
    }
    var m = function({
      children: e
    }) {
      let t = (0, s.useContext)(d.HeadManagerContext);
      return (0, l.jsx)(u.default, {
        reduceComponentsToState: g,
        headManager: t,
        children: e
      });
    };
    ("function" == typeof exports.default || "object" == typeof exports.default && null !== exports.default) && void 0 === exports.default.__esModule && (Object.defineProperty(exports.default, "__esModule", {
      value: true
    }), Object.assign(exports.default, exports), module2.exports = exports.default);
  }
});

// src/dependencies/17150.cjs
var require__12 = __commonJS({
  "src/dependencies/17150.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    Object.defineProperty(exports, "__esModule", {
      value: true
    }), Object.defineProperty(exports, "ImageConfigContext", {
      enumerable: true,
      get: function() {
        return a;
      }
    });
    var i = require__()._(HostReact);
    var n = require__4();
    var a = i.default.createContext(n.imageConfigDefault);
  }
});

// src/dependencies/60751.cjs
var require__13 = __commonJS({
  "src/dependencies/60751.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    Object.defineProperty(exports, "__esModule", {
      value: true
    }), Object.defineProperty(exports, "RouterContext", {
      enumerable: true,
      get: function() {
        return i;
      }
    });
    var i = require__()._(HostReact).default.createContext(null);
  }
});

// src/dependencies/18857.cjs
var require__14 = __commonJS({
  "src/dependencies/18857.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    function r(e, t) {
      let r2 = e || 75;
      return t?.qualities?.length ? t.qualities.reduce((e2, t2) => Math.abs(t2 - r2) < Math.abs(e2 - r2) ? t2 : e2, t.qualities[0]) : r2;
    }
    Object.defineProperty(exports, "__esModule", {
      value: true
    }), Object.defineProperty(exports, "findClosestQuality", {
      enumerable: true,
      get: function() {
        return r;
      }
    });
  }
});

// src/dependencies/36095.cjs
var require__15 = __commonJS({
  "src/dependencies/36095.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    Object.defineProperty(exports, "__esModule", {
      value: true
    }), Object.defineProperty(exports, "default", {
      enumerable: true,
      get: function() {
        return o;
      }
    });
    var i = require__14();
    var n = require__2();
    function a({
      config: e,
      src: t,
      width: r,
      quality: o2
    }) {
      let l = (0, n.getDeploymentId)();
      if (t.startsWith("/") && !t.startsWith("//")) if (t.includes("/_next/static/immutable") && !(0, n.getAssetToken)()) l = void 0;
      else {
        let e2 = t.indexOf("?");
        if (-1 !== e2) {
          let r2 = new URLSearchParams(t.slice(e2 + 1)), i2 = r2.get("dpl");
          if (i2) {
            l = i2, r2.delete("dpl");
            let n2 = r2.toString();
            t = t.slice(0, e2) + (n2 ? "?" + n2 : "");
          }
        }
      }
      if (t.startsWith("/") && t.includes("?") && e.localPatterns?.length === 1 && "**" === e.localPatterns[0].pathname && "" === e.localPatterns[0].search) throw Object.defineProperty(Error(`Image with src "${t}" is using a query string which is not configured in images.localPatterns.
Read more: https://nextjs.org/docs/messages/next-image-unconfigured-localpatterns`), "__NEXT_ERROR_CODE", {
        value: "E871",
        enumerable: false,
        configurable: true
      });
      let s = (0, i.findClosestQuality)(o2, e);
      return `${e.path}?url=${encodeURIComponent(t)}&w=${r}&q=${s}${t.startsWith("/") && l ? `&dpl=${l}` : ""}`;
    }
    a.__next_img_default = true;
    var o = a;
  }
});

// src/dependencies/21172.cjs
var require__16 = __commonJS({
  "src/dependencies/21172.cjs"(exports, module2) {
    "use strict";
    var interop = require_interop();
    Object.defineProperty(exports, "__esModule", {
      value: true
    }), Object.defineProperty(exports, "useMergedRef", {
      enumerable: true,
      get: function() {
        return o;
      }
    });
    var n = HostReact;
    function o(e, t) {
      let r = (0, n.useRef)(null), o2 = (0, n.useRef)(null);
      return (0, n.useCallback)((n2) => {
        if (null === n2) {
          let e2 = r.current;
          e2 && (r.current = null, e2());
          let t2 = o2.current;
          t2 && (o2.current = null, t2());
        } else e && (r.current = u(e, n2)), t && (o2.current = u(t, n2));
      }, [e, t]);
    }
    function u(e, t) {
      if ("function" != typeof e) return e.current = t, () => {
        e.current = null;
      };
      {
        let r = e(t);
        return "function" == typeof r ? r : () => e(null);
      }
    }
    ("function" == typeof exports.default || "object" == typeof exports.default && null !== exports.default) && void 0 === exports.default.__esModule && (Object.defineProperty(exports.default, "__esModule", {
      value: true
    }), Object.assign(exports.default, exports), module2.exports = exports.default);
  }
});

// src/dependencies/38437.cjs
var require__17 = __commonJS({
  "src/dependencies/38437.cjs"(exports, module2) {
    "use strict";
    var interop = require_interop();
    Object.defineProperty(exports, "__esModule", {
      value: true
    }), Object.defineProperty(exports, "Image", {
      enumerable: true,
      get: function() {
        return w;
      }
    });
    var i = require__();
    var n = require__6();
    var a = HostJSX;
    var o = n._(HostReact);
    var l = i._(require__8());
    var s = i._(require__11());
    var u = require__5();
    var d = require__4();
    var c = require__12();
    var f = require__13();
    var p = i._(require__15());
    var g = require__16();
    var m = {
      deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
      imageSizes: [32, 48, 64, 96, 128, 256, 384],
      qualities: [75],
      path: "",
      loader: "default",
      dangerouslyAllowSVG: false,
      unoptimized: true
    };
    function h(e, t, r, i2, n2, a2, o2) {
      let l2 = e?.src;
      e && e["data-loaded-src"] !== l2 && (e["data-loaded-src"] = l2, ("decode" in e ? e.decode() : Promise.resolve()).catch(() => {
      }).then(() => {
        if (e.parentElement && e.isConnected) {
          if ("empty" !== t && n2(true), r?.current) {
            let t2 = new Event("load");
            Object.defineProperty(t2, "target", {
              writable: false,
              value: e
            });
            let i3 = false, n3 = false;
            r.current({
              ...t2,
              nativeEvent: t2,
              currentTarget: e,
              target: e,
              isDefaultPrevented: () => i3,
              isPropagationStopped: () => n3,
              persist: () => {
              },
              preventDefault: () => {
                i3 = true, t2.preventDefault();
              },
              stopPropagation: () => {
                n3 = true, t2.stopPropagation();
              }
            });
          }
          i2?.current && i2.current(e);
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
    var y = o.useLayoutEffect;
    var _ = (0, o.forwardRef)(({
      src: e,
      srcSet: t,
      sizes: r,
      height: i2,
      width: n2,
      decoding: l2,
      className: s2,
      style: u2,
      fetchPriority: d2,
      placeholder: c2,
      loading: f2,
      unoptimized: p2,
      fill: m2,
      onLoadRef: _2,
      onLoadingCompleteRef: v2,
      setBlurComplete: w2,
      setShowAltText: j,
      sizesInput: x,
      onLoad: P,
      onError: S,
      ...O
    }, C) => {
      let E = (0, o.useRef)(false), R = (0, o.useRef)(null);
      y(() => {
        let {
          current: e2
        } = E, {
          current: t2
        } = R;
        e2 || null === t2 || (S && (t2.src = t2.src), t2.complete && h(t2, c2, _2, v2, w2, p2, x), E.current = true);
      }, [e, c2, _2, v2, S, p2, x]);
      let z = (0, g.useMergedRef)(C, R);
      return (0, a.jsx)("img", {
        ...O,
        ...b(d2),
        loading: f2,
        width: n2,
        height: i2,
        decoding: l2,
        "data-nimg": m2 ? "fill" : "1",
        className: s2,
        style: u2,
        sizes: r,
        srcSet: t,
        src: e,
        ref: z,
        onLoad: (e2) => {
          h(e2.currentTarget, c2, _2, v2, w2, p2, x);
        },
        onError: (e2) => {
          j(true), "empty" !== c2 && w2(true), S && S(e2);
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
    var w = (0, o.forwardRef)((e, t) => {
      let r = (0, o.useContext)(f.RouterContext), i2 = (0, o.useContext)(c.ImageConfigContext), n2 = (0, o.useMemo)(() => {
        let e2 = m || i2 || d.imageConfigDefault, t2 = [...e2.deviceSizes, ...e2.imageSizes].sort((e3, t3) => e3 - t3), r2 = e2.deviceSizes.sort((e3, t3) => e3 - t3), n3 = e2.qualities?.sort((e3, t3) => e3 - t3);
        return {
          ...e2,
          allSizes: t2,
          deviceSizes: r2,
          qualities: n3,
          localPatterns: e2.localPatterns
        };
      }, [i2]), {
        onLoad: l2,
        onLoadingComplete: s2
      } = e, g2 = (0, o.useRef)(l2);
      (0, o.useEffect)(() => {
        g2.current = l2;
      }, [l2]);
      let h2 = (0, o.useRef)(s2);
      (0, o.useEffect)(() => {
        h2.current = s2;
      }, [s2]);
      let [b2, y2] = (0, o.useState)(false), [w2, j] = (0, o.useState)(false), {
        props: x,
        meta: P
      } = (0, u.getImgProps)(e, {
        defaultLoader: p.default,
        imgConf: n2,
        blurComplete: b2,
        showAltText: w2
      });
      return (0, a.jsxs)(a.Fragment, {
        children: [(0, a.jsx)(_, {
          ...x,
          unoptimized: P.unoptimized,
          placeholder: P.placeholder,
          fill: P.fill,
          onLoadRef: g2,
          onLoadingCompleteRef: h2,
          setBlurComplete: y2,
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
      value: true
    }), Object.assign(exports.default, exports), module2.exports = exports.default);
  }
});

// src/dependencies/97651.cjs
var require__18 = __commonJS({
  "src/dependencies/97651.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    var t = {
      default: function() {
        return c;
      },
      getImageProps: function() {
        return d;
      }
    };
    for (s in t) Object.defineProperty(exports, s, {
      enumerable: true,
      get: t[s]
    });
    var s;
    var o = require__();
    var n = require__5();
    var r = require__17();
    var l = o._(require__15());
    function d(e) {
      let {
        props: a
      } = (0, n.getImgProps)(e, {
        defaultLoader: l.default,
        imgConf: {
          deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
          imageSizes: [32, 48, 64, 96, 128, 256, 384],
          qualities: [75],
          path: "",
          loader: "default",
          dangerouslyAllowSVG: false,
          unoptimized: true
        }
      });
      for (let [e2, i] of Object.entries(a)) void 0 === i && delete a[e2];
      return {
        props: a
      };
    }
    var c = r.Image;
  }
});

// src/dependencies/5772.cjs
var require__19 = __commonJS({
  "src/dependencies/5772.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      default: () => s.a
    });
    var t = require__18();
    var s = interop.n(t);
    interop.o(t, "getImageProps") && interop.d(exports, {
      getImageProps: function() {
        return t.getImageProps;
      }
    });
  }
});

// src/dependencies/25952.cjs
var require__20 = __commonJS({
  "src/dependencies/25952.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      U: () => n,
      f: () => s
    });
    var n = ["transformPerspective", "x", "y", "z", "translateX", "translateY", "translateZ", "scale", "scaleX", "scaleY", "rotate", "rotateX", "rotateY", "rotateZ", "skew", "skewX", "skewY"];
    var s = /* @__PURE__ */ new Set([...n, "pathRotation"]);
  }
});

// src/dependencies/94712.cjs
var require__21 = __commonJS({
  "src/dependencies/94712.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      q: () => n
    });
    var n = (t, e, i) => i > e ? e : i < t ? t : i;
  }
});

// src/dependencies/49637.cjs
var require__22 = __commonJS({
  "src/dependencies/49637.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      X4: () => r,
      ai: () => s,
      hs: () => o
    });
    var n = require__21();
    var s = {
      test: (t) => "number" == typeof t,
      parse: parseFloat,
      transform: (t) => t
    };
    var r = {
      ...s,
      transform: (t) => (0, n.q)(0, 1, t)
    };
    var o = {
      ...s,
      default: 1
    };
  }
});

// src/dependencies/71939.cjs
var require__23 = __commonJS({
  "src/dependencies/71939.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      a: () => n
    });
    var n = (t) => Math.round(1e5 * t) / 1e5;
  }
});

// src/dependencies/21620.cjs
var require__24 = __commonJS({
  "src/dependencies/21620.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      S: () => n
    });
    var n = /-?(?:\d+(?:\.\d+)?|\.\d+)/gu;
  }
});

// src/dependencies/82163.cjs
var require__25 = __commonJS({
  "src/dependencies/82163.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      $: () => r,
      q: () => o
    });
    var n = require__24();
    var s = /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))$/iu;
    var r = (t, e) => (i) => !!("string" == typeof i && s.test(i) && i.startsWith(t) || e && null != i && Object.prototype.hasOwnProperty.call(i, e));
    var o = (t, e, i) => (s2) => {
      if ("string" != typeof s2) return s2;
      let [r2, o2, a, l] = s2.match(n.S);
      return {
        [t]: parseFloat(r2),
        [e]: parseFloat(o2),
        [i]: parseFloat(a),
        alpha: void 0 !== l ? parseFloat(l) : 1
      };
    };
  }
});

// src/dependencies/27994.cjs
var require__26 = __commonJS({
  "src/dependencies/27994.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      B: () => l
    });
    var n = require__21();
    var s = require__22();
    var r = require__23();
    var o = require__25();
    var a = {
      ...s.ai,
      transform: (t) => Math.round((0, n.q)(0, 255, t))
    };
    var l = {
      test: (0, o.$)("rgb", "red"),
      parse: (0, o.q)("red", "green", "blue"),
      transform: ({
        red: t,
        green: e,
        blue: i,
        alpha: n2 = 1
      }) => "rgba(" + a.transform(t) + ", " + a.transform(e) + ", " + a.transform(i) + ", " + (0, r.a)(s.X4.transform(n2)) + ")"
    };
  }
});

// src/dependencies/30281.cjs
var require__27 = __commonJS({
  "src/dependencies/30281.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      u: () => s
    });
    var n = require__26();
    var s = {
      test: (0, require__25().$)("#"),
      parse: function(t) {
        let e = "", i = "", n2 = "", s2 = "";
        return t.length > 5 ? (e = t.substring(1, 3), i = t.substring(3, 5), n2 = t.substring(5, 7), s2 = t.substring(7, 9)) : (e = t.substring(1, 2), i = t.substring(2, 3), n2 = t.substring(3, 4), s2 = t.substring(4, 5), e += e, i += i, n2 += n2, s2 += s2), {
          red: parseInt(e, 16),
          green: parseInt(i, 16),
          blue: parseInt(n2, 16),
          alpha: s2 ? parseInt(s2, 16) / 255 : 1
        };
      },
      transform: n.B.transform
    };
  }
});

// src/dependencies/11048.cjs
var require__28 = __commonJS({
  "src/dependencies/11048.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      KN: () => r,
      gQ: () => h,
      px: () => o,
      uj: () => s,
      vh: () => a,
      vw: () => l
    });
    var n = (t) => ({
      test: (e) => "string" == typeof e && e.endsWith(t) && 1 === e.split(" ").length,
      parse: parseFloat,
      transform: (e) => `${e}${t}`
    });
    var s = n("deg");
    var r = n("%");
    var o = n("px");
    var a = n("vh");
    var l = n("vw");
    var h = {
      ...r,
      parse: (t) => r.parse(t) / 100,
      transform: (t) => r.transform(100 * t)
    };
  }
});

// src/dependencies/88158.cjs
var require__29 = __commonJS({
  "src/dependencies/88158.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      V: () => a
    });
    var n = require__22();
    var s = require__28();
    var r = require__23();
    var o = require__25();
    var a = {
      test: (0, o.$)("hsl", "hue"),
      parse: (0, o.q)("hue", "saturation", "lightness"),
      transform: ({
        hue: t,
        saturation: e,
        lightness: i,
        alpha: o2 = 1
      }) => "hsla(" + Math.round(t) + ", " + s.KN.transform((0, r.a)(e)) + ", " + s.KN.transform((0, r.a)(i)) + ", " + (0, r.a)(n.X4.transform(o2)) + ")"
    };
  }
});

// src/dependencies/77054.cjs
var require__30 = __commonJS({
  "src/dependencies/77054.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      y: () => o
    });
    var n = require__27();
    var s = require__29();
    var r = require__26();
    var o = {
      test: (t) => r.B.test(t) || n.u.test(t) || s.V.test(t),
      parse: (t) => r.B.test(t) ? r.B.parse(t) : s.V.test(t) ? s.V.parse(t) : n.u.parse(t),
      transform: (t) => "string" == typeof t ? t : t.hasOwnProperty("red") ? r.B.transform(t) : s.V.transform(t),
      getAnimatableNone: (t) => {
        let e = o.parse(t);
        return e.alpha = 0, o.transform(e);
      }
    };
  }
});

// src/dependencies/83399.cjs
var require__31 = __commonJS({
  "src/dependencies/83399.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      Vf: () => c,
      f: () => m,
      nK: () => d
    });
    var n = require__30();
    var s = require__24();
    var r = require__23();
    var o = new RegExp(s.S.source);
    var a = RegExp(/(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\))/giu.source, "i");
    var l = "number";
    var h = "color";
    var u = /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu;
    function d(t) {
      let e = t.toString();
      return o.test(e) || a.test(e);
    }
    function c(t) {
      let e = t.toString(), i = [], s2 = {
        color: [],
        number: [],
        var: []
      }, r2 = [], o2 = 0, a2 = e.replace(u, (t2) => (n.y.test(t2) ? (s2.color.push(o2), r2.push(h), i.push(n.y.parse(t2))) : t2.startsWith("var(") ? (s2.var.push(o2), r2.push("var"), i.push(t2)) : (s2.number.push(o2), r2.push(l), i.push(parseFloat(t2))), ++o2, "${}")).split("${}");
      return {
        values: i,
        split: a2,
        indexes: s2,
        types: r2
      };
    }
    function p({
      split: t,
      types: e
    }) {
      let i = t.length;
      return (s2) => {
        let o2 = "";
        for (let a2 = 0; a2 < i; a2++) if (o2 += t[a2], void 0 !== s2[a2]) {
          let t2 = e[a2];
          t2 === l ? o2 += (0, r.a)(s2[a2]) : t2 === h ? o2 += n.y.transform(s2[a2]) : o2 += s2[a2];
        }
        return o2;
      };
    }
    var m = {
      test: function(t) {
        return isNaN(t) && "string" == typeof t && (o.test(t) || a.test(t));
      },
      parse: function(t) {
        return c(t).values;
      },
      createTransformer: function(t) {
        return p(c(t));
      },
      getAnimatableNone: function(t) {
        let e = c(t);
        return p(e)(e.values.map((t2, i) => ((t3, e2) => "number" == typeof t3 ? e2?.trim().endsWith("/") ? t3 : 0 : "number" == typeof t3 ? 0 : n.y.test(t3) ? n.y.getAnimatableNone(t3) : t3)(t2, e.split[i])));
      }
    };
  }
});

// src/dependencies/48545.cjs
var require__32 = __commonJS({
  "src/dependencies/48545.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      p: () => l
    });
    var n = require__31();
    var s = require__24();
    var r = /* @__PURE__ */ new Set(["brightness", "contrast", "saturate", "opacity"]);
    function o(t) {
      let [e, i] = t.slice(0, -1).split("(");
      if ("drop-shadow" === e) return t;
      let [n2] = i.match(s.S) || [];
      if (!n2) return t;
      let o2 = i.replace(n2, ""), a2 = +!!r.has(e);
      return n2 !== i && (a2 *= 100), e + "(" + a2 + o2 + ")";
    }
    var a = /\b([a-z-]*)\(.*?\)/gu;
    var l = {
      ...n.f,
      getAnimatableNone: (t) => {
        let e = t.match(a);
        return e ? e.map(o).join(" ") : t;
      }
    };
  }
});

// src/dependencies/92255.cjs
var require__33 = __commonJS({
  "src/dependencies/92255.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      d: () => s
    });
    var n = require__31();
    var s = {
      ...n.f,
      getAnimatableNone: (t) => {
        let e = n.f.parse(t);
        return n.f.createTransformer(t)(e.map((t2) => "number" == typeof t2 ? 0 : "object" == typeof t2 ? {
          ...t2,
          alpha: 1
        } : t2));
      }
    };
  }
});

// src/dependencies/11136.cjs
var require__34 = __commonJS({
  "src/dependencies/11136.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      H: () => r
    });
    var n = require__22();
    var s = require__28();
    var r = {
      rotate: s.uj,
      pathRotation: s.uj,
      rotateX: s.uj,
      rotateY: s.uj,
      rotateZ: s.uj,
      scale: n.hs,
      scaleX: n.hs,
      scaleY: n.hs,
      scaleZ: n.hs,
      skew: s.uj,
      skewX: s.uj,
      skewY: s.uj,
      distance: s.px,
      translateX: s.px,
      translateY: s.px,
      translateZ: s.px,
      x: s.px,
      y: s.px,
      z: s.px,
      perspective: s.px,
      transformPerspective: s.px,
      opacity: n.X4,
      originX: s.gQ,
      originY: s.gQ,
      originZ: s.px
    };
  }
});

// src/dependencies/29543.cjs
var require__35 = __commonJS({
  "src/dependencies/29543.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      W: () => a
    });
    var n = require__22();
    var s = {
      ...n.ai,
      transform: Math.round
    };
    var r = require__28();
    var o = require__34();
    var a = {
      borderWidth: r.px,
      borderTopWidth: r.px,
      borderRightWidth: r.px,
      borderBottomWidth: r.px,
      borderLeftWidth: r.px,
      borderRadius: r.px,
      borderTopLeftRadius: r.px,
      borderTopRightRadius: r.px,
      borderBottomRightRadius: r.px,
      borderBottomLeftRadius: r.px,
      width: r.px,
      maxWidth: r.px,
      height: r.px,
      maxHeight: r.px,
      top: r.px,
      right: r.px,
      bottom: r.px,
      left: r.px,
      inset: r.px,
      insetBlock: r.px,
      insetBlockStart: r.px,
      insetBlockEnd: r.px,
      insetInline: r.px,
      insetInlineStart: r.px,
      insetInlineEnd: r.px,
      padding: r.px,
      paddingTop: r.px,
      paddingRight: r.px,
      paddingBottom: r.px,
      paddingLeft: r.px,
      paddingBlock: r.px,
      paddingBlockStart: r.px,
      paddingBlockEnd: r.px,
      paddingInline: r.px,
      paddingInlineStart: r.px,
      paddingInlineEnd: r.px,
      margin: r.px,
      marginTop: r.px,
      marginRight: r.px,
      marginBottom: r.px,
      marginLeft: r.px,
      marginBlock: r.px,
      marginBlockStart: r.px,
      marginBlockEnd: r.px,
      marginInline: r.px,
      marginInlineStart: r.px,
      marginInlineEnd: r.px,
      fontSize: r.px,
      backgroundPositionX: r.px,
      backgroundPositionY: r.px,
      ...o.H,
      zIndex: s,
      fillOpacity: n.X4,
      strokeOpacity: n.X4,
      numOctaves: s
    };
  }
});

// src/dependencies/47888.cjs
var require__36 = __commonJS({
  "src/dependencies/47888.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      D: () => a
    });
    var n = require__30();
    var s = require__32();
    var r = require__33();
    var o = {
      ...require__35().W,
      color: n.y,
      backgroundColor: n.y,
      outlineColor: n.y,
      fill: n.y,
      stroke: n.y,
      borderColor: n.y,
      borderTopColor: n.y,
      borderRightColor: n.y,
      borderBottomColor: n.y,
      borderLeftColor: n.y,
      filter: s.p,
      WebkitFilter: s.p,
      mask: r.d,
      WebkitMask: r.d
    };
    var a = (t) => o[t];
  }
});

// src/dependencies/4287.cjs
var require__37 = __commonJS({
  "src/dependencies/4287.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      ge: () => o,
      xU: () => s
    });
    var n = () => ({
      translate: 0,
      scale: 1,
      origin: 0,
      originPoint: 0
    });
    var s = () => ({
      x: n(),
      y: n()
    });
    var r = () => ({
      min: 0,
      max: 0
    });
    var o = () => ({
      x: r(),
      y: r()
    });
  }
});

// src/dependencies/51469.cjs
var require__38 = __commonJS({
  "src/dependencies/51469.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      S: () => n
    });
    var n = (t) => !!(t && t.getVelocity);
  }
});

// src/dependencies/9247.cjs
var require__39 = __commonJS({
  "src/dependencies/9247.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      $: () => n
    });
    var n = /* @__PURE__ */ new Set(["width", "height", "top", "left", "right", "bottom", ...require__20().U]);
  }
});

// src/dependencies/55208.cjs
var require__40 = __commonJS({
  "src/dependencies/55208.cjs"(exports, module2) {
    "use strict";
    var interop = require_interop();
    var t = {
      156: function(e) {
        var t2, r2, n2, a = e.exports = {};
        function u() {
          throw Error("setTimeout has not been defined");
        }
        function l() {
          throw Error("clearTimeout has not been defined");
        }
        try {
          t2 = "function" == typeof setTimeout ? setTimeout : u;
        } catch (e2) {
          t2 = u;
        }
        try {
          r2 = "function" == typeof clearTimeout ? clearTimeout : l;
        } catch (e2) {
          r2 = l;
        }
        function o(e2) {
          if (t2 === setTimeout) return setTimeout(e2, 0);
          if ((t2 === u || !t2) && setTimeout) return t2 = setTimeout, setTimeout(e2, 0);
          try {
            return t2(e2, 0);
          } catch (r3) {
            try {
              return t2.call(null, e2, 0);
            } catch (r4) {
              return t2.call(this, e2, 0);
            }
          }
        }
        var i = [], s = false, c = -1;
        function f() {
          s && n2 && (s = false, n2.length ? i = n2.concat(i) : c = -1, i.length && d());
        }
        function d() {
          if (!s) {
            var e2 = o(f);
            s = true;
            for (var t3 = i.length; t3; ) {
              for (n2 = i, i = []; ++c < t3; ) n2 && n2[c].run();
              c = -1, t3 = i.length;
            }
            n2 = null, s = false, (function(e3) {
              if (r2 === clearTimeout) return clearTimeout(e3);
              if ((r2 === l || !r2) && clearTimeout) return r2 = clearTimeout, clearTimeout(e3);
              try {
                r2(e3);
              } catch (t4) {
                try {
                  return r2.call(null, e3);
                } catch (t5) {
                  return r2.call(this, e3);
                }
              }
            })(e2);
          }
        }
        function p(e2, t3) {
          this.fun = e2, this.array = t3;
        }
        function h() {
        }
        a.nextTick = function(e2) {
          var t3 = Array(arguments.length - 1);
          if (arguments.length > 1) for (var r3 = 1; r3 < arguments.length; r3++) t3[r3 - 1] = arguments[r3];
          i.push(new p(e2, t3)), 1 !== i.length || s || o(d);
        }, p.prototype.run = function() {
          this.fun.apply(null, this.array);
        }, a.title = "browser", a.browser = true, a.env = {}, a.argv = [], a.version = "", a.versions = {}, a.on = h, a.addListener = h, a.once = h, a.off = h, a.removeListener = h, a.removeAllListeners = h, a.emit = h, a.prependListener = h, a.prependOnceListener = h, a.listeners = function(e2) {
          return [];
        }, a.binding = function(e2) {
          throw Error("process.binding is not supported");
        }, a.cwd = function() {
          return "/";
        }, a.chdir = function(e2) {
          throw Error("process.chdir is not supported");
        }, a.umask = function() {
          return 0;
        };
      }
    };
    var r = {};
    function n(e) {
      var a = r[e];
      if (void 0 !== a) return a.exports;
      var u = r[e] = {
        exports: {}
      }, l = true;
      try {
        t[e](u, u.exports, n), l = false;
      } finally {
        l && delete r[e];
      }
      return u.exports;
    }
    n.ab = "//", module2.exports = n(156);
  }
});

// src/dependencies/41463.cjs
var require__41 = __commonJS({
  "src/dependencies/41463.cjs"(exports, module2) {
    "use strict";
    var interop = require_interop();
    var n;
    var a;
    module2.exports = (null == (n = interop.g.process) ? void 0 : n.env) && "object" == typeof (null == (a = interop.g.process) ? void 0 : a.env) ? interop.g.process : require__40();
  }
});

// src/dependencies/5556.cjs
var require__42 = __commonJS({
  "src/dependencies/5556.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      $: () => n,
      V: () => s
    }), require__41();
    var n = () => {
    };
    var s = () => {
    };
  }
});

// src/dependencies/74212.cjs
var require__43 = __commonJS({
  "src/dependencies/74212.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      i: () => n
    });
    var n = (t) => /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(t);
  }
});

// src/dependencies/39896.cjs
var require__44 = __commonJS({
  "src/dependencies/39896.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      j4: () => s,
      pG: () => o,
      rm: () => l
    });
    var n = (t) => (e) => "string" == typeof e && e.startsWith(t);
    var s = n("--");
    var r = n("var(--");
    var o = (t) => !!r(t) && a.test(t.split("/*")[0].trim());
    var a = /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu;
    function l(t) {
      return "string" == typeof t && t.split("/*")[0].includes("var(--");
    }
  }
});

// src/dependencies/58974.cjs
var require__45 = __commonJS({
  "src/dependencies/58974.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      $: () => n
    });
    var n = (t) => /^0[^.\s]+$/u.test(t);
  }
});

// src/dependencies/21023.cjs
var require__46 = __commonJS({
  "src/dependencies/21023.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      J: () => l
    });
    var n = require__31();
    var s = require__32();
    var r = require__33();
    var o = require__36();
    var a = /* @__PURE__ */ new Set([s.p, r.d]);
    function l(t, e) {
      let i = (0, o.D)(t);
      return a.has(i) || (i = n.f), i.getAnimatableNone ? i.getAnimatableNone(e) : void 0;
    }
  }
});

// src/dependencies/11698.cjs
var require__47 = __commonJS({
  "src/dependencies/11698.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      Ib: () => c,
      ry: () => d,
      zs: () => u
    });
    var n = (t) => 180 * t / Math.PI;
    var s = (t) => o(n(Math.atan2(t[1], t[0])));
    var r = {
      x: 4,
      y: 5,
      translateX: 4,
      translateY: 5,
      scaleX: 0,
      scaleY: 3,
      scale: (t) => (Math.abs(t[0]) + Math.abs(t[3])) / 2,
      rotate: s,
      rotateZ: s,
      skewX: (t) => n(Math.atan(t[1])),
      skewY: (t) => n(Math.atan(t[2])),
      skew: (t) => (Math.abs(t[1]) + Math.abs(t[2])) / 2
    };
    var o = (t) => ((t %= 360) < 0 && (t += 360), t);
    var a = (t) => Math.sqrt(t[0] * t[0] + t[1] * t[1]);
    var l = (t) => Math.sqrt(t[4] * t[4] + t[5] * t[5]);
    var h = {
      x: 12,
      y: 13,
      z: 14,
      translateX: 12,
      translateY: 13,
      translateZ: 14,
      scaleX: a,
      scaleY: l,
      scale: (t) => (a(t) + l(t)) / 2,
      rotateX: (t) => o(n(Math.atan2(t[6], t[5]))),
      rotateY: (t) => o(n(Math.atan2(-t[2], t[0]))),
      rotateZ: s,
      rotate: s,
      skewX: (t) => n(Math.atan(t[4])),
      skewY: (t) => n(Math.atan(t[1])),
      skew: (t) => (Math.abs(t[1]) + Math.abs(t[4])) / 2
    };
    function u(t) {
      return +!!t.includes("scale");
    }
    function d(t, e) {
      let i, n2;
      if (!t || "none" === t) return u(e);
      let s2 = t.match(/^matrix3d\(([-\d.e\s,]+)\)$/u);
      if (s2) i = h, n2 = s2;
      else {
        let e2 = t.match(/^matrix\(([-\d.e\s,]+)\)$/u);
        i = r, n2 = e2;
      }
      if (!n2) return u(e);
      let o2 = i[e], a2 = n2[1].split(",").map(p);
      return "function" == typeof o2 ? o2(a2) : a2[o2];
    }
    var c = (t, e) => {
      let {
        transform: i = "none"
      } = getComputedStyle(t);
      return d(i, e);
    };
    function p(t) {
      return parseFloat(t.trim());
    }
  }
});

// src/dependencies/32766.cjs
var require__48 = __commonJS({
  "src/dependencies/32766.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      E4: () => a,
      Hr: () => p,
      W9: () => u,
      dB: () => d
    });
    var n = require__47();
    var s = require__20();
    var r = require__22();
    var o = require__28();
    var a = (t) => t === r.ai || t === o.px;
    var l = /* @__PURE__ */ new Set(["x", "y", "z"]);
    var h = s.U.filter((t) => !l.has(t));
    function u(t) {
      let e = [];
      return h.forEach((i) => {
        let n2 = t.getValue(i);
        if (void 0 !== n2) {
          let t2 = n2.get(), s2 = +!!i.startsWith("scale");
          if (t2 === s2) return;
          e.push([i, t2]), n2.set(s2);
        }
      }), e;
    }
    var d = /* @__PURE__ */ new Set(["bottom", "right"]);
    function c(t, e, i, n2, s2, r2) {
      let o2 = parseFloat(t);
      if (!isNaN(o2)) return o2;
      let {
        min: a2,
        max: l2
      } = e()[i], h2 = l2 - a2;
      return "border-box" === r2 ? h2 : h2 - parseFloat(n2) - parseFloat(s2);
    }
    var p = {
      width: ({
        width: t,
        paddingLeft: e = "0",
        paddingRight: i = "0",
        boxSizing: n2
      }, s2) => c(t, s2, "x", e, i, n2),
      height: ({
        height: t,
        paddingTop: e = "0",
        paddingBottom: i = "0",
        boxSizing: n2
      }, s2) => c(t, s2, "y", e, i, n2),
      top: ({
        top: t
      }) => parseFloat(t),
      left: ({
        left: t
      }) => parseFloat(t),
      bottom: ({
        top: t
      }, e) => {
        let {
          y: i
        } = e();
        return parseFloat(t) + (i.max - i.min);
      },
      right: ({
        left: t
      }, e) => {
        let {
          x: i
        } = e();
        return parseFloat(t) + (i.max - i.min);
      },
      x: ({
        transform: t
      }) => (0, n.ry)(t, "x"),
      y: ({
        transform: t
      }) => (0, n.ry)(t, "y")
    };
    p.translateX = p.x, p.translateY = p.y;
  }
});

// src/dependencies/72025.cjs
var require__49 = __commonJS({
  "src/dependencies/72025.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      l: () => n
    });
    var n = (t) => t;
  }
});

// src/dependencies/28153.cjs
var require__50 = __commonJS({
  "src/dependencies/28153.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      W: () => n
    });
    var n = {};
  }
});

// src/dependencies/57835.cjs
var require__51 = __commonJS({
  "src/dependencies/57835.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      I: () => r
    });
    var n = require__50();
    var s = ["setup", "read", "resolveKeyframes", "preUpdate", "update", "preRender", "render", "postRender"];
    function r(t, e) {
      let i = false, r2 = true, o = {
        delta: 0,
        timestamp: 0,
        isProcessing: false
      }, a = () => i = true, l = s.reduce((t2, e2) => (t2[e2] = /* @__PURE__ */ (function(t3) {
        let e3 = /* @__PURE__ */ new Set(), i2 = /* @__PURE__ */ new Set(), n2 = false, s2 = false, r3 = /* @__PURE__ */ new Set(), o2 = {
          delta: 0,
          timestamp: 0,
          isProcessing: false
        };
        function a2(e4) {
          r3.has(e4) && (i2.add(e4), t3()), e4(o2);
        }
        let l2 = {
          schedule: (t4, s3 = false, o3 = false) => {
            let a3 = o3 && n2 ? e3 : i2;
            return s3 && r3.add(t4), a3.add(t4), t4;
          },
          cancel: (t4) => {
            i2.delete(t4), r3.delete(t4);
          },
          process: (t4) => {
            if (o2 = t4, n2) {
              s2 = true;
              return;
            }
            n2 = true;
            let r4 = e3;
            e3 = i2, i2 = r4, e3.forEach(a2), e3.clear(), n2 = false, s2 && (s2 = false, l2.process(t4));
          }
        };
        return l2;
      })(a), t2), {}), {
        setup: h,
        read: u,
        resolveKeyframes: d,
        preUpdate: c,
        update: p,
        preRender: m,
        render: f,
        postRender: v
      } = l, y = () => {
        let s2 = n.W.useManualTiming, a2 = s2 ? o.timestamp : performance.now();
        i = false, s2 || (o.delta = r2 ? 1e3 / 60 : Math.max(Math.min(a2 - o.timestamp, 40), 1)), o.timestamp = a2, o.isProcessing = true, h.process(o), u.process(o), d.process(o), c.process(o), p.process(o), m.process(o), f.process(o), v.process(o), o.isProcessing = false, i && e && (r2 = false, t(y));
      };
      return {
        schedule: s.reduce((e2, n2) => {
          let s2 = l[n2];
          return e2[n2] = (e3, n3 = false, a2 = false) => (!i && (i = true, r2 = true, o.isProcessing || t(y)), s2.schedule(e3, n3, a2)), e2;
        }, {}),
        cancel: (t2) => {
          for (let e2 = 0; e2 < s.length; e2++) l[s[e2]].cancel(t2);
        },
        state: o,
        steps: l
      };
    }
  }
});

// src/dependencies/27933.cjs
var require__52 = __commonJS({
  "src/dependencies/27933.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      Gt: () => s,
      PP: () => a,
      WG: () => r,
      uv: () => o
    });
    var n = require__49();
    var {
      schedule: s,
      cancel: r,
      state: o,
      steps: a
    } = (0, require__51().I)("u" > typeof requestAnimationFrame ? requestAnimationFrame : n.l, true);
  }
});

// src/dependencies/4132.cjs
var require__53 = __commonJS({
  "src/dependencies/4132.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      h: () => v,
      q: () => f
    });
    var n = require__43();
    var s = require__45();
    var r = require__31();
    var o = require__46();
    var a = require__48();
    var l = require__52();
    var h = /* @__PURE__ */ new Set();
    var u = false;
    var d = false;
    var c = false;
    function p() {
      if (d) {
        let t = [], e = /* @__PURE__ */ new Set(), i = /* @__PURE__ */ new Set();
        h.forEach((n3) => {
          n3.needsMeasurement && (t.push(n3), e.add(n3.element), a.dB.has(n3.name) && i.add(n3.element));
        });
        let n2 = /* @__PURE__ */ new Map();
        i.forEach((t2) => {
          let e2 = (0, a.W9)(t2);
          e2.length && (n2.set(t2, e2), t2.render());
        }), t.forEach((t2) => t2.measureInitialState()), e.forEach((t2) => {
          t2.render();
          let e2 = n2.get(t2);
          e2 && e2.forEach(([e3, i2]) => {
            t2.getValue(e3)?.set(i2);
          });
        }), t.forEach((t2) => t2.measureEndState()), t.forEach((t2) => {
          void 0 !== t2.suspendedScrollY && window.scrollTo(0, t2.suspendedScrollY);
        });
      }
      d = false, u = false, h.forEach((t) => t.complete(c)), h.clear();
    }
    function m() {
      h.forEach((t) => {
        t.readKeyframes(), t.needsMeasurement && (d = true);
      });
    }
    function f() {
      c = true, m(), p(), c = false;
    }
    var v = class {
      constructor(t, e, i, n2, s2, r2 = false) {
        this.state = "pending", this.isAsync = false, this.needsMeasurement = false, this.unresolvedKeyframes = [...t], this.onComplete = e, this.name = i, this.motionValue = n2, this.element = s2, this.isAsync = r2;
      }
      scheduleResolve() {
        this.state = "scheduled", this.isAsync ? (h.add(this), u || (u = true, l.Gt.read(m), l.Gt.resolveKeyframes(p))) : (this.readKeyframes(), this.complete());
      }
      readKeyframes() {
        let {
          unresolvedKeyframes: t,
          name: e,
          element: i,
          motionValue: a2
        } = this;
        if (null === t[0]) {
          let l2 = a2?.get(), h2 = t[t.length - 1];
          if (void 0 !== l2) t[0] = l2;
          else if (i && e) {
            let a3 = (function(t2, e2, i2) {
              if ("string" == typeof t2) {
                if ((0, n.i)(t2) || (0, s.$)(t2)) return parseFloat(t2);
                else if (!r.f.test(t2) && r.f.test(i2)) return (0, o.J)(e2, i2);
              }
              return t2 ?? void 0;
            })(i.readValue(e, h2), e, h2);
            void 0 !== a3 && (t[0] = a3);
          }
          void 0 === t[0] && (t[0] = h2), a2 && void 0 === l2 && a2.set(t[0]);
        }
        for (let e2 = 1; e2 < t.length; e2++) t[e2] ?? (t[e2] = t[e2 - 1]);
      }
      setFinalKeyframe() {
      }
      measureInitialState() {
      }
      renderEndStyles() {
      }
      measureEndState() {
      }
      complete(t = false) {
        this.state = "complete", this.onComplete(this.unresolvedKeyframes, this.finalKeyframe, t), h.delete(this);
      }
      cancel() {
        "scheduled" === this.state && (h.delete(this), this.state = "pending");
      }
      resume() {
        "pending" === this.state && this.scheduleResolve();
      }
    };
  }
});

// src/dependencies/96653.cjs
var require__54 = __commonJS({
  "src/dependencies/96653.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      K: () => g
    });
    var n = require__39();
    var s = require__22();
    var r = require__28();
    var o = [s.ai, r.px, r.KN, r.uj, r.vw, r.vh, {
      test: (t) => "auto" === t,
      parse: (t) => t
    }];
    var a = (t) => o.find((e) => e.test(t));
    var l = require__42();
    var h = require__43();
    var u = require__44();
    var d = /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u;
    var c = require__53();
    var p = require__45();
    var m = require__31();
    var f = require__46();
    var v = /* @__PURE__ */ new Set(["auto", "none", "0"]);
    var y = require__48();
    var g = class extends c.h {
      constructor(t, e, i, n2, s2) {
        super(t, e, i, n2, s2, true);
      }
      readKeyframes() {
        let {
          unresolvedKeyframes: t,
          element: e,
          name: i
        } = this;
        if (!e || !e.current) return;
        super.readKeyframes();
        for (let i2 = 0; i2 < t.length; i2++) {
          let n2 = t[i2];
          if ("string" == typeof n2 && (n2 = n2.trim(), (0, u.pG)(n2))) {
            let s3 = (function t2(e2, i3, n3 = 1) {
              (0, l.V)(n3 <= 4, `Max CSS variable fallback depth detected in property "${e2}". This may indicate a circular fallback dependency.`, "max-css-var-depth");
              let [s4, r3] = (function(t3) {
                let e3 = d.exec(t3);
                if (!e3) return [,];
                let [, i4, n4, s5] = e3;
                return [`--${i4 ?? n4}`, s5];
              })(e2);
              if (!s4) return;
              let o3 = window.getComputedStyle(i3).getPropertyValue(s4);
              if (o3) {
                let t3 = o3.trim();
                return (0, h.i)(t3) ? parseFloat(t3) : t3;
              }
              return (0, u.pG)(r3) ? t2(r3, i3, n3 + 1) : r3;
            })(n2, e.current);
            void 0 !== s3 && (t[i2] = s3), i2 === t.length - 1 && (this.finalKeyframe = n2);
          }
        }
        if (this.resolveNoneKeyframes(), !n.$.has(i) || 2 !== t.length) return;
        let [s2, r2] = t;
        if ("number" == typeof s2 && "number" == typeof r2) return;
        let o2 = a(s2), c2 = a(r2);
        if ((0, u.rm)(s2) !== (0, u.rm)(r2) && y.Hr[i]) {
          this.needsMeasurement = true;
          return;
        }
        if (o2 !== c2) if ((0, y.E4)(o2) && (0, y.E4)(c2)) for (let e2 = 0; e2 < t.length; e2++) {
          let i2 = t[e2];
          "string" == typeof i2 && (t[e2] = parseFloat(i2));
        }
        else y.Hr[i] && (this.needsMeasurement = true);
      }
      resolveNoneKeyframes() {
        let {
          unresolvedKeyframes: t,
          name: e
        } = this, i = [];
        for (let e2 = 0; e2 < t.length; e2++) {
          var n2;
          (null === t[e2] || ("number" == typeof (n2 = t[e2]) ? 0 === n2 : null === n2 || "none" === n2 || "0" === n2 || (0, p.$)(n2))) && i.push(e2);
        }
        i.length && (function(t2, e2, i2) {
          let n3, s2 = 0;
          for (; s2 < t2.length && !n3; ) {
            let e3 = t2[s2];
            "string" == typeof e3 && !v.has(e3) && (0, m.nK)(e3) && (n3 = t2[s2]), s2++;
          }
          if (n3 && i2) for (let s3 of e2) t2[s3] !== n3 && (t2[s3] = (0, f.J)(i2, n3));
        })(t, i, e);
      }
      measure() {
        let {
          element: t,
          name: e
        } = this;
        return y.Hr[e](window.getComputedStyle(t.current), () => t.measureViewportBox());
      }
      measureInitialState() {
        let {
          element: t,
          unresolvedKeyframes: e,
          name: i
        } = this;
        if (!t || !t.current) return;
        "height" === i && (this.suspendedScrollY = window.pageYOffset), this.measuredOrigin = this.measure(), e[0] = this.measuredOrigin;
        let n2 = e[e.length - 1];
        void 0 !== n2 && this.motionValue?.jump(n2, false);
      }
      measureEndState() {
        let {
          element: t,
          unresolvedKeyframes: e
        } = this;
        if (!t || !t.current) return;
        this.motionValue?.jump(this.measuredOrigin, false);
        let i = e.length - 1, n2 = e[i];
        e[i] = this.measure(), null !== n2 && void 0 === this.finalKeyframe && (this.finalKeyframe = n2), this.removedTransforms?.length && this.removedTransforms.forEach(([e2, i2]) => {
          t.getValue(e2).set(i2);
        }), this.resolveNoneKeyframes();
      }
    };
  }
});

// src/dependencies/38621.cjs
var require__55 = __commonJS({
  "src/dependencies/38621.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      X: () => s,
      f: () => n
    });
    var n = (t) => 1e3 * t;
    var s = (t) => t / 1e3;
  }
});

// src/dependencies/78170.cjs
var require__56 = __commonJS({
  "src/dependencies/78170.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    function n(t, e) {
      -1 === t.indexOf(e) && t.push(e);
    }
    function s(t, e) {
      let i = t.indexOf(e);
      i > -1 && t.splice(i, 1);
    }
    function r([...t], e, i) {
      let n2 = e < 0 ? t.length + e : e;
      if (n2 >= 0 && n2 < t.length) {
        let n3 = i < 0 ? t.length + i : i, [s2] = t.splice(e, 1);
        t.splice(n3, 0, s2);
      }
      return t;
    }
    interop.d(exports, {
      Ai: () => s,
      Kq: () => n,
      Pe: () => r
    });
  }
});

// src/dependencies/73852.cjs
var require__57 = __commonJS({
  "src/dependencies/73852.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      v: () => s
    });
    var n = require__56();
    var s = class {
      constructor() {
        this.subscriptions = [];
      }
      add(t) {
        return (0, n.Kq)(this.subscriptions, t), () => this.remove(t);
      }
      remove(t) {
        (0, n.Ai)(this.subscriptions, t);
      }
      notify(t, e, i) {
        let n2 = this.subscriptions.length;
        if (n2) if (1 === n2) this.subscriptions[0](t, e, i);
        else for (let s2 = 0; s2 < n2; s2++) {
          let n3 = this.subscriptions[s2];
          n3 && n3(t, e, i);
        }
      }
      getSize() {
        return this.subscriptions.length;
      }
      clear() {
        this.subscriptions.length = 0;
      }
    };
  }
});

// src/dependencies/73516.cjs
var require__58 = __commonJS({
  "src/dependencies/73516.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      v: () => n
    });
    var n = (t) => t.startsWith("--");
  }
});

// src/dependencies/94980.cjs
var require__59 = __commonJS({
  "src/dependencies/94980.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      e: () => s
    });
    var n = require__58();
    function s(t, e, i) {
      (0, n.v)(e) ? t.style.setProperty(e, i) : t.style[e] = i;
    }
  }
});

// src/dependencies/96291.cjs
var require__60 = __commonJS({
  "src/dependencies/96291.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      p: () => n
    });
    function n(t) {
      let e;
      return () => (void 0 === e && (e = t()), e);
    }
  }
});

// src/dependencies/7145.cjs
var require__61 = __commonJS({
  "src/dependencies/7145.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      J: () => r
    });
    var n = require__60();
    var s = {};
    function r(t, e) {
      let i = (0, n.p)(t);
      return () => s[e] ?? i();
    }
  }
});

// src/dependencies/69166.cjs
var require__62 = __commonJS({
  "src/dependencies/69166.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      J: () => s,
      d: () => r
    });
    var n = require__61();
    var s = (0, n.J)(() => void 0 !== window.ScrollTimeline, "scrollTimeline");
    var r = (0, n.J)(() => void 0 !== window.ViewTimeline, "viewTimeline");
  }
});

// src/dependencies/47736.cjs
var require__63 = __commonJS({
  "src/dependencies/47736.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      X: () => s
    });
    var n = (t) => null !== t;
    function s(t, {
      repeat: e,
      repeatType: i = "loop"
    }, r, o = 1) {
      let a = t.filter(n), l = o < 0 || e && "loop" !== i && e % 2 == 1 ? 0 : a.length - 1;
      return l && void 0 !== r ? r : a[l];
    }
  }
});

// src/dependencies/40660.cjs
var require__64 = __commonJS({
  "src/dependencies/40660.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      q: () => n
    });
    var n = class {
      constructor() {
        this.isResolved = false;
      }
      get finished() {
        return this._finished || (this._finished = this.isResolved ? Promise.resolve() : new Promise((t) => {
          this._resolve = t;
        })), this._finished;
      }
      updateFinished() {
        this._finished = this._resolve = void 0, this.isResolved = false;
      }
      notifyFinished() {
        this.isResolved = true, this._resolve?.();
      }
      then(t, e) {
        return this.finished.then(t, e);
      }
    };
  }
});

// src/dependencies/37035.cjs
var require__65 = __commonJS({
  "src/dependencies/37035.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    var n;
    interop.d(exports, {
      k: () => a
    });
    var s = require__50();
    var r = require__52();
    function o() {
      n = void 0;
    }
    var a = {
      now: () => (void 0 === n && a.set(r.uv.isProcessing || s.W.useManualTiming ? r.uv.timestamp : performance.now()), n),
      set: (t) => {
        n = t, queueMicrotask(o);
      }
    };
  }
});

// src/dependencies/14432.cjs
var require__66 = __commonJS({
  "src/dependencies/14432.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      U: () => o,
      m: () => a
    });
    var n = require__52();
    var s = require__65();
    function r(t, e) {
      return {
        kind: t,
        animation: e,
        timestamp: s.k.now(),
        frameTimestamp: n.uv.timestamp,
        frameIsProcessing: n.uv.isProcessing
      };
    }
    function o(t, e, i) {
      let n2 = globalThis.__MOTION_INSPECT__;
      if (n2) try {
        n2({
          ...r("animation-start", t),
          options: i ? {
            ...e,
            ...i
          } : e
        });
      } catch {
      }
    }
    function a(t, e) {
      let i = globalThis.__MOTION_INSPECT__;
      if (i) try {
        i({
          ...r("layout-animation-start", t),
          node: e
        });
      } catch {
      }
    }
  }
});

// src/dependencies/9331.cjs
var require__67 = __commonJS({
  "src/dependencies/9331.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      D: () => n
    });
    var n = (t) => Array.isArray(t) && "number" == typeof t[0];
  }
});

// src/dependencies/78987.cjs
var require__68 = __commonJS({
  "src/dependencies/78987.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      K: () => n
    });
    var n = (t, e, i = 10) => {
      let n2 = "", s = Math.max(Math.round(e / i), 2);
      for (let e2 = 0; e2 < s; e2++) n2 += Math.round(1e4 * t(e2 / (s - 1))) / 1e4 + ", ";
      return `linear(${n2.substring(0, n2.length - 2)})`;
    };
  }
});

// src/dependencies/70954.cjs
var require__69 = __commonJS({
  "src/dependencies/70954.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      W: () => n
    });
    function n(t) {
      return "function" == typeof t && "applyToOptions" in t;
    }
  }
});

// src/dependencies/3486.cjs
var require__70 = __commonJS({
  "src/dependencies/3486.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      m: () => y
    });
    var n = require__42();
    var s = require__55();
    var r = require__49();
    var o = require__59();
    var a = require__62();
    var l = require__63();
    var h = require__64();
    var u = require__66();
    var d = require__67();
    var c = (0, require__61().J)(() => {
      try {
        document.createElement("div").animate({
          opacity: 0
        }, {
          easing: "linear(0, 1)"
        });
      } catch (t) {
        return false;
      }
      return true;
    }, "linearEasing");
    var p = require__68();
    var m = ([t, e, i, n2]) => `cubic-bezier(${t}, ${e}, ${i}, ${n2})`;
    var f = {
      linear: "linear",
      ease: "ease",
      easeIn: "ease-in",
      easeOut: "ease-out",
      easeInOut: "ease-in-out",
      circIn: m([0, 0.65, 0.55, 1]),
      circOut: m([0.55, 0, 1, 0.45]),
      backIn: m([0.31, 0.01, 0.66, -0.59]),
      backOut: m([0.33, 1.53, 0.69, 0.99])
    };
    var v = require__69();
    var y = class extends h.q {
      constructor(t) {
        if (super(), this.finishedTime = null, this.isStopped = false, this.manualStartTime = null, !t) return;
        const {
          element: e,
          name: i,
          keyframes: s2,
          pseudoElement: r2,
          allowFlatten: a2 = false,
          finalKeyframe: h2,
          onComplete: y2
        } = t;
        this.isPseudoElement = !!r2, this.allowFlatten = a2, this.options = t, (0, n.V)("string" != typeof t.type, `Mini animate() doesn't support "type" as a string.`, "mini-spring");
        const g = (function({
          type: t2,
          ...e2
        }) {
          return (0, v.W)(t2) && c() ? t2.applyToOptions(e2) : (e2.duration ?? (e2.duration = 300), e2.ease ?? (e2.ease = "easeOut"), e2);
        })(t);
        this.animation = (function(t2, e2, i2, {
          delay: n2 = 0,
          duration: s3 = 300,
          repeat: r3 = 0,
          repeatType: o2 = "loop",
          ease: a3 = "easeOut",
          times: l2
        } = {}, h3) {
          let u2 = {
            [e2]: i2
          };
          l2 && (u2.offset = l2);
          let v2 = (function t3(e3, i3) {
            if (e3) return "function" == typeof e3 ? c() ? (0, p.K)(e3, i3) : "ease-out" : (0, d.D)(e3) ? m(e3) : Array.isArray(e3) ? e3.map((e4) => t3(e4, i3) || f.easeOut) : f[e3];
          })(a3, s3);
          Array.isArray(v2) && (u2.easing = v2);
          let y3 = {
            delay: n2,
            duration: s3,
            easing: Array.isArray(v2) ? "linear" : v2,
            fill: "both",
            iterations: r3 + 1,
            direction: "reverse" === o2 ? "alternate" : "normal"
          };
          return h3 && (y3.pseudoElement = h3), t2.animate(u2, y3);
        })(e, i, s2, g, r2), false === g.autoplay && this.animation.pause(), this.animation.onfinish = () => {
          if (this.finishedTime = this.time, !r2) {
            let t2 = (0, l.X)(s2, this.options, h2, this.speed);
            this.updateMotionValue && this.updateMotionValue(t2), (0, o.e)(e, i, t2), this.animation.cancel();
          }
          y2?.(), this.notifyFinished();
        }, (0, u.U)(this, t, g);
      }
      play() {
        this.isStopped || (this.manualStartTime = null, this.animation.play(), "finished" === this.state && this.updateFinished());
      }
      pause() {
        this.animation.pause();
      }
      complete() {
        this.animation.finish?.();
      }
      cancel() {
        try {
          this.animation.cancel();
        } catch (t) {
        }
      }
      stop() {
        if (this.isStopped) return;
        this.isStopped = true;
        let {
          state: t
        } = this;
        "idle" !== t && "finished" !== t && (this.updateMotionValue ? this.updateMotionValue() : this.commitStyles(), this.isPseudoElement || this.cancel());
      }
      commitStyles() {
        let t = this.options?.element;
        !this.isPseudoElement && t?.isConnected && this.animation.commitStyles?.();
      }
      get duration() {
        let t = this.animation.effect?.getComputedTiming?.().duration || 0;
        return (0, s.X)(Number(t));
      }
      get iterationDuration() {
        let {
          delay: t = 0
        } = this.options || {};
        return this.duration + (0, s.X)(t);
      }
      get time() {
        return (0, s.X)(Number(this.animation.currentTime) || 0);
      }
      set time(t) {
        let e = null !== this.finishedTime;
        this.manualStartTime = null, this.finishedTime = null, this.animation.currentTime = (0, s.f)(t), e && this.animation.pause();
      }
      get speed() {
        return this.animation.playbackRate;
      }
      set speed(t) {
        t < 0 && (this.finishedTime = null), this.animation.playbackRate = t;
      }
      get state() {
        return null !== this.finishedTime ? "finished" : this.animation.playState;
      }
      get startTime() {
        return this.manualStartTime ?? Number(this.animation.startTime);
      }
      set startTime(t) {
        this.manualStartTime = this.animation.startTime = t;
      }
      attachTimeline({
        timeline: t,
        rangeStart: e,
        rangeEnd: i,
        observe: n2
      }) {
        return (this.allowFlatten && this.animation.effect?.updateTiming({
          easing: "linear"
        }), this.animation.onfinish = null, t && (0, a.J)()) ? (this.animation.timeline = t, e && (this.animation.rangeStart = e), i && (this.animation.rangeEnd = i), r.l) : n2(this);
      }
    };
  }
});

// src/dependencies/58584.cjs
var require__71 = __commonJS({
  "src/dependencies/58584.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      M: () => n
    });
    var n = /* @__PURE__ */ new Set(["opacity", "clipPath", "filter", "transform", "backgroundColor"]);
  }
});

// src/dependencies/38873.cjs
var require__72 = __commonJS({
  "src/dependencies/38873.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      c: () => s,
      k: () => n
    });
    var {
      schedule: n,
      cancel: s
    } = (0, require__51().I)(queueMicrotask, false);
  }
});

// src/dependencies/79537.cjs
var require__73 = __commonJS({
  "src/dependencies/79537.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      f: () => n
    });
    var n = (t, e) => e ? 1e3 / e * t : 0;
  }
});

// src/dependencies/6900.cjs
var require__74 = __commonJS({
  "src/dependencies/6900.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      KG: () => l,
      OQ: () => h,
      bt: () => a
    });
    var n = require__57();
    var s = require__73();
    var r = require__65();
    var o = require__52();
    var a = {
      current: void 0
    };
    var l = class {
      constructor(t, e = {}) {
        this.canTrackVelocity = null, this.events = {}, this.updateAndNotify = (t2) => {
          let e2 = r.k.now();
          if (this.updatedAt !== e2 && this.setPrevFrameValue(), this.prev = this.current, this.setCurrent(t2), this.current !== this.prev && (this.notifyChange(), this.dependents)) for (let t3 of this.dependents) t3.dirty();
        }, this.hasAnimated = false, this.setCurrent(t), this.owner = e.owner;
      }
      setCurrent(t) {
        this.current = t, this.updatedAt = r.k.now(), null === this.canTrackVelocity && void 0 !== t && (this.canTrackVelocity = !isNaN(parseFloat(this.current)));
      }
      setPrevFrameValue(t = this.current) {
        this.prevFrameValue = t, this.prevUpdatedAt = this.updatedAt;
      }
      onChange(t) {
        return this.on("change", t);
      }
      on(t, e) {
        var i;
        return "change" === t ? this.onChangeSubscribe(e) : ((i = this.events)[t] || (i[t] = new n.v())).add(e);
      }
      onChangeSubscribe(t) {
        let {
          events: e
        } = this;
        return e.change || this.changeSubscriber ? (e.change || (e.change = new n.v(), e.change.add(this.changeSubscriber), this.changeSubscriber = void 0), e.change.add(t)) : this.changeSubscriber = t, () => {
          this.changeSubscriber === t ? this.changeSubscriber = void 0 : e.change?.remove(t), this.stopIfUnobserved();
        };
      }
      stopIfUnobserved() {
        o.Gt.read(() => {
          this.changeSubscriber || this.events.change?.getSize() || this.stop();
        });
      }
      clearListeners() {
        for (let t in this.changeSubscriber = void 0, this.events) this.events[t].clear();
      }
      attach(t, e) {
        this.passiveEffect = t, this.stopPassiveEffect = e;
      }
      set(t) {
        this.passiveEffect ? this.passiveEffect(t, this.updateAndNotify) : this.updateAndNotify(t);
      }
      setWithVelocity(t, e, i) {
        this.set(e), this.prev = void 0, this.prevFrameValue = t, this.prevUpdatedAt = this.updatedAt - i;
      }
      jump(t, e = true) {
        this.updateAndNotify(t), this.prev = t, this.prevUpdatedAt = this.prevFrameValue = void 0, e && this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
      }
      dirty() {
        this.notifyChange();
      }
      notifyChange() {
        let {
          current: t,
          changeSubscriber: e
        } = this;
        e ? e(t) : this.events.change?.notify(t);
      }
      addDependent(t) {
        this.dependents || (this.dependents = /* @__PURE__ */ new Set()), this.dependents.add(t);
      }
      removeDependent(t) {
        this.dependents && this.dependents.delete(t);
      }
      get() {
        return a.current && a.current.push(this), this.current;
      }
      getPrevious() {
        return this.prev;
      }
      getVelocity() {
        let t = r.k.now();
        if (!this.canTrackVelocity || void 0 === this.prevFrameValue || t - this.updatedAt > 30) return 0;
        let e = Math.min(this.updatedAt - this.prevUpdatedAt, 30);
        return (0, s.f)(parseFloat(this.current) - parseFloat(this.prevFrameValue), e);
      }
      start(t) {
        return this.stop(), new Promise((e) => {
          let i;
          this.hasAnimated = true;
          let n2 = false;
          i = t(() => {
            n2 = true, this.events.animationComplete?.notify(), this.animation === i && this.clearAnimation(), e();
          }), n2 || (this.animation = i), this.events.animationStart?.notify();
        });
      }
      stop() {
        this.animation && (this.animation.stop(), this.events.animationCancel && this.events.animationCancel.notify()), this.clearAnimation();
      }
      isAnimating() {
        return !!this.animation;
      }
      clearAnimation() {
        this.animation = void 0;
      }
      destroy() {
        this.dependents?.clear(), this.events.destroy?.notify(), this.clearListeners(), this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
      }
    };
    function h(t, e) {
      return new l(t, e);
    }
  }
});

// src/dependencies/51654.cjs
var require__75 = __commonJS({
  "src/dependencies/51654.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      C: () => n
    });
    var n = /* @__PURE__ */ new WeakMap();
  }
});

// src/dependencies/26087.cjs
var require__76 = __commonJS({
  "src/dependencies/26087.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      N: () => n
    });
    function n(t) {
      return null !== t && "object" == typeof t && "function" == typeof t.start;
    }
  }
});

// src/dependencies/63290.cjs
var require__77 = __commonJS({
  "src/dependencies/63290.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      w: () => n
    });
    function n(t) {
      return "string" == typeof t || Array.isArray(t);
    }
  }
});

// src/dependencies/51129.cjs
var require__78 = __commonJS({
  "src/dependencies/51129.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      U: () => n,
      _: () => s
    });
    var n = ["animate", "whileInView", "whileFocus", "whileHover", "whileTap", "whileDrag", "exit"];
    var s = ["initial", ...n];
  }
});

// src/dependencies/44616.cjs
var require__79 = __commonJS({
  "src/dependencies/44616.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      O: () => a,
      e: () => o
    });
    var n = require__76();
    var s = require__77();
    var r = require__78();
    function o(t) {
      if ((0, n.N)(t.animate)) return true;
      for (let e = 0; e < r._.length; e++) if ((0, s.w)(t[r._[e]])) return true;
      return false;
    }
    function a(t) {
      return !!(o(t) || t.variants);
    }
  }
});

// src/dependencies/25620.cjs
var require__80 = __commonJS({
  "src/dependencies/25620.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      O: () => n,
      r: () => s
    });
    var n = {
      current: null
    };
    var s = {
      current: false
    };
  }
});

// src/dependencies/10887.cjs
var require__81 = __commonJS({
  "src/dependencies/10887.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      Uu: () => r
    });
    var n = require__80();
    var s = "u" > typeof window;
    function r() {
      if (n.r.current = true, s) if (window.matchMedia) {
        let t = window.matchMedia("(prefers-reduced-motion)"), e = () => n.O.current = t.matches;
        t.addEventListener("change", e), e();
      } else n.O.current = false;
    }
  }
});

// src/dependencies/76792.cjs
var require__82 = __commonJS({
  "src/dependencies/76792.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    function n(t) {
      let e = [{}, {}];
      return t?.values.forEach((t2, i) => {
        e[0][i] = t2.get(), e[1][i] = t2.getVelocity();
      }), e;
    }
    function s(t, e, i, s2) {
      if ("function" == typeof e) {
        let [r, o] = n(s2);
        e = e(void 0 !== i ? i : t.custom, r, o);
      }
      if ("string" == typeof e && (e = t.variants && t.variants[e]), "function" == typeof e) {
        let [r, o] = n(s2);
        e = e(void 0 !== i ? i : t.custom, r, o);
      }
      return e;
    }
    interop.d(exports, {
      a: () => s
    });
  }
});

// src/dependencies/80171.cjs
var require__83 = __commonJS({
  "src/dependencies/80171.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      BX: () => V,
      vK: () => E,
      lr: () => k
    });
    var n = require__55();
    var s = require__43();
    var r = require__45();
    var o = require__57();
    var a = require__53();
    var l = require__70();
    var h = require__71();
    var u = require__72();
    var d = require__65();
    var c = require__37();
    var p = require__74();
    var m = require__31();
    var f = require__46();
    var v = require__38();
    var y = require__75();
    var g = require__79();
    var x = require__20();
    var w = require__81();
    var S = require__82();
    var b = require__80();
    var T = require__52();
    var P = ["AnimationStart", "AnimationComplete", "Update", "BeforeLayoutMeasure", "LayoutMeasure", "LayoutAnimationStart", "LayoutAnimationComplete"];
    var A = {};
    function k(t) {
      A = t;
    }
    function E() {
      return A;
    }
    var V = class {
      scrapeMotionValuesFromProps(t, e, i) {
        return {};
      }
      constructor({
        parent: t,
        props: e,
        presenceContext: i,
        reducedMotionConfig: n2,
        skipAnimations: s2,
        blockInitialAnimation: r2,
        visualState: o2
      }, l2 = {}) {
        this.current = null, this.children = /* @__PURE__ */ new Set(), this.isVariantNode = false, this.isControllingVariants = false, this.shouldReduceMotion = null, this.shouldSkipAnimations = false, this.values = /* @__PURE__ */ new Map(), this.KeyframeResolver = a.h, this.features = {}, this.valueSubscriptions = /* @__PURE__ */ new Map(), this.prevMotionValues = {}, this.hasBeenMounted = false, this.events = {}, this.propEventSubscriptions = {}, this.notifyUpdate = () => this.notify("Update", this.latestValues), this.render = () => {
          this.current && (this.triggerBuild(), this.renderInstance(this.current, this.renderState, this.props.style, this.projection));
        }, this.renderScheduledAt = 0, this.scheduleRender = () => {
          let t2 = d.k.now();
          this.renderScheduledAt < t2 && (this.renderScheduledAt = t2, T.Gt.render(this.render, false, true));
        };
        const {
          latestValues: h2,
          renderState: u2
        } = o2;
        this.latestValues = h2, this.baseTarget = {
          ...h2
        }, this.initialValues = e.initial ? {
          ...h2
        } : {}, this.renderState = u2, this.parent = t, this.props = e, this.presenceContext = i, this.depth = t ? t.depth + 1 : 0, this.reducedMotionConfig = n2, this.skipAnimationsConfig = s2, this.options = l2, this.blockInitialAnimation = !!r2, this.isControllingVariants = (0, g.e)(e), this.isVariantNode = (0, g.O)(e), this.isVariantNode && (this.variantChildren = /* @__PURE__ */ new Set()), this.manuallyAnimateOnMount = !!(t && t.current);
        const {
          willChange: c2,
          ...p2
        } = this.scrapeMotionValuesFromProps(e, {}, this);
        for (const t2 in p2) {
          const e2 = p2[t2];
          void 0 !== h2[t2] && (0, v.S)(e2) && e2.set(h2[t2]);
        }
      }
      mount(t) {
        if (this.hasBeenMounted) for (let t2 in this.initialValues) this.values.get(t2)?.jump(this.initialValues[t2]), this.latestValues[t2] = this.initialValues[t2];
        this.current = t, y.C.set(t, this), this.projection && !this.projection.instance && this.projection.mount(t), this.parent && this.isVariantNode && !this.isControllingVariants && (this.removeFromVariantTree = this.parent.addVariantChild(this)), this.values.forEach((t2, e) => this.bindToMotionValue(e, t2)), "never" === this.reducedMotionConfig ? this.shouldReduceMotion = false : "always" === this.reducedMotionConfig ? this.shouldReduceMotion = true : (b.r.current || (0, w.Uu)(), this.shouldReduceMotion = b.O.current), this.shouldSkipAnimations = this.skipAnimationsConfig ?? false, this.parent?.addChild(this), this.update(this.props, this.presenceContext), this.hasBeenMounted = true;
      }
      unmount() {
        for (let t in this.projection && this.projection.unmount(), (0, T.WG)(this.notifyUpdate), (0, T.WG)(this.render), this.valueSubscriptions.forEach((t2) => t2()), this.valueSubscriptions.clear(), this.removeFromVariantTree && this.removeFromVariantTree(), this.parent?.removeChild(this), this.events) this.events[t].clear();
        for (let t in this.features) {
          let e = this.features[t];
          e && (e.unmount(), e.isMounted = false);
        }
        this.current = null;
      }
      addChild(t) {
        this.children.add(t), this.enteringChildren ?? (this.enteringChildren = /* @__PURE__ */ new Set()), this.enteringChildren.add(t);
      }
      removeChild(t) {
        this.children.delete(t), this.enteringChildren && this.enteringChildren.delete(t);
      }
      bindToMotionValue(t, e) {
        let i;
        if (this.valueSubscriptions.has(t) && this.valueSubscriptions.get(t)(), e.accelerate && h.M.has(t) && this.current instanceof HTMLElement) {
          let {
            factory: i2,
            keyframes: s3,
            times: r3,
            ease: o2,
            duration: a2
          } = e.accelerate, h2 = new l.m({
            element: this.current,
            name: t,
            keyframes: s3,
            times: r3,
            ease: o2,
            duration: (0, n.f)(a2)
          }), u2 = i2(h2);
          this.valueSubscriptions.set(t, () => {
            u2(), h2.cancel();
          });
          return;
        }
        let s2 = x.f.has(t);
        s2 && this.onBindTransform && this.onBindTransform();
        let r2 = e.on("change", (e2) => {
          this.latestValues[t] = e2, this.props.onUpdate && T.Gt.preRender(this.notifyUpdate), s2 && this.projection && (this.projection.isTransformDirty = true), this.scheduleRender();
        });
        "u" > typeof window && window.MotionCheckAppearSync && (i = window.MotionCheckAppearSync(this, t, e)), this.valueSubscriptions.set(t, () => {
          r2(), i && i();
        });
      }
      sortNodePosition(t) {
        return this.current && this.sortInstanceNodePosition && this.type === t.type ? this.sortInstanceNodePosition(this.current, t.current) : 0;
      }
      updateFeatures() {
        let t = "animation";
        for (t in A) {
          let e = A[t];
          if (!e) continue;
          let {
            isEnabled: i,
            Feature: n2
          } = e;
          if (!this.features[t] && n2 && i(this.props) && (this.features[t] = new n2(this)), this.features[t]) {
            let e2 = this.features[t];
            e2.isMounted ? e2.update() : (e2.mount(), e2.isMounted = true);
          }
        }
      }
      triggerBuild() {
        this.build(this.renderState, this.latestValues, this.props);
      }
      measureViewportBox() {
        return this.current ? this.measureInstanceViewportBox(this.current, this.props) : (0, c.ge)();
      }
      getStaticValue(t) {
        return this.latestValues[t];
      }
      setStaticValue(t, e) {
        this.latestValues[t] = e;
      }
      update(t, e) {
        (t.transformTemplate || this.props.transformTemplate) && this.scheduleRender(), this.prevProps = this.props, this.props = t, this.prevPresenceContext = this.presenceContext, this.presenceContext = e;
        for (let e2 = 0; e2 < P.length; e2++) {
          let i = P[e2];
          this.propEventSubscriptions[i] && (this.propEventSubscriptions[i](), delete this.propEventSubscriptions[i]);
          let n2 = t["on" + i];
          n2 && (this.propEventSubscriptions[i] = this.on(i, n2));
        }
        this.prevMotionValues = (function(t2, e2, i) {
          for (let n2 in e2) {
            let s2 = e2[n2], r2 = i[n2];
            if ((0, v.S)(s2)) t2.addValue(n2, s2);
            else if ((0, v.S)(r2)) t2.addValue(n2, (0, p.OQ)(s2, {
              owner: t2
            }));
            else if (r2 !== s2) if (t2.hasValue(n2)) {
              let e3 = t2.getValue(n2);
              true === e3.liveStyle ? e3.jump(s2) : e3.hasAnimated || e3.set(s2);
            } else {
              let e3 = t2.getStaticValue(n2);
              t2.addValue(n2, (0, p.OQ)(void 0 !== e3 ? e3 : s2, {
                owner: t2
              }));
            }
          }
          for (let n2 in i) void 0 === e2[n2] && t2.removeValue(n2);
          return e2;
        })(this, this.scrapeMotionValuesFromProps(t, this.prevProps || {}, this), this.prevMotionValues), this.handleChildMotionValue && this.handleChildMotionValue();
      }
      getProps() {
        return this.props;
      }
      getVariant(t) {
        return this.props.variants ? this.props.variants[t] : void 0;
      }
      getDefaultTransition() {
        return this.props.transition;
      }
      getTransformPagePoint() {
        return this.props.transformPagePoint;
      }
      getClosestVariantNode() {
        return this.isVariantNode ? this : this.parent ? this.parent.getClosestVariantNode() : void 0;
      }
      addVariantChild(t) {
        let e = this.getClosestVariantNode();
        if (e) return e.variantChildren && e.variantChildren.add(t), () => e.variantChildren.delete(t);
      }
      addValue(t, e) {
        let i = this.values.get(t);
        e !== i && (i && this.removeValue(t), this.bindToMotionValue(t, e), this.values.set(t, e), this.latestValues[t] = e.get());
      }
      removeValue(t) {
        this.values.delete(t);
        let e = this.valueSubscriptions.get(t);
        e && (e(), this.valueSubscriptions.delete(t)), delete this.latestValues[t], this.removeValueFromRenderState(t, this.renderState);
      }
      hasValue(t) {
        return this.values.has(t);
      }
      getValue(t, e) {
        if (this.props.values && this.props.values[t]) return this.props.values[t];
        let i = this.values.get(t);
        return void 0 === i && void 0 !== e && (i = (0, p.OQ)(null === e ? void 0 : e, {
          owner: this
        }), this.addValue(t, i)), i;
      }
      readValue(t, e) {
        let i = void 0 === this.latestValues[t] && this.current ? this.getBaseTargetFromProps(this.props, t) ?? this.readValueFromInstance(this.current, t, this.options) : this.latestValues[t];
        return null != i && ("string" == typeof i && ((0, s.i)(i) || (0, r.$)(i)) ? i = parseFloat(i) : "number" != typeof i && !m.f.test(i) && m.f.test(e) && (i = (0, f.J)(t, e)), this.setBaseTarget(t, (0, v.S)(i) ? i.get() : i)), (0, v.S)(i) ? i.get() : i;
      }
      setBaseTarget(t, e) {
        this.baseTarget[t] = e;
      }
      getBaseTarget(t) {
        let e, {
          initial: i
        } = this.props;
        if ("string" == typeof i || "object" == typeof i) {
          let n3 = (0, S.a)(this.props, i, this.presenceContext?.custom);
          n3 && (e = n3[t]);
        }
        if (i && void 0 !== e) return e;
        let n2 = this.getBaseTargetFromProps(this.props, t);
        return void 0 === n2 || (0, v.S)(n2) ? void 0 !== this.initialValues[t] && void 0 === e ? void 0 : this.baseTarget[t] : n2;
      }
      on(t, e) {
        return this.events[t] || (this.events[t] = new o.v()), this.events[t].add(e);
      }
      notify(t, ...e) {
        this.events[t] && this.events[t].notify(...e);
      }
      scheduleRenderMicrotask() {
        u.k.render(this.render);
      }
    };
  }
});

// src/dependencies/15043.cjs
var require__84 = __commonJS({
  "src/dependencies/15043.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      I: () => n
    });
    function n(t) {
      return t.replace(/([A-Z])/g, (t2) => `-${t2.toLowerCase()}`);
    }
  }
});

// src/dependencies/87546.cjs
var require__85 = __commonJS({
  "src/dependencies/87546.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      e: () => n
    });
    var n = (t, e) => e && "number" == typeof t ? e.transform(t) : t;
  }
});

// src/dependencies/54714.cjs
var require__86 = __commonJS({
  "src/dependencies/54714.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      O: () => h
    });
    var n = require__85();
    var s = require__35();
    var r = require__20();
    var o = require__44();
    var a = {
      x: "translateX",
      y: "translateY",
      z: "translateZ",
      transformPerspective: "perspective"
    };
    var l = r.U.length;
    function h(t, e, i) {
      let {
        style: h2,
        vars: u,
        transformOrigin: d
      } = t, c = false, p = false;
      for (let t2 in e) {
        let i2 = e[t2];
        if (r.f.has(t2)) {
          c = true;
          continue;
        }
        if ((0, o.j4)(t2)) {
          u[t2] = i2;
          continue;
        }
        {
          let e2 = (0, n.e)(i2, s.W[t2]);
          t2.startsWith("origin") ? (p = true, d[t2] = e2) : h2[t2] = e2;
        }
      }
      if (!e.transform && (c || i ? h2.transform = (function(t2, e2, i2) {
        let o2 = "", h3 = true;
        for (let u3 = 0; u3 < l; u3++) {
          let l2 = r.U[u3], d2 = t2[l2];
          if (void 0 === d2) continue;
          let c2 = true;
          if ("number" == typeof d2) c2 = d2 === +!!l2.startsWith("scale");
          else {
            let t3 = parseFloat(d2);
            c2 = l2.startsWith("scale") ? 1 === t3 : 0 === t3;
          }
          if (!c2 || i2) {
            let t3 = (0, n.e)(d2, s.W[l2]);
            if (!c2) {
              h3 = false;
              let e3 = a[l2] || l2;
              o2 += `${e3}(${t3}) `;
            }
            i2 && (e2[l2] = t3);
          }
        }
        let u2 = t2.pathRotation;
        return u2 && (h3 = false, o2 += `rotate(${(0, n.e)(u2, s.W.pathRotation)}) `), o2 = o2.trim(), i2 ? o2 = i2(e2, h3 ? "" : o2) : h3 && (o2 = "none"), o2;
      })(e, t.transform, i) : h2.transform && (h2.transform = "none")), p) {
        let {
          originX: t2 = "50%",
          originY: e2 = "50%",
          originZ: i2 = 0
        } = d;
        h2.transformOrigin = `${t2} ${e2} ${i2}`;
      }
    }
  }
});

// src/dependencies/44425.cjs
var require__87 = __commonJS({
  "src/dependencies/44425.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      B: () => a,
      W: () => o
    });
    var n = require__86();
    var s = {
      offset: "stroke-dashoffset",
      array: "stroke-dasharray"
    };
    var r = {
      offset: "strokeDashoffset",
      array: "strokeDasharray"
    };
    var o = ["transform", "opacity", "offsetDistance", "offsetPath", "offsetRotate", "offsetAnchor"];
    function a(t, {
      attrX: e,
      attrY: i,
      attrScale: l,
      pathLength: h,
      pathSpacing: u = 1,
      pathOffset: d = 0,
      ...c
    }, p, m, f) {
      if ((0, n.O)(t, c, m), p) {
        t.style.viewBox && (t.attrs.viewBox = t.style.viewBox);
        return;
      }
      t.attrs = t.style, t.style = {};
      let {
        attrs: v,
        style: y
      } = t;
      for (let t2 of o) void 0 !== v[t2] && (y[t2] = v[t2], delete v[t2]);
      (y.transform || v.transformOrigin) && (y.transformOrigin = v.transformOrigin ?? "50% 50%", delete v.transformOrigin), y.transform && (y.transformBox = f?.transformBox ?? "fill-box", delete v.transformBox), void 0 !== e && (v.x = e), void 0 !== i && (v.y = i), void 0 !== l && (v.scale = l), void 0 !== h && (function(t2, e2, i2 = 1, n2 = 0, o2 = true) {
        t2.pathLength = 1;
        let a2 = o2 ? s : r;
        t2[a2.offset] = `${-n2}`, t2[a2.array] = `${e2} ${i2}`;
      })(v, h, u, d, false);
    }
  }
});

// src/dependencies/73148.cjs
var require__88 = __commonJS({
  "src/dependencies/73148.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      n: () => n
    });
    var n = (t) => "string" == typeof t && "svg" === t.toLowerCase();
  }
});

// src/dependencies/33177.cjs
var require__89 = __commonJS({
  "src/dependencies/33177.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      S: () => n
    });
    var n = ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"];
  }
});

// src/dependencies/56260.cjs
var require__90 = __commonJS({
  "src/dependencies/56260.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      k: () => n
    });
    var n = (t, e, i) => t + (e - t) * i;
  }
});

// src/dependencies/21872.cjs
var require__91 = __commonJS({
  "src/dependencies/21872.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      H: () => h
    });
    var n = require__89();
    var s = require__28();
    function r(t, e) {
      return e.max === e.min ? 0 : t / (e.max - e.min) * 100;
    }
    var o = {
      correct: (t, e) => {
        if (!e.target) return t;
        if ("string" == typeof t) if (!s.px.test(t)) return t;
        else t = parseFloat(t);
        let i = r(t, e.target.x), n2 = r(t, e.target.y);
        return `${i}% ${n2}%`;
      }
    };
    var a = require__31();
    var l = require__90();
    var h = {
      borderRadius: {
        ...o,
        applyTo: [...n.S]
      },
      borderTopLeftRadius: o,
      borderTopRightRadius: o,
      borderBottomLeftRadius: o,
      borderBottomRightRadius: o,
      boxShadow: {
        correct: (t, {
          treeScale: e,
          projectionDelta: i
        }) => {
          let n2 = a.f.parse(t);
          if (n2.length > 5) return t;
          let s2 = a.f.createTransformer(t), r2 = +("number" != typeof n2[0]), o2 = i.x.scale * e.x, h2 = i.y.scale * e.y;
          n2[0 + r2] /= o2, n2[1 + r2] /= h2;
          let u = (0, l.k)(o2, h2, 0.5);
          return "number" == typeof n2[2 + r2] && (n2[2 + r2] /= u), "number" == typeof n2[3 + r2] && (n2[3 + r2] /= u), s2(n2);
        }
      }
    };
  }
});

// src/dependencies/19274.cjs
var require__92 = __commonJS({
  "src/dependencies/19274.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      zK: () => r
    });
    var n = require__20();
    var s = require__91();
    function r(t, {
      layout: e,
      layoutId: i
    }) {
      return n.f.has(t) || t.startsWith("origin") || (e || void 0 !== i) && (!!s.H[t] || "opacity" === t);
    }
  }
});

// src/dependencies/43891.cjs
var require__93 = __commonJS({
  "src/dependencies/43891.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      x: () => r
    });
    var n = require__38();
    var s = require__92();
    function r(t, e, i) {
      let r2 = t.style, o = e?.style, a = {};
      if (!r2) return a;
      for (let e2 in r2) ((0, n.S)(r2[e2]) || o && (0, n.S)(o[e2]) || (0, s.zK)(e2, t) || i?.getValue(e2)?.liveStyle !== void 0) && (a[e2] = r2[e2]);
      return a;
    }
  }
});

// src/dependencies/85068.cjs
var require__94 = __commonJS({
  "src/dependencies/85068.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      x: () => o
    });
    var n = require__38();
    var s = require__20();
    var r = require__93();
    function o(t, e, i) {
      let o2 = (0, r.x)(t, e, i);
      for (let i2 in t) ((0, n.S)(t[i2]) || (0, n.S)(e[i2])) && (o2[-1 !== s.U.indexOf(i2) ? "attr" + i2.charAt(0).toUpperCase() + i2.substring(1) : i2] = t[i2]);
      return o2;
    }
  }
});

// src/dependencies/27669.cjs
var require__95 = __commonJS({
  "src/dependencies/27669.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    function n({
      top: t,
      left: e,
      right: i,
      bottom: s2
    }) {
      return {
        x: {
          min: e,
          max: i
        },
        y: {
          min: t,
          max: s2
        }
      };
    }
    function s({
      x: t,
      y: e
    }) {
      return {
        top: e.min,
        right: t.max,
        bottom: e.max,
        left: t.min
      };
    }
    function r(t, e) {
      if (!e) return t;
      let i = e({
        x: t.left,
        y: t.top
      }), n2 = e({
        x: t.right,
        y: t.bottom
      });
      return {
        top: i.y,
        left: i.x,
        bottom: n2.y,
        right: n2.x
      };
    }
    interop.d(exports, {
      FY: () => n,
      bS: () => r,
      pA: () => s
    });
  }
});

// src/dependencies/33411.cjs
var require__96 = __commonJS({
  "src/dependencies/33411.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    function n(t) {
      return void 0 === t || 1 === t;
    }
    function s({
      scale: t,
      scaleX: e,
      scaleY: i
    }) {
      return !n(t) || !n(e) || !n(i);
    }
    function r(t) {
      return s(t) || o(t) || t.z || t.rotate || t.rotateX || t.rotateY || t.skewX || t.skewY;
    }
    function o(t) {
      var e, i;
      return (e = t.x) && "0%" !== e || (i = t.y) && "0%" !== i;
    }
    interop.d(exports, {
      HD: () => r,
      vF: () => o,
      vk: () => s
    });
  }
});

// src/dependencies/2988.cjs
var require__97 = __commonJS({
  "src/dependencies/2988.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      OU: () => h,
      Ql: () => u,
      Ww: () => p,
      hq: () => r,
      o4: () => l
    });
    var n = require__90();
    var s = require__96();
    function r(t, e, i) {
      return i + e * (t - i);
    }
    function o(t, e, i, n2, s2) {
      return void 0 !== s2 && (t = n2 + s2 * (t - n2)), n2 + i * (t - n2) + e;
    }
    function a(t, e = 0, i = 1, n2, s2) {
      t.min = o(t.min, e, i, n2, s2), t.max = o(t.max, e, i, n2, s2);
    }
    function l(t, {
      x: e,
      y: i
    }) {
      a(t.x, e.translate, e.scale, e.originPoint), a(t.y, i.translate, i.scale, i.originPoint);
    }
    function h(t, e, i, n2 = false) {
      let r2, o2, a2 = i.length;
      if (a2) {
        e.x = e.y = 1;
        for (let h2 = 0; h2 < a2; h2++) {
          o2 = (r2 = i[h2]).projectionDelta;
          let {
            visualElement: a3
          } = r2.options;
          (!a3 || !a3.props.style || "contents" !== a3.props.style.display) && (n2 && r2.options.layoutScroll && r2.scroll && r2 !== r2.root && (u(t.x, -r2.scroll.offset.x), u(t.y, -r2.scroll.offset.y)), o2 && (e.x *= o2.x.scale, e.y *= o2.y.scale, l(t, o2)), n2 && (0, s.HD)(r2.latestValues) && p(t, r2.latestValues, r2.layout?.layoutBox));
        }
        e.x < 1.0000000000001 && e.x > 0.999999999999 && (e.x = 1), e.y < 1.0000000000001 && e.y > 0.999999999999 && (e.y = 1);
      }
    }
    function u(t, e) {
      t.min += e, t.max += e;
    }
    function d(t, e, i, s2, r2 = 0.5) {
      let o2 = (0, n.k)(t.min, t.max, r2);
      a(t, e, i, o2, s2);
    }
    function c(t, e) {
      return "string" == typeof t ? parseFloat(t) / 100 * (e.max - e.min) : t;
    }
    function p(t, e, i) {
      let n2 = i ?? t;
      d(t.x, c(e.x, n2.x), e.scaleX, e.scale, e.originX), d(t.y, c(e.y, n2.y), e.scaleY, e.scale, e.originY);
    }
  }
});

// src/dependencies/93560.cjs
var require__98 = __commonJS({
  "src/dependencies/93560.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      L: () => o,
      m: () => r
    });
    var n = require__95();
    var s = require__97();
    function r(t, e) {
      return (0, n.FY)((0, n.bS)(t.getBoundingClientRect(), e));
    }
    function o(t, e, i) {
      let n2 = r(t, i), {
        scroll: o2
      } = e;
      return o2 && ((0, s.Ql)(n2.x, o2.offset.x), (0, s.Ql)(n2.y, o2.offset.y)), n2;
    }
  }
});

// src/dependencies/95391.cjs
var require__99 = __commonJS({
  "src/dependencies/95391.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      Q: () => s
    });
    var n = ["animate", "circle", "defs", "desc", "ellipse", "g", "image", "line", "filter", "marker", "mask", "metadata", "path", "pattern", "polygon", "polyline", "rect", "stop", "switch", "symbol", "svg", "text", "tspan", "use", "view"];
    function s(t) {
      if ("string" != typeof t || t.includes("-")) ;
      else if (n.indexOf(t) > -1 || /[A-Z]/u.test(t)) return true;
      return false;
    }
  }
});

// src/dependencies/39551.cjs
var require__100 = __commonJS({
  "src/dependencies/39551.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      L: () => n
    });
    var n = (0, HostReact.createContext)({});
  }
});

// src/dependencies/24866.cjs
var require__101 = __commonJS({
  "src/dependencies/24866.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      Q: () => n
    });
    var n = (0, HostReact.createContext)({
      transformPagePoint: (t) => t,
      isStatic: false,
      reducedMotion: "never"
    });
  }
});

// src/dependencies/10583.cjs
var require__102 = __commonJS({
  "src/dependencies/10583.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      u: () => s
    });
    var n = require__38();
    function s(t) {
      return (0, n.S)(t) ? t.get() : t;
    }
  }
});

// src/dependencies/15131.cjs
var require__103 = __commonJS({
  "src/dependencies/15131.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      t: () => n
    });
    var n = (0, HostReact.createContext)(null);
  }
});

// src/dependencies/28819.cjs
var require__104 = __commonJS({
  "src/dependencies/28819.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      M: () => s
    });
    var n = HostReact;
    function s(t) {
      let e = (0, n.useRef)(null);
      return null === e.current && (e.current = t()), e.current;
    }
  }
});

// src/dependencies/43261.cjs
var require__105 = __commonJS({
  "src/dependencies/43261.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      n: () => n
    });
    var n = "data-" + (0, require__84().I)("framerAppearId");
  }
});

// src/dependencies/59299.cjs
var require__106 = __commonJS({
  "src/dependencies/59299.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      N: () => n
    });
    var n = (0, HostReact.createContext)({});
  }
});

// src/dependencies/11493.cjs
var require__107 = __commonJS({
  "src/dependencies/11493.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      X: () => n
    });
    function n(t) {
      return t && "object" == typeof t && Object.prototype.hasOwnProperty.call(t, "current");
    }
  }
});

// src/dependencies/65239.cjs
var require__108 = __commonJS({
  "src/dependencies/65239.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      E: () => s
    });
    var n = HostReact;
    var s = "u" > typeof window ? n.useLayoutEffect : n.useEffect;
  }
});

// src/dependencies/32642.cjs
var require__109 = __commonJS({
  "src/dependencies/32642.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      H: () => $
    });
    var n = HostJSX;
    var s = HostReact;
    var r = require__100();
    var o = (0, s.createContext)({
      strict: false
    });
    var a = require__101();
    var l = (0, s.createContext)({});
    var h = require__79();
    var u = require__77();
    function d(t) {
      return Array.isArray(t) ? t.join(" ") : t;
    }
    var c = require__38();
    var p = require__92();
    var m = require__86();
    var f = () => ({
      style: {},
      transform: {},
      transformOrigin: {},
      vars: {}
    });
    function v(t, e, i) {
      for (let n2 in e) (0, c.S)(e[n2]) || (0, p.zK)(n2, i) || (t[n2] = e[n2]);
    }
    var y = require__87();
    var g = require__88();
    var x = () => ({
      ...f(),
      attrs: {}
    });
    var w = /* @__PURE__ */ new Set(["animate", "exit", "variants", "initial", "style", "values", "variants", "transition", "transformTemplate", "custom", "inherit", "onBeforeLayoutMeasure", "onAnimationStart", "onAnimationComplete", "onUpdate", "onDragStart", "onDrag", "onDragEnd", "onMeasureDragConstraints", "onDirectionLock", "onDragTransitionEnd", "_dragX", "_dragY", "onHoverStart", "onHoverEnd", "onViewportEnter", "onViewportLeave", "globalTapTarget", "propagate", "ignoreStrict", "viewport"]);
    function S(t) {
      return t.startsWith("while") || t.startsWith("drag") && "draggable" !== t || t.startsWith("layout") || t.startsWith("onTap") || t.startsWith("onPan") || t.startsWith("onLayout") || w.has(t);
    }
    var b = require__99();
    var T = require__93();
    var P = require__102();
    var A = require__76();
    var k = require__82();
    var E = require__103();
    var V = require__104();
    var C = (t) => (e, i) => {
      let n2 = (0, s.useContext)(l), r2 = (0, s.useContext)(E.t), o2 = () => (function({
        scrapeMotionValuesFromProps: t2,
        createRenderState: e2
      }, i2, n3, s2) {
        return {
          latestValues: (function(t3, e3, i3, n4) {
            let s3 = {}, r3 = n4(t3, {});
            for (let t4 in r3) s3[t4] = (0, P.u)(r3[t4]);
            let {
              initial: o3,
              animate: a2
            } = t3, l2 = (0, h.e)(t3), u2 = (0, h.O)(t3);
            e3 && u2 && !l2 && false !== t3.inherit && (void 0 === o3 && (o3 = e3.initial), void 0 === a2 && (a2 = e3.animate));
            let d2 = !!i3 && false === i3.initial, c2 = (d2 = d2 || false === o3) ? a2 : o3;
            if (c2 && "boolean" != typeof c2 && !(0, A.N)(c2)) {
              let e4 = Array.isArray(c2) ? c2 : [c2];
              for (let i4 = 0; i4 < e4.length; i4++) {
                let n5 = (0, k.a)(t3, e4[i4]);
                if (n5) {
                  let {
                    transitionEnd: t4,
                    transition: e5,
                    ...i5
                  } = n5;
                  for (let t5 in i5) {
                    let e6 = i5[t5];
                    if (Array.isArray(e6)) {
                      let t6 = d2 ? e6.length - 1 : 0;
                      e6 = e6[t6];
                    }
                    null !== e6 && (s3[t5] = e6);
                  }
                  for (let e6 in t4) s3[e6] = t4[e6];
                }
              }
            }
            return s3;
          })(i2, n3, s2, t2),
          renderState: e2()
        };
      })(t, e, n2, r2);
      return i ? o2() : (0, V.M)(o2);
    };
    var M = C({
      scrapeMotionValuesFromProps: T.x,
      createRenderState: f
    });
    var D = C({
      scrapeMotionValuesFromProps: require__94().x,
      createRenderState: x
    });
    var R = require__83();
    var L = {
      animation: ["animate", "variants", "whileHover", "whileTap", "exit", "whileInView", "whileFocus", "whileDrag"],
      exit: ["exit"],
      drag: ["drag", "dragControls"],
      focus: ["whileFocus"],
      hover: ["whileHover", "onHoverStart", "onHoverEnd"],
      tap: ["whileTap", "onTap", "onTapStart", "onTapCancel"],
      pan: ["onPan", "onPanStart", "onPanSessionStart", "onPanEnd"],
      inView: ["whileInView", "onViewportEnter", "onViewportLeave"],
      layout: ["layout", "layoutId"]
    };
    var B = false;
    function j() {
      return !(function() {
        if (B) return;
        let t = {};
        for (let e in L) t[e] = {
          isEnabled: (t2) => L[e].some((e2) => !!t2[e2])
        };
        (0, R.lr)(t), B = true;
      })(), (0, R.vK)();
    }
    var F = Symbol.for("motionComponentSymbol");
    var O = require__105();
    var I = require__106();
    var W = require__107();
    var U = require__108();
    function N(t, {
      forwardMotionProps: e = false,
      type: i
    } = {}, p2, w2) {
      p2 && (function(t2) {
        let e2 = j();
        for (let i2 in t2) e2[i2] = {
          ...e2[i2],
          ...t2[i2]
        };
        (0, R.lr)(e2);
      })(p2);
      let T2 = i ? "svg" === i : (0, b.Q)(t), P2 = T2 ? D : M;
      function A2(i2, p3) {
        var A3;
        let k3, V2, C2, M2 = {
          ...(0, s.useContext)(a.Q),
          ...i2,
          layoutId: (function({
            layoutId: t2
          }) {
            let e2 = (0, s.useContext)(r.L).id;
            return e2 && void 0 !== t2 ? e2 + "-" + t2 : t2;
          })(i2)
        }, {
          isStatic: D2,
          isValidProp: R2
        } = M2, L2 = (function(t2) {
          let {
            initial: e2,
            animate: i3
          } = (function(t3, e3) {
            if ((0, h.e)(t3)) {
              let {
                initial: e4,
                animate: i4
              } = t3;
              return {
                initial: false === e4 || (0, u.w)(e4) ? e4 : void 0,
                animate: (0, u.w)(i4) ? i4 : void 0
              };
            }
            return false !== t3.inherit ? e3 : {};
          })(t2, (0, s.useContext)(l));
          return (0, s.useMemo)(() => ({
            initial: e2,
            animate: i3
          }), [d(e2), d(i3)]);
        })(i2), B2 = P2(i2, D2);
        if (!D2 && "u" > typeof window) {
          (0, s.useContext)(o).strict;
          let e2 = (function(t2) {
            let {
              drag: e3,
              layout: i3
            } = j();
            if (!e3 && !i3) return {};
            let n2 = {
              ...e3,
              ...i3
            };
            return {
              MeasureLayout: e3?.isEnabled(t2) || i3?.isEnabled(t2) ? n2.MeasureLayout : void 0,
              ProjectionNode: n2.ProjectionNode
            };
          })(M2);
          k3 = e2.MeasureLayout, L2.visualElement = (function(t2, e3, i3, n2, r2, h2) {
            let {
              visualElement: u2
            } = (0, s.useContext)(l), d2 = (0, s.useContext)(o), c2 = (0, s.useContext)(E.t), p4 = (0, s.useContext)(a.Q), m2 = p4.reducedMotion, f2 = p4.skipAnimations, v2 = (0, s.useRef)(null), y2 = (0, s.useRef)(false);
            n2 = n2 || d2.renderer, !v2.current && n2 && (v2.current = n2(t2, {
              visualState: e3,
              parent: u2,
              props: i3,
              presenceContext: c2,
              blockInitialAnimation: !!c2 && false === c2.initial,
              reducedMotionConfig: m2,
              skipAnimations: f2,
              isSVG: h2
            }), y2.current && v2.current && (v2.current.manuallyAnimateOnMount = true));
            let g2 = v2.current, x2 = (0, s.useContext)(I.N);
            g2 && !g2.projection && r2 && ("html" === g2.type || "svg" === g2.type) && (function(t3, e4, i4, n3) {
              let {
                layoutId: s2,
                layout: r3,
                drag: o2,
                dragConstraints: a2,
                layoutScroll: l2,
                layoutRoot: h3,
                layoutAnchor: u3,
                layoutCrossfade: d3
              } = e4;
              t3.projection = new i4(t3.latestValues, e4["data-framer-portal-id"] ? void 0 : (function t4(e5) {
                if (e5) return false !== e5.options.allowProjection ? e5.projection : t4(e5.parent);
              })(t3.parent)), t3.projection.setOptions({
                layoutId: s2,
                layout: r3,
                alwaysMeasureLayout: !!o2 || a2 && (0, W.X)(a2),
                visualElement: t3,
                animationType: "string" == typeof r3 ? r3 : "both",
                initialPromotionConfig: n3,
                crossfade: d3,
                layoutScroll: l2,
                layoutRoot: h3,
                layoutAnchor: u3
              });
            })(v2.current, i3, r2, x2);
            let w3 = (0, s.useRef)(false);
            (0, s.useInsertionEffect)(() => {
              g2 && w3.current && g2.update(i3, c2);
            });
            let S2 = i3[O.n], b2 = (0, s.useRef)(!!S2 && "u" > typeof window && !window.MotionHandoffIsComplete?.(S2) && window.MotionHasOptimisedAnimation?.(S2));
            return (0, U.E)(() => {
              y2.current = true, g2 && (w3.current = true, window.MotionIsMounted = true, g2.updateFeatures(), g2.scheduleRenderMicrotask(), b2.current && g2.animationState && g2.animationState.animateChanges());
            }), (0, s.useEffect)(() => {
              g2 && (!b2.current && g2.animationState && g2.animationState.animateChanges(), b2.current && (queueMicrotask(() => {
                window.MotionHandoffMarkAsComplete?.(S2);
              }), b2.current = false), g2.enteringChildren = void 0);
            }), g2;
          })(t, B2, M2, w2, e2.ProjectionNode, T2);
        }
        return (0, n.jsxs)(l.Provider, {
          value: L2,
          children: [k3 && L2.visualElement ? (0, n.jsx)(k3, {
            visualElement: L2.visualElement,
            ...M2
          }) : null, (function(t2, e2, i3, {
            latestValues: n2
          }, r2, o2 = false, a2, l2) {
            let h2 = (a2 ?? (0, b.Q)(t2) ? function(t3, e3, i4, n3) {
              let r3 = (0, s.useMemo)(() => {
                let i5 = x();
                return (0, y.B)(i5, e3, (0, g.n)(n3), t3.transformTemplate, t3.style), {
                  ...i5.attrs,
                  style: {
                    ...i5.style
                  }
                };
              }, [e3]);
              if (t3.style) {
                let e4 = {};
                v(e4, t3.style, t3), r3.style = {
                  ...e4,
                  ...r3.style
                };
              }
              return r3;
            } : function(t3, e3) {
              let i4, n3, r3 = {}, o3 = (i4 = t3.style || {}, v(n3 = {}, i4, t3), Object.assign(n3, (function({
                transformTemplate: t4
              }, e4) {
                return (0, s.useMemo)(() => {
                  let i5 = f();
                  return (0, m.O)(i5, e4, t4), Object.assign({}, i5.vars, i5.style);
                }, [e4]);
              })(t3, e3)), n3);
              return t3.drag && false !== t3.dragListener && (r3.draggable = false, o3.userSelect = o3.WebkitUserSelect = o3.WebkitTouchCallout = "none", o3.touchAction = true === t3.drag ? "none" : `pan-${"x" === t3.drag ? "y" : "x"}`), void 0 === t3.tabIndex && (t3.onTap || t3.onTapStart || t3.whileTap) && (r3.tabIndex = 0), r3.style = o3, r3;
            })(e2, n2, r2, t2), u2 = (function(t3, e3, i4, n3) {
              let s2 = {};
              for (let r3 in t3) ("values" !== r3 || "object" != typeof t3.values) && !(0, c.S)(t3[r3]) && ((r3.startsWith("on") ? !S(r3) : n3?.(r3) ?? !S(r3)) || true === i4 && S(r3) || !e3 && !S(r3) || t3.draggable && r3.startsWith("onDrag")) && (s2[r3] = t3[r3]);
              return s2;
            })(e2, "string" == typeof t2, o2, l2), d2 = t2 !== s.Fragment ? {
              ...u2,
              ...h2,
              ref: i3
            } : {}, {
              children: p4
            } = e2, w3 = (0, s.useMemo)(() => (0, c.S)(p4) ? p4.get() : p4, [p4]);
            return (0, s.createElement)(t2, {
              ...d2,
              children: w3
            });
          })(t, i2, (A3 = L2.visualElement, V2 = (0, s.useRef)(p3), (0, s.useInsertionEffect)(() => {
            V2.current = p3;
          }), C2 = (0, s.useRef)(null), (0, s.useCallback)((t2) => {
            t2 && B2.onMount?.(t2), A3 && (t2 ? A3.mount(t2) : A3.unmount());
            let e2 = V2.current;
            if ("function" == typeof e2) {
              if (t2) {
                let i3 = e2(t2);
                "function" == typeof i3 && (C2.current = i3);
              } else C2.current ? (C2.current(), C2.current = null) : e2(t2);
            } else e2 && (e2.current = t2);
          }, [A3])), B2, D2, e, T2, R2)]
        });
      }
      A2.displayName = `motion.${"string" == typeof t ? t : `create(${t.displayName ?? t.name ?? ""})`}`;
      let k2 = (0, s.forwardRef)(A2);
      return k2[F] = t, k2;
    }
    function $(t, e) {
      if ("u" < typeof Proxy) return N;
      let i = /* @__PURE__ */ new Map(), n2 = (i2, n3) => N(i2, n3, t, e);
      return new Proxy((t2, e2) => n2(t2, e2), {
        get: (s2, r2) => "create" === r2 ? n2 : (i.has(r2) || i.set(r2, N(r2, void 0, t, e)), i.get(r2))
      });
    }
  }
});

// src/dependencies/33140.cjs
var require__110 = __commonJS({
  "src/dependencies/33140.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      K: () => s
    });
    var n = require__82();
    function s(t, e, i) {
      let s2 = t.getProps();
      return (0, n.a)(s2, e, void 0 !== i ? i : s2.custom, t);
    }
  }
});

// src/dependencies/30123.cjs
var require__111 = __commonJS({
  "src/dependencies/30123.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      K: () => n
    });
    function n(t, e) {
      if (t?.inherit && e) {
        let {
          inherit: i,
          ...n2
        } = t;
        return {
          ...e,
          ...n2
        };
      }
      return t;
    }
  }
});

// src/dependencies/75319.cjs
var require__112 = __commonJS({
  "src/dependencies/75319.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      r: () => s
    });
    var n = require__111();
    function s(t, e) {
      let i = t?.[e] ?? t?.default ?? t;
      return i !== t ? (0, n.K)(i, t) : i;
    }
  }
});

// src/dependencies/91909.cjs
var require__113 = __commonJS({
  "src/dependencies/91909.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      p: () => n
    });
    var n = (t) => Array.isArray(t);
  }
});

// src/dependencies/67119.cjs
var require__114 = __commonJS({
  "src/dependencies/67119.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      U: () => o
    });
    var n = require__74();
    var s = require__110();
    var r = require__113();
    function o(t, e) {
      let {
        transitionEnd: i = {},
        transition: o2 = {},
        ...a
      } = (0, s.K)(t, e) || {};
      for (let e2 in a = {
        ...a,
        ...i
      }) {
        var l;
        let i2 = (l = a[e2], (0, r.p)(l) ? l[l.length - 1] || 0 : l);
        t.hasValue(e2) ? t.getValue(e2).set(i2) : t.addValue(e2, (0, n.OQ)(i2));
      }
    }
  }
});

// src/dependencies/61638.cjs
var require__115 = __commonJS({
  "src/dependencies/61638.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      g: () => r
    });
    var n = require__50();
    var s = require__38();
    function r(t, e) {
      let i = t.getValue("willChange");
      if ((0, s.S)(i) && i.add) return i.add(e);
      if (!i && n.W.WillChange) {
        let i2 = new n.W.WillChange("auto");
        t.addValue("willChange", i2), i2.add(e);
      }
    }
  }
});

// src/dependencies/61151.cjs
var require__116 = __commonJS({
  "src/dependencies/61151.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      P: () => s
    });
    var n = require__105();
    function s(t) {
      return t.props[n.n];
    }
  }
});

// src/dependencies/34017.cjs
var require__117 = __commonJS({
  "src/dependencies/34017.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      F: () => n
    });
    var n = (...t) => t.reduce((t2, e) => (i) => e(t2(i)));
  }
});

// src/dependencies/86075.cjs
var require__118 = __commonJS({
  "src/dependencies/86075.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      j: () => k
    });
    var n = require__23();
    var s = require__117();
    var r = require__42();
    var o = require__44();
    var a = require__30();
    var l = require__31();
    var h = require__27();
    var u = require__29();
    function d(t, e, i) {
      return (i < 0 && (i += 1), i > 1 && (i -= 1), i < 1 / 6) ? t + (e - t) * 6 * i : i < 0.5 ? e : i < 2 / 3 ? t + (e - t) * (2 / 3 - i) * 6 : t;
    }
    var c = require__26();
    function p(t, e) {
      return (i) => i > 0 ? e : t;
    }
    var m = require__90();
    var f = (t, e, i) => {
      let n2 = t * t, s2 = i * (e * e - n2) + n2;
      return s2 < 0 ? 0 : Math.sqrt(s2);
    };
    var v = [h.u, c.B, u.V];
    function y(t) {
      let e = v.find((e2) => e2.test(t));
      if (!e) return (0, r.$)(false, `'${t}' is not an animatable color. Use the equivalent color code instead.`, "color-not-animatable"), false;
      let i = e.parse(t);
      return e === u.V && (i = (function({
        hue: t2,
        saturation: e2,
        lightness: i2,
        alpha: n2
      }) {
        t2 /= 360, i2 /= 100;
        let s2 = 0, r2 = 0, o2 = 0;
        if (e2 /= 100) {
          let n3 = i2 < 0.5 ? i2 * (1 + e2) : i2 + e2 - i2 * e2, a2 = 2 * i2 - n3;
          s2 = d(a2, n3, t2 + 1 / 3), r2 = d(a2, n3, t2), o2 = d(a2, n3, t2 - 1 / 3);
        } else s2 = r2 = o2 = i2;
        return {
          red: Math.round(255 * s2),
          green: Math.round(255 * r2),
          blue: Math.round(255 * o2),
          alpha: n2
        };
      })(i)), i;
    }
    var g = (t, e) => {
      let i = y(t), n2 = y(e);
      if (!i || !n2) return p(t, e);
      let s2 = {
        ...i
      };
      return (t2) => (s2.red = f(i.red, n2.red, t2), s2.green = f(i.green, n2.green, t2), s2.blue = f(i.blue, n2.blue, t2), s2.alpha = (0, m.k)(i.alpha, n2.alpha, t2), c.B.transform(s2));
    };
    var x = /* @__PURE__ */ new Set(["none", "hidden"]);
    function w(t, e) {
      return (i) => (0, m.k)(t, e, i);
    }
    function S(t) {
      return "number" == typeof t ? w : "string" == typeof t ? (0, o.pG)(t) ? p : a.y.test(t) ? g : P : Array.isArray(t) ? b : "object" == typeof t ? a.y.test(t) ? g : T : p;
    }
    function b(t, e) {
      let i = [...t], n2 = i.length, s2 = t.map((t2, i2) => S(t2)(t2, e[i2]));
      return (t2) => {
        for (let e2 = 0; e2 < n2; e2++) i[e2] = s2[e2](t2);
        return i;
      };
    }
    function T(t, e) {
      let i = {
        ...t,
        ...e
      }, n2 = {};
      for (let s2 in i) void 0 !== t[s2] && void 0 !== e[s2] && (n2[s2] = S(t[s2])(t[s2], e[s2]));
      return (t2) => {
        for (let e2 in n2) i[e2] = n2[e2](t2);
        return i;
      };
    }
    var P = (t, e) => {
      let i = l.f.createTransformer(e), n2 = (0, l.Vf)(t), o2 = (0, l.Vf)(e);
      if (!(n2.indexes.var.length === o2.indexes.var.length && n2.indexes.color.length === o2.indexes.color.length && n2.indexes.number.length >= o2.indexes.number.length)) return (0, r.$)(true, `Complex values '${t}' and '${e}' too different to mix. Ensure all colors are of the same type, and that each contains the same quantity of number and color values. Falling back to instant transition.`, "complex-values-different"), p(t, e);
      if (x.has(t) && !o2.values.length || x.has(e) && !n2.values.length) return x.has(t) ? (i2) => i2 <= 0 ? t : e : (i2) => i2 >= 1 ? e : t;
      return (0, s.F)(b((function(t2, e2) {
        let i2 = [], n3 = {
          color: 0,
          var: 0,
          number: 0
        };
        for (let s2 = 0; s2 < e2.values.length; s2++) {
          let r2 = e2.types[s2], o3 = t2.indexes[r2][n3[r2]], a2 = t2.values[o3] ?? 0;
          i2[s2] = a2, n3[r2]++;
        }
        return i2;
      })(n2, o2), o2.values), i);
    };
    var A = /^(-?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]*)$/iu;
    function k(t, e, i) {
      if ("number" == typeof t && "number" == typeof e && "number" == typeof i) return (0, m.k)(t, e, i);
      if ("string" == typeof t && "string" == typeof e) {
        let i2 = (function(t2, e2) {
          let i3 = A.exec(t2);
          if (!i3) return;
          let s2 = A.exec(e2);
          if (!s2 || i3[2] !== s2[2]) return;
          let r2 = i3[2], o2 = parseFloat(i3[1]), a2 = parseFloat(s2[1]);
          return (t3) => (0, n.a)((0, m.k)(o2, a2, t3)) + r2;
        })(t, e);
        if (i2) return i2;
      }
      return S(t)(t, e);
    }
  }
});

// src/dependencies/17964.cjs
var require__119 = __commonJS({
  "src/dependencies/17964.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      Y: () => n,
      t: () => s
    });
    var n = 2e4;
    function s(t, e = 50, i = n, r) {
      let o = 0, a = t.next(o);
      for (r?.push(a.value); !a.done && o < i; ) o += e, a = t.next(o), r?.push(a.value);
      return o >= i ? 1 / 0 : o;
    }
  }
});

// src/dependencies/26262.cjs
var require__120 = __commonJS({
  "src/dependencies/26262.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      X: () => r
    });
    var n = require__55();
    var s = require__119();
    function r(t, e = 100, i) {
      let o = i({
        ...t,
        keyframes: [0, e]
      }), a = Math.min((0, s.t)(o), s.Y);
      return {
        type: "keyframes",
        ease: (t2) => o.next(a * t2).value / e,
        duration: (0, n.X)(a)
      };
    }
  }
});

// src/dependencies/13031.cjs
var require__121 = __commonJS({
  "src/dependencies/13031.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      o: () => y
    });
    var n = require__42();
    var s = require__55();
    var r = require__21();
    var o = require__68();
    var a = require__119();
    var l = require__120();
    var h = 0.01;
    var u = 2;
    var d = 5e-3;
    var c = 0.5;
    function p(t, e) {
      return t * Math.sqrt(1 - e * e);
    }
    var m = ["duration", "bounce"];
    var f = ["stiffness", "damping", "mass"];
    function v(t, e) {
      return e.some((e2) => void 0 !== t[e2]);
    }
    function y(t = 0.3, e = 0.3) {
      let i, l2, g, x = "object" != typeof t ? {
        visualDuration: t,
        keyframes: [0, 1],
        bounce: e
      } : t, w = x.keyframes[0], S = x.keyframes[x.keyframes.length - 1], b = {
        done: false,
        value: w
      }, {
        stiffness: T,
        damping: P,
        mass: A,
        duration: k,
        velocity: E,
        isResolvedFromDuration: V
      } = (function(t2) {
        let e2 = {
          velocity: 0,
          stiffness: 100,
          damping: 10,
          mass: 1,
          isResolvedFromDuration: false,
          ...t2
        };
        if (!v(t2, f) && v(t2, m)) if (e2.velocity = 0, t2.visualDuration) {
          let i2 = 2 * Math.PI / (1.2 * t2.visualDuration), n2 = i2 * i2, s2 = 2 * (0, r.q)(0.05, 1, 1 - (t2.bounce || 0)) * Math.sqrt(n2);
          e2 = {
            ...e2,
            mass: 1,
            stiffness: n2,
            damping: s2
          };
        } else {
          let i2 = (function({
            duration: t3 = 800,
            bounce: e3 = 0.3,
            velocity: i3 = 0,
            mass: o2 = 1
          }) {
            let a2, l3;
            (0, n.$)(t3 <= (0, s.f)(10), "Spring duration must be 10 seconds or less", "spring-duration-limit");
            let h2 = 1 - e3;
            h2 = (0, r.q)(0.05, 1, h2), t3 = (0, r.q)(0.01, 10, (0, s.X)(t3)), h2 < 1 ? (a2 = (e4) => {
              let n2 = e4 * h2, s2 = n2 * t3;
              return 1e-3 - (n2 - i3) / p(e4, h2) * Math.exp(-s2);
            }, l3 = (e4) => {
              let n2 = e4 * h2 * t3, s2 = h2 * h2 * e4 * e4 * t3, r2 = Math.exp(-n2), o3 = p(e4 * e4, h2);
              return (n2 * i3 + i3 - s2) * r2 * (-a2(e4) + 1e-3 > 0 ? -1 : 1) / o3;
            }) : (a2 = (e4) => -1e-3 + Math.exp(-e4 * t3) * ((e4 - i3) * t3 + 1), l3 = (e4) => t3 * t3 * (i3 - e4) * Math.exp(-e4 * t3));
            let u2 = (function(t4, e4, i4) {
              let n2 = i4;
              for (let i5 = 1; i5 < 12; i5++) n2 -= t4(n2) / e4(n2);
              return n2;
            })(a2, l3, 5 / t3);
            if (t3 = (0, s.f)(t3), isNaN(u2)) return {
              stiffness: 100,
              damping: 10,
              duration: t3
            };
            {
              let e4 = u2 * u2 * o2;
              return {
                stiffness: e4,
                damping: 2 * h2 * Math.sqrt(o2 * e4),
                duration: t3
              };
            }
          })({
            ...t2,
            velocity: 0
          });
          (e2 = {
            ...e2,
            ...i2,
            mass: 1
          }).isResolvedFromDuration = true;
        }
        return e2;
      })({
        ...x,
        velocity: -(0, s.X)(x.velocity || 0)
      }), C = P / (2 * Math.sqrt(T * A)), M = (0, s.X)(Math.sqrt(T / A)), D = C * M, R = {
        target: S,
        delta: S - w,
        velocity: E || 0,
        restSpeed: 0,
        restDelta: 0
      }, L = () => {
        let t2 = 5 > Math.abs(R.delta);
        R.restSpeed = x.restSpeed || (t2 ? h : u), R.restDelta = x.restDelta || (t2 ? d : c);
      };
      if (L(), C < 1) {
        let t2 = p(M, C), e2 = {
          A: 0,
          sinC: 0,
          cosC: 0,
          t: -1,
          env: 0,
          sin: 0,
          cos: 0
        };
        g = () => {
          e2.A = (R.velocity + D * R.delta) / t2, e2.sinC = D * e2.A + R.delta * t2, e2.cosC = D * R.delta - e2.A * t2;
        };
        let n2 = (i2) => {
          i2 !== e2.t && (e2.t = i2, e2.env = Math.exp(-D * i2), e2.sin = Math.sin(t2 * i2), e2.cos = Math.cos(t2 * i2));
        };
        i = (t3) => (n2(t3), R.target - e2.env * (e2.A * e2.sin + R.delta * e2.cos)), l2 = (t3) => (n2(t3), e2.env * (e2.sinC * e2.sin + e2.cosC * e2.cos));
      } else if (1 === C) {
        i = (t3) => R.target - Math.exp(-M * t3) * (R.delta + (R.velocity + M * R.delta) * t3);
        let t2 = {
          C: 0
        };
        g = () => {
          t2.C = R.velocity + M * R.delta;
        }, l2 = (e2) => Math.exp(-M * e2) * (M * t2.C * e2 - R.velocity);
      } else {
        let t2 = M * Math.sqrt(C * C - 1);
        i = (e3) => {
          let i2 = Math.exp(-D * e3), n2 = Math.min(t2 * e3, 300);
          return R.target - i2 * ((R.velocity + D * R.delta) * Math.sinh(n2) + t2 * R.delta * Math.cosh(n2)) / t2;
        };
        let e2 = {
          P: 0,
          sinh: 0,
          cosh: 0
        };
        g = () => {
          e2.P = (R.velocity + D * R.delta) / t2, e2.sinh = D * e2.P - R.delta * t2, e2.cosh = D * R.delta - e2.P * t2;
        }, l2 = (i2) => {
          let n2 = Math.exp(-D * i2), s2 = Math.min(t2 * i2, 300);
          return n2 * (e2.sinh * Math.sinh(s2) + e2.cosh * Math.cosh(s2));
        };
      }
      g();
      let B = !v(x, f) && v(x, m), j = V && k || null, F = {
        calculatedDuration: j,
        retarget: (t2, e2) => {
          R.target = t2[t2.length - 1], R.delta = R.target - t2[0], R.velocity = B ? 0 : -(0, s.X)(e2), x.restSpeed && x.restDelta || L(), F.calculatedDuration = j, b.done = false, g();
        },
        velocity: (t2) => (0, s.f)(l2(t2)),
        next: (t2) => {
          let e2 = i(t2);
          return V ? b.done = t2 >= k : b.done = Math.abs((0, s.f)(l2(t2))) <= R.restSpeed && Math.abs(R.target - e2) <= R.restDelta, b.value = b.done ? R.target : e2, b;
        },
        toString: () => {
          let t2 = Math.min((0, a.t)(F), a.Y), e2 = (0, o.K)((e3) => F.next(t2 * e3).value, t2, 30);
          return t2 + "ms " + e2;
        },
        toTransition: () => {
        }
      };
      return F;
    }
    y.applyToOptions = (t) => {
      let e = (0, l.X)(t, 100, y);
      return t.ease = e.ease, t.duration = (0, s.f)(e.duration), t.type = "keyframes", t;
    };
  }
});

// src/dependencies/41720.cjs
var require__122 = __commonJS({
  "src/dependencies/41720.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      B: () => s
    });
    var n = require__121();
    function s({
      keyframes: t,
      velocity: e = 0,
      power: i = 0.8,
      timeConstant: r = 325,
      bounceDamping: o = 10,
      bounceStiffness: a = 500,
      modifyTarget: l,
      min: h,
      max: u,
      restDelta: d = 0.5,
      restSpeed: c
    }) {
      let p, m, f = t[0], v = {
        done: false,
        value: f
      }, y = i * e, g = f + y, x = void 0 === l ? g : l(g);
      x !== g && (y = x - f);
      let w = (t2) => -y * Math.exp(-t2 / r), S = (t2) => {
        let e2 = w(t2);
        v.done = Math.abs(e2) <= d, v.value = v.done ? x : x + e2;
      }, b = (t2) => {
        let e2;
        if ((e2 = v.value) < h || e2 > u) {
          var i2;
          p = t2, m = (0, n.o)({
            keyframes: [v.value, (i2 = v.value, void 0 === h ? u : void 0 === u || Math.abs(h - i2) < Math.abs(u - i2) ? h : u)],
            velocity: -w(t2) / r * 1e3,
            damping: o,
            stiffness: a,
            restDelta: d,
            restSpeed: c
          });
        }
      };
      return b(0), {
        calculatedDuration: null,
        next: (t2) => {
          let e2 = false;
          return (m || void 0 !== p || (e2 = true, S(t2), b(t2)), void 0 !== p && t2 >= p) ? m.next(t2 - p) : (e2 || S(t2), v);
        }
      };
    }
  }
});

// src/dependencies/25505.cjs
var require__123 = __commonJS({
  "src/dependencies/25505.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      A: () => r
    });
    var n = require__49();
    var s = (t, e, i) => (((1 - 3 * i + 3 * e) * t + (3 * i - 6 * e)) * t + 3 * e) * t;
    function r(t, e, i, r2) {
      return t === e && i === r2 ? n.l : (n2) => 0 === n2 || 1 === n2 ? n2 : s((function(t2, e2, i2, n3, r3) {
        let o, a, l = 0;
        do
          (o = s(a = e2 + (i2 - e2) / 2, n3, r3) - t2) > 0 ? i2 = a : e2 = a;
        while (Math.abs(o) > 1e-7 && ++l < 12);
        return a;
      })(n2, 0, 1, t, i), e, r2);
    }
  }
});

// src/dependencies/8441.cjs
var require__124 = __commonJS({
  "src/dependencies/8441.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      a6: () => s,
      am: () => o,
      vT: () => r
    });
    var n = require__123();
    var s = (0, n.A)(0.42, 0, 1, 1);
    var r = (0, n.A)(0, 0, 0.58, 1);
    var o = (0, n.A)(0.42, 0, 0.58, 1);
  }
});

// src/dependencies/85843.cjs
var require__125 = __commonJS({
  "src/dependencies/85843.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      h: () => n
    });
    var n = (t) => Array.isArray(t) && "number" != typeof t[0];
  }
});

// src/dependencies/75887.cjs
var require__126 = __commonJS({
  "src/dependencies/75887.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      V: () => n
    });
    var n = (t) => (e) => e <= 0.5 ? t(2 * e) / 2 : (2 - t(2 * (1 - e))) / 2;
  }
});

// src/dependencies/12266.cjs
var require__127 = __commonJS({
  "src/dependencies/12266.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      G: () => n
    });
    var n = (t) => (e) => 1 - t(1 - e);
  }
});

// src/dependencies/1406.cjs
var require__128 = __commonJS({
  "src/dependencies/1406.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      Sz: () => o,
      ZZ: () => l,
      dg: () => a
    });
    var n = require__123();
    var s = require__126();
    var r = require__127();
    var o = (0, n.A)(0.33, 1.53, 0.69, 0.99);
    var a = (0, r.G)(o);
    var l = (0, s.V)(a);
  }
});

// src/dependencies/25903.cjs
var require__129 = __commonJS({
  "src/dependencies/25903.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      b: () => s
    });
    var n = require__128();
    var s = (t) => t >= 1 ? 1 : (t *= 2) < 1 ? 0.5 * (0, n.dg)(t) : 0.5 * (2 - Math.pow(2, -10 * (t - 1)));
  }
});

// src/dependencies/89722.cjs
var require__130 = __commonJS({
  "src/dependencies/89722.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      po: () => r,
      tn: () => a,
      yT: () => o
    });
    var n = require__126();
    var s = require__127();
    var r = (t) => 1 - Math.sin(Math.acos(t));
    var o = (0, s.G)(r);
    var a = (0, n.V)(r);
  }
});

// src/dependencies/72975.cjs
var require__131 = __commonJS({
  "src/dependencies/72975.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      K: () => c
    });
    var n = require__42();
    var s = require__49();
    var r = require__129();
    var o = require__128();
    var a = require__130();
    var l = require__123();
    var h = require__124();
    var u = require__67();
    var d = {
      linear: s.l,
      easeIn: h.a6,
      easeInOut: h.am,
      easeOut: h.vT,
      circIn: a.po,
      circInOut: a.tn,
      circOut: a.yT,
      backIn: o.dg,
      backInOut: o.ZZ,
      backOut: o.Sz,
      anticipate: r.b
    };
    var c = (t) => {
      if ((0, u.D)(t)) {
        (0, n.V)(4 === t.length, "Cubic bezier arrays must contain four numerical values.", "cubic-bezier-length");
        let [e, i, s2, r2] = t;
        return (0, l.A)(e, i, s2, r2);
      }
      return "string" == typeof t ? ((0, n.V)(void 0 !== d[t], `Invalid easing type '${t}'`, "invalid-easing-type"), d[t]) : t;
    };
  }
});

// src/dependencies/18844.cjs
var require__132 = __commonJS({
  "src/dependencies/18844.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      q: () => n
    });
    var n = (t, e, i) => {
      let n2 = e - t;
      return n2 ? (i - t) / n2 : 1;
    };
  }
});

// src/dependencies/21649.cjs
var require__133 = __commonJS({
  "src/dependencies/21649.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      G: () => u
    });
    var n = require__50();
    var s = require__49();
    var r = require__117();
    var o = require__42();
    var a = require__132();
    var l = require__21();
    var h = require__118();
    function u(t, e, {
      clamp: i = true,
      ease: d,
      mixer: c
    } = {}) {
      let p = t.length;
      if ((0, o.V)(p === e.length, "Both input and output ranges must be the same length", "range-length"), 1 === p) return () => e[0];
      if (2 === p && e[0] === e[1]) return () => e[1];
      let m = t[0] === t[1];
      t[0] > t[p - 1] && (t = [...t].reverse(), e = [...e].reverse());
      let f = (function(t2, e2, i2) {
        let o2 = [], a2 = i2 || n.W.mix || h.j, l2 = t2.length - 1;
        for (let i3 = 0; i3 < l2; i3++) {
          let n2 = a2(t2[i3], t2[i3 + 1]);
          if (e2) {
            let t3 = Array.isArray(e2) ? e2[i3] || s.l : e2;
            n2 = (0, r.F)(t3, n2);
          }
          o2.push(n2);
        }
        return o2;
      })(e, d, c), v = f.length, y = (i2) => {
        if (m && i2 < t[0]) return e[0];
        let n2 = 0;
        if (v > 1) for (; n2 < t.length - 2 && !(i2 < t[n2 + 1]); n2++) ;
        let s2 = (0, a.q)(t[n2], t[n2 + 1], i2);
        return f[n2](s2);
      };
      return i ? (e2) => y((0, l.q)(t[0], t[p - 1], e2)) : y;
    }
  }
});

// src/dependencies/17611.cjs
var require__134 = __commonJS({
  "src/dependencies/17611.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      f: () => r
    });
    var n = require__132();
    var s = require__90();
    function r(t, e) {
      let i = t[t.length - 1];
      for (let r2 = 1; r2 <= e; r2++) {
        let o = (0, n.q)(0, e, r2);
        t.push((0, s.k)(i, 1, o));
      }
    }
  }
});

// src/dependencies/59337.cjs
var require__135 = __commonJS({
  "src/dependencies/59337.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      Z: () => s
    });
    var n = require__134();
    function s(t) {
      let e = [0];
      return (0, n.f)(e, t.length - 1), e;
    }
  }
});

// src/dependencies/16660.cjs
var require__136 = __commonJS({
  "src/dependencies/16660.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      i: () => d
    });
    var n = require__124();
    var s = require__125();
    var r = require__131();
    var o = require__50();
    var a = require__21();
    var l = require__133();
    var h = require__118();
    var u = require__135();
    function d({
      duration: t = 300,
      keyframes: e,
      times: i,
      ease: c = "easeInOut"
    }) {
      var p;
      let m = (0, s.h)(c) ? c.map(r.K) : (0, r.K)(c), f = {
        done: false,
        value: e[0]
      };
      if (2 === e.length && !Array.isArray(m) && (!i || 2 !== i.length || 0 === i[0] && 1 === i[1])) {
        let [i2, n2] = e, s2 = i2 === n2 ? void 0 : (o.W.mix || h.j)(i2, n2);
        return {
          calculatedDuration: t,
          next: (e2) => (f.value = s2 ? s2(m(t > 0 ? (0, a.q)(0, 1, e2 / t) : 1)) : n2, f.done = e2 >= t, f)
        };
      }
      let v = (p = i && i.length === e.length ? i : (0, u.Z)(e), p.map((e2) => e2 * t)), y = (0, l.G)(v, e, {
        ease: Array.isArray(m) ? m : e.map(() => m || n.am).splice(0, e.length - 1)
      });
      return {
        calculatedDuration: t,
        next: (e2) => (f.value = y(e2), f.done = e2 >= t, f)
      };
    }
  }
});

// src/dependencies/45343.cjs
var require__137 = __commonJS({
  "src/dependencies/45343.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      Y: () => s
    });
    var n = require__73();
    function s(t, e, i = 0) {
      var r, o;
      let a;
      return e <= 0 ? i : t.velocity ? t.velocity(e) : (r = (e2) => t.next(e2).value, o = t.next(e).value, a = Math.max(e - 5, 0), (0, n.f)(o - r(a), e - a));
    }
  }
});

// src/dependencies/20754.cjs
var require__138 = __commonJS({
  "src/dependencies/20754.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      E: () => a
    });
    var n = require__122();
    var s = require__136();
    var r = require__121();
    var o = {
      decay: n.B,
      inertia: n.B,
      tween: s.i,
      keyframes: s.i,
      spring: r.o
    };
    function a(t) {
      "string" == typeof t.type && (t.type = o[t.type]);
    }
  }
});

// src/dependencies/36381.cjs
var require__139 = __commonJS({
  "src/dependencies/36381.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      f: () => z
    });
    var n = require__55();
    var s = require__50();
    var r = require__65();
    var o = require__117();
    var a = require__21();
    var l = require__118();
    var h = require__52();
    var u = (t) => {
      let e = ({
        timestamp: e2
      }) => t(e2);
      return {
        start: (t2 = true) => h.Gt.update(e, t2),
        stop: () => (0, h.WG)(e),
        now: () => h.uv.isProcessing ? h.uv.timestamp : r.k.now()
      };
    };
    var d = require__122();
    var c = require__136();
    var p = require__119();
    var m = require__137();
    var f = require__63();
    var v = require__138();
    var y = require__66();
    var g = require__64();
    var x = (t) => t / 100;
    var w = class extends g.q {
      constructor(t) {
        super(), this.state = "idle", this.startTime = null, this.isStopped = false, this.currentTime = 0, this.holdTime = null, this.playbackSpeed = 1, this.delayState = {
          done: false,
          value: void 0
        }, this.stop = () => {
          let {
            motionValue: t2
          } = this.options;
          t2 && t2.updatedAt !== r.k.now() && this.tick(r.k.now()), this.isStopped = true, "idle" !== this.state && (this.teardown(), this.options.onStop?.());
        }, this.options = t, this.initAnimation(), this.play(), false === t.autoplay && this.pause(), (0, y.U)(this, this.options);
      }
      initAnimation() {
        let {
          options: t
        } = this;
        (0, v.E)(t);
        let {
          type: e = c.i,
          repeat: i = 0,
          repeatDelay: n2 = 0,
          repeatType: s2,
          velocity: r2 = 0
        } = t, {
          keyframes: a2
        } = t, h2 = e || c.i;
        h2 !== c.i && "number" != typeof a2[0] && (this.mixKeyframes = (0, o.F)(x, (0, l.j)(a2[0], a2[1])), a2 = [0, 100]);
        let u2 = h2(a2 === t.keyframes ? t : {
          ...t,
          keyframes: a2
        });
        "mirror" === s2 && (this.mirroredGenerator = h2({
          ...t,
          keyframes: [...a2].reverse(),
          velocity: -r2
        })), null === u2.calculatedDuration && (u2.calculatedDuration = (0, p.t)(u2));
        let {
          calculatedDuration: d2
        } = u2;
        this.calculatedDuration = d2, this.resolvedDuration = d2 + n2, this.totalDuration = this.resolvedDuration * (i + 1) - n2, this.generator = u2;
      }
      updateTime(t) {
        let e = Math.round(t - this.startTime) * this.playbackSpeed;
        null !== this.holdTime ? this.currentTime = this.holdTime : this.currentTime = e;
      }
      tick(t, e = false) {
        let i, {
          generator: n2,
          totalDuration: s2,
          mixKeyframes: r2,
          mirroredGenerator: o2,
          resolvedDuration: l2,
          calculatedDuration: h2
        } = this;
        if (null === this.startTime) return n2.next(0);
        let {
          delay: u2 = 0,
          keyframes: c2,
          repeat: p2,
          repeatType: m2,
          repeatDelay: v2,
          type: y2,
          onUpdate: g2,
          finalKeyframe: x2
        } = this.options;
        this.speed > 0 ? this.startTime = Math.min(this.startTime, t) : this.speed < 0 && (this.startTime = Math.min(t - s2 / this.speed, this.startTime)), e ? this.currentTime = t : this.updateTime(t);
        let w2 = this.currentTime - u2 * (this.playbackSpeed >= 0 ? 1 : -1), S2 = this.playbackSpeed >= 0 ? w2 < 0 : w2 > s2;
        this.currentTime = Math.max(w2, 0), "finished" === this.state && null === this.holdTime && (this.currentTime = s2);
        let b2 = this.currentTime, T2 = n2;
        if (p2) {
          let t2 = Math.min(this.currentTime, s2) / l2, e2 = Math.floor(t2), i2 = t2 % 1;
          !i2 && t2 >= 1 && (i2 = 1), 1 === i2 && e2--, (e2 = Math.min(e2, p2 + 1)) % 2 && ("reverse" === m2 ? (i2 = 1 - i2, v2 && (i2 -= v2 / l2)) : "mirror" === m2 && (T2 = o2)), b2 = (0, a.q)(0, 1, i2) * l2;
        }
        S2 ? (this.delayState.value = c2[0], i = this.delayState) : i = T2.next(b2), r2 && !S2 && (i.value = r2(i.value));
        let {
          done: P2
        } = i;
        S2 || null === h2 || (P2 = this.playbackSpeed >= 0 ? this.currentTime >= s2 : this.currentTime <= 0);
        let A2 = null === this.holdTime && ("finished" === this.state || "running" === this.state && P2);
        return A2 && y2 !== d.B && (i.value = (0, f.X)(c2, this.options, x2, this.speed)), g2 && g2(i.value), A2 && this.finish(), i;
      }
      then(t, e) {
        return this.finished.then(t, e);
      }
      get duration() {
        return (0, n.X)(this.calculatedDuration);
      }
      get iterationDuration() {
        let {
          delay: t = 0
        } = this.options || {};
        return this.duration + (0, n.X)(t);
      }
      get time() {
        return (0, n.X)(this.currentTime);
      }
      set time(t) {
        t = (0, n.f)(t), this.currentTime = t, null === this.startTime || null !== this.holdTime || 0 === this.playbackSpeed ? this.holdTime = t : this.driver && (this.startTime = this.driver.now() - t / this.playbackSpeed), this.driver ? this.driver.start(false) : (this.startTime = 0, this.state = "paused", this.holdTime = t, this.tick(t));
      }
      getGeneratorVelocity() {
        return (0, m.Y)(this.generator, this.currentTime, this.options.velocity);
      }
      get speed() {
        return this.playbackSpeed;
      }
      set speed(t) {
        let e = this.playbackSpeed !== t;
        e && this.driver && this.updateTime(r.k.now()), this.playbackSpeed = t, e && this.driver && (this.time = (0, n.X)(this.currentTime));
      }
      play() {
        if (this.isStopped) return;
        let {
          driver: t = u,
          startTime: e
        } = this.options;
        this.driver || (this.driver = t((t2) => this.tick(t2))), this.options.onPlay?.();
        let i = this.driver.now();
        "finished" === this.state ? (this.updateFinished(), this.startTime = i) : null !== this.holdTime ? this.startTime = i - this.holdTime : this.startTime || (this.startTime = e ?? i), "finished" === this.state && this.speed < 0 && (this.startTime += this.calculatedDuration), this.holdTime = null, this.state = "running", this.driver.start();
      }
      pause() {
        this.state = "paused", this.updateTime(r.k.now()), this.holdTime = this.currentTime;
      }
      complete() {
        "running" !== this.state && this.play(), this.state = "finished", this.holdTime = null;
      }
      finish() {
        this.notifyFinished(), this.teardown(), this.state = "finished", this.options.onComplete?.();
      }
      cancel() {
        this.holdTime = null, this.startTime = 0, this.tick(0), this.teardown(), this.options.onCancel?.();
      }
      teardown() {
        this.state = "idle", this.stopDriver(), this.startTime = this.holdTime = null;
      }
      stopDriver() {
        this.driver && (this.driver.stop(), this.driver = void 0);
      }
      sample(t) {
        return this.startTime = 0, this.tick(t, true);
      }
      attachTimeline(t) {
        return this.options.allowFlatten && (this.options.type = "keyframes", this.options.ease = "linear", this.initAnimation()), this.driver?.stop(), t.observe(this);
      }
    };
    var S = require__53();
    var b = require__59();
    var T = require__70();
    var P = require__129();
    var A = require__128();
    var k = require__130();
    var E = {
      anticipate: P.b,
      backInOut: A.ZZ,
      circInOut: k.tn
    };
    var V = class extends T.m {
      constructor(t) {
        !(function(t2) {
          "string" == typeof t2.ease && t2.ease in E && (t2.ease = E[t2.ease]);
        })(t), (0, v.E)(t), super(t), void 0 !== t.startTime && false !== t.autoplay && (this.startTime = t.startTime), this.options = t;
      }
      updateMotionValue(t) {
        let {
          motionValue: e,
          onUpdate: i,
          onComplete: n2,
          element: s2,
          ...o2
        } = this.options;
        if (!e) return;
        if (void 0 !== t) return void e.set(t);
        let l2 = new w({
          ...o2,
          autoplay: false
        }), h2 = Math.max(10, r.k.now() - this.startTime), u2 = (0, a.q)(0, 10, h2 - 10), d2 = l2.sample(h2).value, {
          name: c2
        } = this.options;
        s2 && c2 && (0, b.e)(s2, c2, d2), e.setWithVelocity(l2.sample(Math.max(0, h2 - u2)).value, d2, u2), l2.stop();
      }
    };
    var C = require__42();
    var M = require__69();
    var D = require__31();
    var R = (t, e) => "zIndex" !== e && !!("number" == typeof t || Array.isArray(t) || "string" == typeof t && (D.f.test(t) || "0" === t) && !t.startsWith("url("));
    function L(t) {
      t.duration = 0, t.type = "keyframes";
    }
    var B = require__60();
    var j = require__71();
    var F = /^(?:oklch|oklab|lab|lch|color|color-mix|light-dark)\(/;
    var O = /* @__PURE__ */ new Set(["color", "backgroundColor", "outlineColor", "fill", "stroke", "borderColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"]);
    var I = (0, B.p)(() => Object.hasOwnProperty.call(Element.prototype, "animate"));
    var W = class extends g.q {
      constructor(t) {
        super(), this.stop = () => {
          this._animation && (this._animation.stop(), this.stopTimeline?.()), this.keyframeResolver?.cancel();
        }, this.createdAt = r.k.now();
        const {
          keyframes: e,
          name: i,
          motionValue: n2,
          element: s2
        } = t;
        t.autoplay ?? (t.autoplay = true), t.delay ?? (t.delay = 0), t.type ?? (t.type = "keyframes"), t.repeat ?? (t.repeat = 0), t.repeatDelay ?? (t.repeatDelay = 0), t.repeatType ?? (t.repeatType = "loop");
        const o2 = s2?.KeyframeResolver || S.h;
        this.keyframeResolver = new o2(e, (e2, i2, n3) => this.onKeyframesResolved(e2, i2, t, !n3), i, n2, s2), this.keyframeResolver?.scheduleResolve();
      }
      onKeyframesResolved(t, e, i, n2) {
        let o2;
        this.keyframeResolver = void 0;
        let {
          name: a2,
          type: l2,
          velocity: h2,
          delay: u2,
          isHandoff: d2,
          onUpdate: c2
        } = i;
        this.resolvedAt = r.k.now();
        let p2 = true;
        !(function(t2, e2, i2, n3) {
          let s2 = t2[0];
          if (null === s2) return false;
          if ("display" === e2 || "visibility" === e2) return true;
          let r2 = t2[t2.length - 1], o3 = R(s2, e2), a3 = R(r2, e2);
          return o3 && a3 ? (function(t3) {
            let e3 = t3[0];
            if (1 === t3.length) return true;
            for (let i3 = 0; i3 < t3.length; i3++) if (t3[i3] !== e3) return true;
          })(t2) || ("spring" === i2 || (0, M.W)(i2)) && n3 : (o3 !== a3 && (0, C.$)(false, `You are trying to animate ${e2} from "${s2}" to "${r2}". "${o3 ? r2 : s2}" is not an animatable value.`, "value-not-animatable"), false);
        })(t, a2, l2, h2) && (p2 = false, (s.W.instantAnimations || !u2) && c2?.((0, f.X)(t, i, e)), t[0] = t[t.length - 1], L(i), i.repeat = 0);
        let m2 = n2 ? this.resolvedAt && this.resolvedAt - this.createdAt > 40 ? this.resolvedAt : this.createdAt : void 0, {
          onComplete: v2
        } = i;
        if (i.startTime ?? (i.startTime = m2), i.finalKeyframe = e, i.keyframes = t, i.onComplete = () => {
          v2?.(), this.notifyFinished();
        }, p2 && !d2 && (function(t2) {
          let {
            motionValue: e2,
            name: i2,
            repeatDelay: n3,
            repeatType: s2,
            damping: r2,
            type: o3,
            keyframes: a3
          } = t2;
          if (!i2 || !(j.M.has(i2) || O.has(i2))) return false;
          let l3 = e2?.owner?.current;
          if (!(l3 instanceof HTMLElement) && !(l3 instanceof SVGElement)) return false;
          let {
            onUpdate: h3,
            transformTemplate: u3
          } = e2.owner.getProps();
          return I() && (j.M.has(i2) || O.has(i2) && (function(t3) {
            for (let e3 = 0; e3 < t3.length; e3++) if ("string" == typeof t3[e3] && F.test(t3[e3])) return true;
            return false;
          })(a3)) && ("transform" !== i2 || !u3) && !h3 && !n3 && "mirror" !== s2 && 0 !== r2 && "inertia" !== o3;
        })(i)) {
          i.element = i.motionValue?.owner?.current;
          try {
            o2 = new V(i);
          } catch {
            o2 = new w(i);
          }
        } else o2 = new w(i);
        this.pendingTimeline && (this.stopTimeline = o2.attachTimeline(this.pendingTimeline), this.pendingTimeline = void 0), this._animation = o2;
      }
      get finished() {
        return this._animation ? this._animation.finished : super.finished;
      }
      then(t, e) {
        return this.finished.finally(t).then(() => {
        });
      }
      get animation() {
        return this._animation || (this.keyframeResolver?.resume(), (0, S.q)()), this._animation;
      }
      get duration() {
        return this.animation.duration;
      }
      get iterationDuration() {
        return this.animation.iterationDuration;
      }
      get time() {
        return this.animation.time;
      }
      set time(t) {
        this.animation.time = t;
      }
      get speed() {
        return this.animation.speed;
      }
      get state() {
        return this.animation.state;
      }
      set speed(t) {
        this.animation.speed = t;
      }
      get startTime() {
        return this.animation.startTime;
      }
      attachTimeline(t) {
        return this._animation ? this.stopTimeline = this.animation.attachTimeline(t) : this.pendingTimeline = t, () => this.stop();
      }
      play() {
        this.animation.play();
      }
      pause() {
        this.animation.pause();
      }
      complete() {
        this.animation.complete();
      }
      cancel() {
        this._animation && this.animation.cancel(), this.keyframeResolver?.cancel();
      }
    };
    var U = require__112();
    var N = require__20();
    var $ = {
      type: "spring",
      stiffness: 500,
      damping: 25,
      restSpeed: 10
    };
    var X = {
      type: "keyframes",
      duration: 0.8
    };
    var G = {
      type: "keyframes",
      ease: [0.25, 0.1, 0.35, 1],
      duration: 0.3
    };
    var K = /* @__PURE__ */ new Set(["when", "delay", "delayChildren", "staggerChildren", "staggerDirection", "repeat", "repeatType", "repeatDelay", "from", "elapsed"]);
    var z = (t, e, i, r2 = {}, o2, a2) => (l2) => {
      let u2 = (0, U.r)(r2, t) || {}, d2 = u2.delay || r2.delay || 0, {
        elapsed: c2 = 0
      } = r2;
      c2 -= (0, n.f)(d2);
      let p2 = {
        keyframes: Array.isArray(i) ? i : [null, i],
        ease: "easeOut",
        velocity: e.getVelocity(),
        ...u2,
        delay: -c2,
        onUpdate: (t2) => {
          e.set(t2), u2.onUpdate && u2.onUpdate(t2);
        },
        onComplete: () => {
          l2(), u2.onComplete && u2.onComplete();
        },
        name: t,
        motionValue: e,
        element: a2 ? void 0 : o2
      };
      !(function(t2) {
        for (let e2 in t2) if (!K.has(e2)) return true;
        return false;
      })(u2) && Object.assign(p2, ((t2, {
        keyframes: e2
      }) => e2.length > 2 ? X : N.f.has(t2) ? t2.startsWith("scale") ? {
        type: "spring",
        stiffness: 550,
        damping: 0 === e2[1] ? 2 * Math.sqrt(550) : 30,
        restSpeed: 10
      } : $ : G)(t, p2)), p2.duration && (p2.duration = (0, n.f)(p2.duration)), p2.repeatDelay && (p2.repeatDelay = (0, n.f)(p2.repeatDelay)), void 0 !== p2.from && (p2.keyframes[0] = p2.from);
      let m2 = false;
      if (false !== p2.type && (0 !== p2.duration || p2.repeatDelay) || (L(p2), 0 === p2.delay && (m2 = true)), (s.W.instantAnimations || s.W.skipAnimations || o2?.shouldSkipAnimations || u2.skipAnimations) && (m2 = true, L(p2), p2.delay = 0), p2.allowFlatten = !u2.type && !u2.ease, m2 && !a2 && void 0 !== e.get()) {
        let t2 = (0, f.X)(p2.keyframes, u2);
        if (void 0 !== t2) return void h.Gt.update(() => {
          p2.onUpdate(t2), p2.onComplete();
        });
      }
      return u2.isSync ? new w(p2) : new W(p2);
    };
  }
});

// src/dependencies/12663.cjs
var require__140 = __commonJS({
  "src/dependencies/12663.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      L: () => n
    });
    function n(t, e, i, s = 0, r = 1) {
      let o = Array.from(t).sort((t2, e2) => t2.sortNodePosition(e2)).indexOf(e), a = t.size, l = (a - 1) * s;
      return "function" == typeof i ? i(o, a) : 1 === r ? o * s : l - o * s;
    }
  }
});

// src/dependencies/38294.cjs
var require__141 = __commonJS({
  "src/dependencies/38294.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      _: () => v
    });
    var n = require__110();
    var s = require__112();
    var r = require__111();
    var o = require__39();
    var a = require__114();
    var l = require__115();
    var h = require__116();
    var u = require__139();
    var d = require__52();
    var c = "u" > typeof window;
    function p(t, e, {
      delay: i = 0,
      transitionOverride: n2,
      type: m2
    } = {}) {
      let {
        transition: f2,
        transitionEnd: v2,
        ...y
      } = e, g = t.getDefaultTransition();
      f2 = f2 ? (0, r.K)(f2, g) : g;
      let x = f2?.reduceMotion, w = f2?.skipAnimations;
      n2 && (f2 = n2);
      let S = [], b = m2 && t.animationState && t.animationState.getState()[m2], T = f2?.path;
      for (let e2 in T && T.animateVisualElement(t, y, f2, i, S), y) {
        let n3 = t.getValue(e2, t.latestValues[e2] ?? null), r2 = y[e2];
        if (void 0 === r2 || b && (function({
          protectedKeys: t2,
          needsAnimating: e3
        }, i2) {
          let n4 = t2.hasOwnProperty(i2) && true !== e3[i2];
          return e3[i2] = false, n4;
        })(b, e2)) continue;
        let a2 = {
          delay: i,
          ...(0, s.r)(f2 || {}, e2)
        };
        w && (a2.skipAnimations = true);
        let p2 = n3.get();
        if (void 0 !== p2 && !n3.isAnimating() && !Array.isArray(r2) && r2 === p2 && !a2.velocity) {
          d.Gt.update(() => n3.set(r2));
          continue;
        }
        let m3 = false;
        if (c && window.MotionHandoffAnimation) {
          let i2 = (0, h.P)(t);
          if (i2) {
            let t2 = window.MotionHandoffAnimation(i2, e2, d.Gt);
            null !== t2 && (a2.startTime = t2, m3 = true);
          }
        }
        (0, l.g)(t, e2);
        let v3 = x ?? t.shouldReduceMotion;
        n3.start((0, u.f)(e2, n3, r2, v3 && o.$.has(e2) ? {
          type: false
        } : a2, t, m3));
        let g2 = n3.animation;
        g2 && S.push(g2);
      }
      if (v2) {
        let e2 = () => d.Gt.update(() => {
          v2 && (0, a.U)(t, v2);
        });
        S.length ? Promise.all(S).then(e2) : e2();
      }
      return S;
    }
    var m = require__140();
    function f(t, e, i = {}) {
      let s2 = (0, n.K)(t, e, "exit" === i.type ? t.presenceContext?.custom : void 0), {
        transition: r2 = t.getDefaultTransition() || {}
      } = s2 || {};
      i.transitionOverride && (r2 = i.transitionOverride);
      let o2 = s2 ? () => Promise.all(p(t, s2, i)) : () => Promise.resolve(), a2 = t.variantChildren && t.variantChildren.size ? (n2 = 0) => {
        let {
          delayChildren: s3 = 0,
          staggerChildren: o3,
          staggerDirection: a3
        } = r2;
        return (function(t2, e2, i2 = 0, n3 = 0, s4 = 0, r3 = 1, o4) {
          let a4 = [];
          for (let l3 of t2.variantChildren) l3.notify("AnimationStart", e2), a4.push(f(l3, e2, {
            ...o4,
            delay: i2 + ("function" == typeof n3 ? 0 : n3) + (0, m.L)(t2.variantChildren, l3, n3, s4, r3)
          }).then(() => l3.notify("AnimationComplete", e2)));
          return Promise.all(a4);
        })(t, e, n2, s3, o3, a3, i);
      } : () => Promise.resolve(), {
        when: l2
      } = r2;
      if (!l2) return Promise.all([o2(), a2(i.delay)]);
      {
        let [t2, e2] = "beforeChildren" === l2 ? [o2, a2] : [a2, o2];
        return t2().then(() => e2());
      }
    }
    function v(t, e, i = {}) {
      let s2;
      if (t.notify("AnimationStart", e), Array.isArray(e)) s2 = Promise.all(e.map((e2) => f(t, e2, i)));
      else if ("string" == typeof e) s2 = f(t, e, i);
      else {
        let r2 = "function" == typeof e ? (0, n.K)(t, e, i.custom) : e;
        s2 = Promise.all(p(t, r2, i));
      }
      return s2.then(() => {
        t.notify("AnimationComplete", e);
      });
    }
  }
});

// src/dependencies/94601.cjs
var require__142 = __commonJS({
  "src/dependencies/94601.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      G: () => n
    });
    var n = (t) => "object" == typeof t && null !== t;
  }
});

// src/dependencies/69028.cjs
var require__143 = __commonJS({
  "src/dependencies/69028.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      x: () => s
    });
    var n = require__142();
    function s(t) {
      return (0, n.G)(t) && "ownerSVGElement" in t;
    }
  }
});

// src/dependencies/58392.cjs
var require__144 = __commonJS({
  "src/dependencies/58392.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      K: () => n
    });
    function n(t, e, i) {
      if (null == t) return [];
      if (t instanceof EventTarget) return [t];
      if ("string" == typeof t) {
        let n2 = document;
        e && (n2 = e.current);
        let s = i?.[t] ?? n2.querySelectorAll(t);
        return s ? Array.from(s) : [];
      }
      return Array.from(t).filter((t2) => null != t2);
    }
  }
});

// src/dependencies/51275.cjs
var require__145 = __commonJS({
  "src/dependencies/51275.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    var n;
    var s;
    interop.d(exports, {
      X: () => m
    });
    var r = require__143();
    var o = require__144();
    var a = /* @__PURE__ */ new WeakMap();
    var l = (t, e, i) => (n2, s2) => s2 && s2[0] ? s2[0][t + "Size"] : (0, r.x)(n2) && "getBBox" in n2 ? n2.getBBox()[e] : n2[i];
    var h = l("inline", "width", "offsetWidth");
    var u = l("block", "height", "offsetHeight");
    function d({
      target: t,
      borderBoxSize: e
    }) {
      a.get(t)?.forEach((i) => {
        i(t, {
          get width() {
            return h(t, e);
          },
          get height() {
            return u(t, e);
          }
        });
      });
    }
    function c(t) {
      t.forEach(d);
    }
    var p = /* @__PURE__ */ new Set();
    function m(t, e) {
      let i;
      return "function" == typeof t ? (p.add(t), s || (s = () => {
        let t2 = {
          get width() {
            return window.innerWidth;
          },
          get height() {
            return window.innerHeight;
          }
        };
        p.forEach((e2) => e2(t2));
      }, window.addEventListener("resize", s)), () => {
        p.delete(t), p.size || "function" != typeof s || (window.removeEventListener("resize", s), s = void 0);
      }) : (!n && "u" > typeof ResizeObserver && (n = new ResizeObserver(c)), (i = (0, o.K)(t)).forEach((t2) => {
        let i2 = a.get(t2);
        i2 || (i2 = /* @__PURE__ */ new Set(), a.set(t2, i2)), i2.add(e), n?.observe(t2);
      }), () => {
        i.forEach((t2) => {
          let i2 = a.get(t2);
          i2?.delete(e), i2?.size || n?.unobserve(t2);
        });
      });
    }
  }
});

// src/dependencies/79196.cjs
var require__146 = __commonJS({
  "src/dependencies/79196.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      tF: () => o,
      xQ: () => r
    });
    var n = HostReact;
    var s = require__103();
    function r(t = true) {
      let e = (0, n.useContext)(s.t);
      if (null === e) return [true, null];
      let {
        isPresent: i,
        onExitComplete: o2,
        register: a
      } = e, l = (0, n.useId)();
      (0, n.useEffect)(() => {
        if (t) return a(l);
      }, [t]);
      let h = (0, n.useCallback)(() => t && o2 && o2(l), [l, o2, t]);
      return !i && o2 ? [false, h] : [true];
    }
    function o() {
      var t;
      return null === (t = (0, n.useContext)(s.t)) || t.isPresent;
    }
  }
});

// src/dependencies/72721.cjs
var require__147 = __commonJS({
  "src/dependencies/72721.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      z: () => o
    });
    var n = require__139();
    var s = require__74();
    var r = require__38();
    function o(t, e, i) {
      let o2 = (0, r.S)(t) ? t : (0, s.OQ)(t);
      return o2.start((0, n.f)("", o2, e, i)), o2.animation;
    }
  }
});

// src/dependencies/78757.cjs
var require__148 = __commonJS({
  "src/dependencies/78757.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      s: () => s
    });
    var n = require__142();
    function s(t) {
      return (0, n.G)(t) && "offsetHeight" in t && !("ownerSVGElement" in t);
    }
  }
});

// src/dependencies/24857.cjs
var require__149 = __commonJS({
  "src/dependencies/24857.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      P: () => ih
    });
    var n = require__20();
    var s = require__36();
    var r = require__37();
    var o = require__38();
    var a = require__54();
    var l = require__83();
    var h = class extends l.BX {
      constructor() {
        super(...arguments), this.KeyframeResolver = a.K;
      }
      sortInstanceNodePosition(t, e) {
        return 2 & t.compareDocumentPosition(e) ? 1 : -1;
      }
      getBaseTargetFromProps(t, e) {
        let i = t.style;
        return i ? i[e] : void 0;
      }
      removeValueFromRenderState(t, {
        vars: e,
        style: i
      }) {
        delete e[t], delete i[t];
      }
      handleChildMotionValue() {
        this.childSubscription && (this.childSubscription(), delete this.childSubscription);
        let {
          children: t
        } = this.props;
        (0, o.S)(t) && (this.childSubscription = t.on("change", (t10) => {
          this.current && (this.current.textContent = `${t10}`);
        }));
      }
    };
    var u = require__84();
    var d = require__87();
    var c = /* @__PURE__ */ new Set(["baseFrequency", "diffuseConstant", "kernelMatrix", "kernelUnitLength", "keySplines", "keyTimes", "limitingConeAngle", "markerHeight", "markerWidth", "numOctaves", "targetX", "targetY", "surfaceScale", "specularConstant", "specularExponent", "stdDeviation", "tableValues", "viewBox", "gradientTransform", "pathLength", "startOffset", "textLength", "lengthAdjust"]);
    var p = require__88();
    function m(t, {
      style: e,
      vars: i
    }, n2, s2) {
      let r2, o2 = t.style;
      for (r2 in e) o2[r2] = e[r2];
      for (r2 in s2?.applyProjectionStyles(o2, n2), i) o2.setProperty(r2, i[r2]);
    }
    var f = require__94();
    var v = class extends h {
      constructor() {
        super(...arguments), this.type = "svg", this.isSVGTag = false, this.measureInstanceViewportBox = r.ge;
      }
      getBaseTargetFromProps(t, e) {
        return t[e];
      }
      readValueFromInstance(t, e) {
        if (n.f.has(e)) {
          let t10 = (0, s.D)(e);
          return t10 && t10.default || 0;
        }
        if (d.W.includes(e)) {
          let i = getComputedStyle(t)[e];
          if ("string" == typeof i && i) return i.trim();
        }
        return e = c.has(e) ? e : (0, u.I)(e), t.getAttribute(e);
      }
      scrapeMotionValuesFromProps(t, e, i) {
        return (0, f.x)(t, e, i);
      }
      build(t, e, i) {
        (0, d.B)(t, e, this.isSVGTag, i.transformTemplate, i.style);
      }
      renderInstance(t, e, i, n2) {
        for (let i2 in m(t, e, void 0, n2), e.attrs) t.setAttribute(c.has(i2) ? i2 : (0, u.I)(i2), e.attrs[i2]);
      }
      mount(t) {
        this.isSVGTag = (0, p.n)(t.tagName), super.mount(t);
      }
    };
    var y = require__42();
    var g = require__44();
    var x = require__47();
    var w = require__98();
    var S = require__86();
    var b = require__93();
    var T = class extends h {
      constructor() {
        super(...arguments), this.type = "html", this.renderInstance = m;
      }
      mount(t) {
        (0, y.V)(!!t.style, "motion.create() components must forward their ref to a HTML or SVG element", "custom-component-ref"), super.mount(t);
      }
      readValueFromInstance(t, e) {
        if (n.f.has(e)) return this.projection?.isProjecting ? (0, x.zs)(e) : (0, x.Ib)(t, e);
        {
          let i = window.getComputedStyle(t), n2 = ((0, g.j4)(e) ? i.getPropertyValue(e) : i[e]) || 0;
          return "string" == typeof n2 ? n2.trim() : n2;
        }
      }
      measureInstanceViewportBox(t, {
        transformPagePoint: e
      }) {
        return (0, w.m)(t, e);
      }
      build(t, e, i) {
        (0, S.O)(t, e, i.transformTemplate);
      }
      scrapeMotionValuesFromProps(t, e, i) {
        return (0, b.x)(t, e, i);
      }
    };
    var P = HostReact;
    var A = require__99();
    var k = require__109();
    var E = class {
      constructor(t) {
        this.isMounted = false, this.node = t;
      }
      update() {
      }
    };
    var V = require__141();
    var C = require__140();
    var M = require__77();
    var D = require__78();
    var R = D._.length;
    var L = require__76();
    var B = require__113();
    var j = require__110();
    function F(t, e) {
      if (!Array.isArray(e)) return false;
      let i = e.length;
      if (i !== t.length) return false;
      for (let n2 = 0; n2 < i; n2++) if (e[n2] !== t[n2]) return false;
      return true;
    }
    var O = [...D.U].reverse();
    var I = D.U.length;
    function W(t = false) {
      return {
        isActive: t,
        protectedKeys: {},
        needsAnimating: {},
        prevResolvedValues: {}
      };
    }
    function U() {
      return {
        animate: W(true),
        whileInView: W(),
        whileHover: W(),
        whileTap: W(),
        whileDrag: W(),
        whileFocus: W(),
        exit: W()
      };
    }
    var N = class extends E {
      constructor(t) {
        super(t), t.animationState || (t.animationState = (function(t10) {
          let e = (e10) => Promise.all(e10.map(({
            animation: e11,
            options: i2
          }) => (0, V._)(t10, e11, i2))), i = U(), n2 = true, s2 = false, r2 = (e10) => (i2, n3) => {
            let s3 = (0, j.K)(t10, n3, "exit" === e10 ? t10.presenceContext?.custom : void 0);
            if (s3) {
              let {
                transition: t11,
                transitionEnd: e11,
                ...n4
              } = s3;
              i2 = {
                ...i2,
                ...n4,
                ...e11
              };
            }
            return i2;
          };
          function o2(o3) {
            let {
              props: a2
            } = t10, l2 = (function t11(e10) {
              if (!e10) return;
              if (!e10.isControllingVariants) {
                let i3 = e10.parent && t11(e10.parent) || {};
                return void 0 !== e10.props.initial && (i3.initial = e10.props.initial), i3;
              }
              let i2 = {};
              for (let t12 = 0; t12 < R; t12++) {
                let n3 = D._[t12], s3 = e10.props[n3];
                ((0, M.w)(s3) || false === s3) && (i2[n3] = s3);
              }
              return i2;
            })(t10.parent) || {}, h2 = [], u2 = /* @__PURE__ */ new Set(), d2 = {}, c2 = 1 / 0;
            for (let e10 = 0; e10 < I; e10++) {
              var p2, m2;
              let f3 = O[e10], v2 = i[f3], y2 = void 0 !== a2[f3] ? a2[f3] : l2[f3], g2 = (0, M.w)(y2), x2 = f3 === o3 ? v2.isActive : null;
              false === x2 && (c2 = e10);
              let w2 = y2 === l2[f3] && y2 !== a2[f3] && g2;
              if (w2 && (n2 || s2) && t10.manuallyAnimateOnMount && (w2 = false), v2.protectedKeys = {
                ...d2
              }, !v2.isActive && null === x2 || !y2 && !v2.prevProp || (0, L.N)(y2) || "boolean" == typeof y2) continue;
              if ("exit" === f3 && v2.isActive && true !== x2) {
                v2.prevResolvedValues && (d2 = {
                  ...d2,
                  ...v2.prevResolvedValues
                });
                continue;
              }
              let S2 = (p2 = v2.prevProp, "string" == typeof (m2 = y2) ? m2 !== p2 : !!Array.isArray(m2) && !F(m2, p2)), b2 = S2 || f3 === o3 && v2.isActive && !w2 && g2 || e10 > c2 && g2, T2 = false, P2 = Array.isArray(y2) ? y2 : [y2], A2 = P2.reduce(r2(f3), {});
              false === x2 && (A2 = {});
              let {
                prevResolvedValues: k2 = {}
              } = v2, E2 = {
                ...k2,
                ...A2
              }, V2 = (e11) => {
                b2 = true, u2.has(e11) && (T2 = true, u2.delete(e11)), v2.needsAnimating[e11] = true;
                let i2 = t10.getValue(e11);
                i2 && (i2.liveStyle = false);
              };
              for (let t11 in E2) {
                let e11 = A2[t11], i2 = k2[t11];
                if (!d2.hasOwnProperty(t11)) ((0, B.p)(e11) && (0, B.p)(i2) ? !F(e11, i2) || S2 : e11 !== i2) ? null != e11 ? V2(t11) : u2.add(t11) : void 0 !== e11 && u2.has(t11) ? V2(t11) : v2.protectedKeys[t11] = true;
              }
              v2.prevProp = y2, v2.prevResolvedValues = A2, v2.isActive && (d2 = {
                ...d2,
                ...A2
              }), (n2 || s2) && t10.blockInitialAnimation && (b2 = false);
              let D2 = w2 && S2, R2 = !D2 || T2;
              b2 && R2 && h2.push(...P2.map((e11) => {
                let i2 = {
                  type: f3
                };
                if ("string" == typeof e11 && (n2 || s2) && !D2 && t10.manuallyAnimateOnMount && t10.parent) {
                  let {
                    parent: n3
                  } = t10, s3 = (0, j.K)(n3, e11);
                  if (n3.enteringChildren && s3) {
                    let {
                      delayChildren: e12
                    } = s3.transition || {};
                    i2.delay = (0, C.L)(n3.enteringChildren, t10, e12);
                  }
                }
                return {
                  animation: e11,
                  options: i2
                };
              }));
            }
            if (u2.size) {
              let e10 = {};
              if ("boolean" != typeof a2.initial) {
                let i2 = (0, j.K)(t10, Array.isArray(a2.initial) ? a2.initial[0] : a2.initial);
                i2 && i2.transition && (e10.transition = i2.transition);
              }
              u2.forEach((i2) => {
                let n3 = t10.getBaseTarget(i2), s3 = t10.getValue(i2);
                s3 && (s3.liveStyle = true), e10[i2] = n3 ?? null;
              }), h2.push({
                animation: e10
              });
            }
            let f2 = !!h2.length;
            return n2 && (false === a2.initial || a2.initial === a2.animate) && !t10.manuallyAnimateOnMount && (f2 = false), n2 = false, s2 = false, f2 ? e(h2) : Promise.resolve();
          }
          return {
            animateChanges: o2,
            setActive: function(e10, n3) {
              if (i[e10].isActive === n3) return Promise.resolve();
              t10.variantChildren?.forEach((t11) => t11.animationState?.setActive(e10, n3)), i[e10].isActive = n3;
              let s3 = o2(e10);
              for (let t11 in i) i[t11].protectedKeys = {};
              return s3;
            },
            setAnimateFunction: function(i2) {
              e = i2(t10);
            },
            getState: () => i,
            reset: () => {
              i = U(), s2 = true;
            }
          };
        })(t));
      }
      updateAnimationControlsSubscription() {
        let {
          animate: t
        } = this.node.getProps();
        (0, L.N)(t) && (this.unmountControls = t.subscribe(this.node));
      }
      mount() {
        this.updateAnimationControlsSubscription();
      }
      update() {
        let {
          animate: t
        } = this.node.getProps(), {
          animate: e
        } = this.node.prevProps || {};
        t !== e && this.updateAnimationControlsSubscription();
      }
      unmount() {
        this.node.animationState.reset(), this.unmountControls?.();
      }
    };
    var $ = 0;
    var X = class extends E {
      constructor() {
        super(...arguments), this.id = $++, this.isExitComplete = false;
      }
      update() {
        if (!this.node.presenceContext) return;
        let {
          isPresent: t,
          onExitComplete: e
        } = this.node.presenceContext, {
          isPresent: i
        } = this.node.prevPresenceContext || {};
        if (!this.node.animationState || t === i) return;
        if (t && false === i) {
          if (this.isExitComplete) {
            let {
              initial: t10,
              custom: e10
            } = this.node.getProps();
            if ("string" == typeof t10 || "object" == typeof t10 && null !== t10 && !Array.isArray(t10)) {
              let i2 = (0, j.K)(this.node, t10, e10);
              if (i2) {
                let {
                  transition: t11,
                  transitionEnd: e11,
                  ...n3
                } = i2;
                for (let t12 in n3) this.node.getValue(t12)?.jump(n3[t12]);
              }
            }
            this.node.animationState.reset(), this.node.animationState.animateChanges();
          } else this.node.animationState.setActive("exit", false);
          this.isExitComplete = false;
          return;
        }
        let n2 = this.node.animationState.setActive("exit", !t);
        e && !t && n2.then(() => {
          this.isExitComplete = true, e(this.id);
        });
      }
      mount() {
        let {
          register: t,
          onExitComplete: e
        } = this.node.presenceContext || {};
        e && e(this.id), t && (this.unmount = t(this.id));
      }
      unmount() {
      }
    };
    var G = require__49();
    var K = {
      x: false,
      y: false
    };
    function z(t) {
      return [t("x"), t("y")];
    }
    var H = require__28();
    var q = require__90();
    function Y(t) {
      return t.max - t.min;
    }
    function _(t, e, i, n2 = 0.5) {
      t.origin = n2, t.originPoint = (0, q.k)(e.min, e.max, t.origin), t.scale = Y(i) / Y(e), t.translate = (0, q.k)(i.min, i.max, t.origin) - t.originPoint, (t.scale >= 0.9999 && t.scale <= 1.0001 || isNaN(t.scale)) && (t.scale = 1), (t.translate >= -0.01 && t.translate <= 0.01 || isNaN(t.translate)) && (t.translate = 0);
    }
    function Q(t, e, i, n2) {
      _(t.x, e.x, i.x, n2 ? n2.originX : void 0), _(t.y, e.y, i.y, n2 ? n2.originY : void 0);
    }
    function Z(t, e, i, n2 = 0) {
      t.min = (n2 ? (0, q.k)(i.min, i.max, n2) : i.min) + e.min, t.max = t.min + Y(e);
    }
    function J(t, e, i, n2 = 0) {
      let s2 = n2 ? (0, q.k)(i.min, i.max, n2) : i.min;
      t.min = e.min - s2, t.max = t.min + Y(e);
    }
    function tt(t, e, i, n2) {
      J(t.x, e.x, i.x, n2?.x), J(t.y, e.y, i.y, n2?.y);
    }
    var te = require__52();
    var ti = require__115();
    var tn = require__95();
    var ts = require__139();
    var tr = /* @__PURE__ */ new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "A"]);
    var to = /* @__PURE__ */ new Set(["INPUT", "SELECT", "TEXTAREA"]);
    function ta(t, e, i, n2 = {
      passive: true
    }) {
      return t.addEventListener(e, i, n2), () => t.removeEventListener(e, i, n2);
    }
    var tl = require__145();
    var th = (t) => "mouse" === t.pointerType ? "number" != typeof t.button || t.button <= 0 : false !== t.isPrimary;
    function tu(t) {
      return {
        point: {
          x: t.pageX,
          y: t.pageY
        }
      };
    }
    function td(t, e, i, n2) {
      return ta(t, e, (t10) => th(t10) && i(t10, tu(t10)), n2);
    }
    var tc = ({
      current: t
    }) => t ? t.ownerDocument.defaultView : null;
    var tp = require__107();
    var tm = require__117();
    var tf = require__55();
    var tv = (t, e) => Math.abs(t - e);
    var ty = /* @__PURE__ */ new Set(["auto", "scroll"]);
    var tg = class {
      constructor(t, e, {
        transformPagePoint: i,
        contextWindow: n2 = window,
        dragSnapToOrigin: s2 = false,
        distanceThreshold: r2 = 3,
        element: o2
      } = {}) {
        if (this.startEvent = null, this.lastMoveEvent = null, this.lastMoveEventInfo = null, this.lastRawMoveEventInfo = null, this.handlers = {}, this.contextWindow = window, this.scrollPositions = /* @__PURE__ */ new Map(), this.removeScrollListeners = null, this.onElementScroll = (t10) => {
          this.handleScroll(t10.target);
        }, this.onWindowScroll = () => {
          this.handleScroll(window);
        }, this.updatePoint = () => {
          var t10, e10;
          if (!(this.lastMoveEvent && this.lastMoveEventInfo)) return;
          this.lastRawMoveEventInfo && (this.lastMoveEventInfo = tx(this.lastRawMoveEventInfo, this.transformPagePoint));
          let i2 = tS(this.lastMoveEventInfo, this.history), n3 = null !== this.startEvent, s3 = (t10 = i2.offset, e10 = {
            x: 0,
            y: 0
          }, Math.sqrt(tv(t10.x, e10.x) ** 2 + tv(t10.y, e10.y) ** 2) >= this.distanceThreshold);
          if (!n3 && !s3) return;
          let {
            point: r3
          } = i2, {
            timestamp: o3
          } = te.uv;
          this.history.push({
            ...r3,
            timestamp: o3
          });
          let {
            onStart: a3,
            onMove: l3
          } = this.handlers;
          n3 || (a3 && a3(this.lastMoveEvent, i2), this.startEvent = this.lastMoveEvent), l3 && l3(this.lastMoveEvent, i2);
        }, this.handlePointerMove = (t10, e10) => {
          this.lastMoveEvent = t10, this.lastRawMoveEventInfo = e10, this.lastMoveEventInfo = tx(e10, this.transformPagePoint), te.Gt.update(this.updatePoint, true);
        }, this.handlePointerUp = (t10, e10) => {
          this.end();
          let {
            onEnd: i2,
            onSessionEnd: n3,
            resumeAnimation: s3
          } = this.handlers;
          if ((this.dragSnapToOrigin || !this.startEvent) && s3 && s3(), !(this.lastMoveEvent && this.lastMoveEventInfo)) return;
          let r3 = tS("pointercancel" === t10.type ? this.lastMoveEventInfo : tx(e10, this.transformPagePoint), this.history);
          this.startEvent && i2 && i2(t10, r3), n3 && n3(t10, r3);
        }, !th(t)) return;
        this.dragSnapToOrigin = s2, this.handlers = e, this.transformPagePoint = i, this.distanceThreshold = r2, this.contextWindow = n2 || window;
        const a2 = tx(tu(t), this.transformPagePoint), {
          point: l2
        } = a2, {
          timestamp: h2
        } = te.uv;
        this.history = [{
          ...l2,
          timestamp: h2
        }];
        const {
          onSessionStart: u2
        } = e;
        u2 && u2(t, tS(a2, this.history));
        const d2 = {
          passive: true,
          capture: true
        };
        this.removeListeners = (0, tm.F)(td(this.contextWindow, "pointermove", this.handlePointerMove, d2), td(this.contextWindow, "pointerup", this.handlePointerUp, d2), td(this.contextWindow, "pointercancel", this.handlePointerUp, d2)), o2 && this.startScrollTracking(o2);
      }
      startScrollTracking(t) {
        let e = t.parentElement;
        for (; e; ) {
          let t10 = getComputedStyle(e);
          (ty.has(t10.overflowX) || ty.has(t10.overflowY)) && this.scrollPositions.set(e, {
            x: e.scrollLeft,
            y: e.scrollTop
          }), e = e.parentElement;
        }
        this.scrollPositions.set(window, {
          x: window.scrollX,
          y: window.scrollY
        }), window.addEventListener("scroll", this.onElementScroll, {
          capture: true
        }), window.addEventListener("scroll", this.onWindowScroll), this.removeScrollListeners = () => {
          window.removeEventListener("scroll", this.onElementScroll, {
            capture: true
          }), window.removeEventListener("scroll", this.onWindowScroll);
        };
      }
      handleScroll(t) {
        let e = this.scrollPositions.get(t);
        if (!e) return;
        let i = t === window, n2 = i ? {
          x: window.scrollX,
          y: window.scrollY
        } : {
          x: t.scrollLeft,
          y: t.scrollTop
        }, s2 = {
          x: n2.x - e.x,
          y: n2.y - e.y
        };
        (0 !== s2.x || 0 !== s2.y) && (i ? this.lastMoveEventInfo && (this.lastMoveEventInfo.point.x += s2.x, this.lastMoveEventInfo.point.y += s2.y) : this.history.length > 0 && (this.history[0].x -= s2.x, this.history[0].y -= s2.y), this.scrollPositions.set(t, n2), te.Gt.update(this.updatePoint, true));
      }
      updateHandlers(t) {
        this.handlers = t;
      }
      end() {
        this.removeListeners && this.removeListeners(), this.removeScrollListeners && this.removeScrollListeners(), this.scrollPositions.clear(), (0, te.WG)(this.updatePoint);
      }
    };
    function tx(t, e) {
      return e ? {
        point: e(t.point)
      } : t;
    }
    function tw(t, e) {
      return {
        x: t.x - e.x,
        y: t.y - e.y
      };
    }
    function tS({
      point: t
    }, e) {
      return {
        point: t,
        delta: tw(t, tb(e)),
        offset: tw(t, e[0]),
        velocity: (function(t10) {
          if (t10.length < 2) return {
            x: 0,
            y: 0
          };
          let e10 = t10.length - 1, i = null, n2 = tb(t10);
          for (; e10 >= 0 && (i = t10[e10], !(n2.timestamp - i.timestamp > (0, tf.f)(0.1))); ) e10--;
          if (!i) return {
            x: 0,
            y: 0
          };
          i === t10[0] && t10.length > 2 && n2.timestamp - i.timestamp > 2 * (0, tf.f)(0.1) && (i = t10[1]);
          let s2 = (0, tf.X)(n2.timestamp - i.timestamp);
          if (0 === s2) return {
            x: 0,
            y: 0
          };
          let r2 = {
            x: (n2.x - i.x) / s2,
            y: (n2.y - i.y) / s2
          };
          return r2.x === 1 / 0 && (r2.x = 0), r2.y === 1 / 0 && (r2.y = 0), r2;
        })(e)
      };
    }
    function tb(t) {
      return t[t.length - 1];
    }
    var tT = require__132();
    var tP = require__21();
    function tA(t, e, i) {
      return {
        min: void 0 !== e ? t.min + e : void 0,
        max: void 0 !== i ? t.max + i - (t.max - t.min) : void 0
      };
    }
    function tk(t, e) {
      let i = e.min - t.min, n2 = e.max - t.max;
      return e.max - e.min < t.max - t.min && ([i, n2] = [n2, i]), {
        min: i,
        max: n2
      };
    }
    function tE(t, e, i) {
      return {
        min: tV(t, e),
        max: tV(t, i)
      };
    }
    function tV(t, e) {
      return "number" == typeof t ? t : t[e] || 0;
    }
    var tC = /* @__PURE__ */ new WeakMap();
    var tM = class {
      constructor(t) {
        this.openDragLock = null, this.isDragging = false, this.currentDirection = null, this.originPoint = {
          x: 0,
          y: 0
        }, this.constraints = false, this.hasMutatedConstraints = false, this.elastic = (0, r.ge)(), this.latestPointerEvent = null, this.latestPanInfo = null, this.visualElement = t;
      }
      start(t, {
        snapToCursor: e = false,
        distanceThreshold: i
      } = {}) {
        let {
          presenceContext: n2
        } = this.visualElement;
        if (n2 && false === n2.isPresent) return;
        let s2 = (t10) => {
          e && this.snapToCursor(tu(t10).point), this.stopAnimation();
        }, r2 = (t10, e10) => {
          let {
            drag: i2,
            dragPropagation: n3,
            onDragStart: s3
          } = this.getProps();
          if (i2 && !n3 && (this.openDragLock && this.openDragLock(), this.openDragLock = (function(t11) {
            if ("x" === t11 || "y" === t11) if (K[t11]) return null;
            else return K[t11] = true, () => {
              K[t11] = false;
            };
            return K.x || K.y ? null : (K.x = K.y = true, () => {
              K.x = K.y = false;
            });
          })(i2), !this.openDragLock)) return;
          this.latestPointerEvent = t10, this.latestPanInfo = e10, this.isDragging = true, this.currentDirection = null, this.resolveConstraints(), this.visualElement.projection && (this.visualElement.projection.isAnimationBlocked = true, this.visualElement.projection.target = void 0), z((t11) => {
            let e11 = this.getAxisMotionValue(t11).get() || 0;
            if (H.KN.test(e11)) {
              let {
                projection: i3
              } = this.visualElement;
              if (i3 && i3.layout) {
                let n4 = i3.layout.layoutBox[t11];
                n4 && (e11 = Y(n4) * (parseFloat(e11) / 100));
              }
            }
            this.originPoint[t11] = e11;
          }), s3 && te.Gt.update(() => s3(t10, e10), false, true), (0, ti.g)(this.visualElement, "transform");
          let {
            animationState: r3
          } = this.visualElement;
          r3 && r3.setActive("whileDrag", true);
        }, o2 = (t10, e10) => {
          this.latestPointerEvent = t10, this.latestPanInfo = e10;
          let {
            dragPropagation: i2,
            dragDirectionLock: n3,
            onDirectionLock: s3,
            onDrag: r3
          } = this.getProps();
          if (!i2 && !this.openDragLock) return;
          let {
            offset: o3
          } = e10;
          if (n3 && null === this.currentDirection) {
            this.currentDirection = (function(t11, e11 = 10) {
              let i3 = null;
              return Math.abs(t11.y) > e11 ? i3 = "y" : Math.abs(t11.x) > e11 && (i3 = "x"), i3;
            })(o3), null !== this.currentDirection && s3 && s3(this.currentDirection);
            return;
          }
          this.updateAxis("x", e10.point, o3), this.updateAxis("y", e10.point, o3), this.visualElement.render(), r3 && te.Gt.update(() => r3(t10, e10), false, true);
        }, a2 = (t10, e10) => {
          this.latestPointerEvent = t10, this.latestPanInfo = e10, this.stop(t10, e10), this.latestPointerEvent = null, this.latestPanInfo = null;
        }, l2 = () => {
          let {
            dragSnapToOrigin: t10
          } = this.getProps();
          (t10 || this.constraints) && this.startAnimation({
            x: 0,
            y: 0
          });
        }, {
          dragSnapToOrigin: h2
        } = this.getProps();
        this.panSession = new tg(t, {
          onSessionStart: s2,
          onStart: r2,
          onMove: o2,
          onSessionEnd: a2,
          resumeAnimation: l2
        }, {
          transformPagePoint: this.visualElement.getTransformPagePoint(),
          dragSnapToOrigin: h2,
          distanceThreshold: i,
          contextWindow: tc(this.visualElement),
          element: this.visualElement.current
        });
      }
      stop(t, e) {
        let i = t || this.latestPointerEvent, n2 = e || this.latestPanInfo, s2 = this.isDragging;
        if (this.cancel(), !s2 || !n2 || !i) return;
        let {
          velocity: r2
        } = n2;
        this.startAnimation(r2);
        let {
          onDragEnd: o2
        } = this.getProps();
        o2 && te.Gt.postRender(() => o2(i, n2));
      }
      cancel() {
        this.isDragging = false;
        let {
          projection: t,
          animationState: e
        } = this.visualElement;
        t && (t.isAnimationBlocked = false), this.endPanSession();
        let {
          dragPropagation: i
        } = this.getProps();
        !i && this.openDragLock && (this.openDragLock(), this.openDragLock = null), e && e.setActive("whileDrag", false);
      }
      endPanSession() {
        this.panSession && this.panSession.end(), this.panSession = void 0;
      }
      updateAxis(t, e, i) {
        let {
          drag: n2
        } = this.getProps();
        if (!i || !tR(t, n2, this.currentDirection)) return;
        let s2 = this.getAxisMotionValue(t), r2 = this.originPoint[t] + i[t];
        this.constraints && this.constraints[t] && (r2 = (function(t10, {
          min: e10,
          max: i2
        }, n3) {
          return void 0 !== e10 && t10 < e10 ? t10 = n3 ? (0, q.k)(e10, t10, n3.min) : Math.max(t10, e10) : void 0 !== i2 && t10 > i2 && (t10 = n3 ? (0, q.k)(i2, t10, n3.max) : Math.min(t10, i2)), t10;
        })(r2, this.constraints[t], this.elastic[t])), s2.set(r2);
      }
      resolveConstraints() {
        let {
          dragConstraints: t,
          dragElastic: e
        } = this.getProps(), i = this.visualElement.projection && !this.visualElement.projection.layout ? this.visualElement.projection.measure(false) : this.visualElement.projection?.layout, n2 = this.constraints;
        t && (0, tp.X)(t) ? this.constraints || (this.constraints = this.resolveRefConstraints()) : t && i ? this.constraints = (function(t10, {
          top: e10,
          left: i2,
          bottom: n3,
          right: s2
        }) {
          return {
            x: tA(t10.x, i2, s2),
            y: tA(t10.y, e10, n3)
          };
        })(i.layoutBox, t) : this.constraints = false, this.elastic = (function(t10 = 0.35) {
          return false === t10 ? t10 = 0 : true === t10 && (t10 = 0.35), {
            x: tE(t10, "left", "right"),
            y: tE(t10, "top", "bottom")
          };
        })(e), n2 !== this.constraints && !(0, tp.X)(t) && i && this.constraints && !this.hasMutatedConstraints && z((t10) => {
          var e10, n3;
          let s2;
          false !== this.constraints && this.getAxisMotionValue(t10) && (this.constraints[t10] = (e10 = i.layoutBox[t10], n3 = this.constraints[t10], s2 = {}, void 0 !== n3.min && (s2.min = n3.min - e10.min), void 0 !== n3.max && (s2.max = n3.max - e10.min), s2));
        });
      }
      resolveRefConstraints() {
        var t;
        let {
          dragConstraints: e,
          onMeasureDragConstraints: i
        } = this.getProps();
        if (!e || !(0, tp.X)(e)) return false;
        let n2 = e.current;
        (0, y.V)(null !== n2, "If `dragConstraints` is set as a React ref, that ref must be passed to another component's `ref` prop.", "drag-constraints-ref");
        let {
          projection: s2
        } = this.visualElement;
        if (!s2 || !s2.layout) return false;
        s2.root && (s2.root.scroll = void 0, s2.root.updateScroll());
        let r2 = (0, w.L)(n2, s2.root, this.visualElement.getTransformPagePoint()), o2 = (t = s2.layout.layoutBox, {
          x: tk(t.x, r2.x),
          y: tk(t.y, r2.y)
        });
        if (i) {
          let t10 = i((0, tn.pA)(o2));
          this.hasMutatedConstraints = !!t10, t10 && (o2 = (0, tn.FY)(t10));
        }
        return o2;
      }
      startAnimation(t) {
        let {
          drag: e,
          dragMomentum: i,
          dragElastic: n2,
          dragTransition: s2,
          dragSnapToOrigin: r2,
          onDragTransitionEnd: o2
        } = this.getProps(), a2 = this.constraints || {};
        return Promise.all(z((o3) => {
          if (!tR(o3, e, this.currentDirection)) return;
          let l2 = a2 && a2[o3] || {};
          (true === r2 || r2 === o3) && (l2 = {
            min: 0,
            max: 0
          });
          let h2 = {
            type: "inertia",
            velocity: i ? t[o3] : 0,
            bounceStiffness: n2 ? 200 : 1e6,
            bounceDamping: n2 ? 40 : 1e7,
            timeConstant: 750,
            restDelta: 1,
            restSpeed: 10,
            ...s2,
            ...l2
          };
          return this.startAxisValueAnimation(o3, h2);
        })).then(o2);
      }
      startAxisValueAnimation(t, e) {
        let i = this.getAxisMotionValue(t);
        return (0, ti.g)(this.visualElement, t), i.start((0, ts.f)(t, i, 0, e, this.visualElement, false));
      }
      stopAnimation() {
        z((t) => this.getAxisMotionValue(t).stop());
      }
      getAxisMotionValue(t) {
        let e = `_drag${t.toUpperCase()}`;
        return this.visualElement.getProps()[e] || this.visualElement.getValue(t, this.visualElement.latestValues[t] ?? 0);
      }
      snapToCursor(t) {
        z((e) => {
          let {
            drag: i
          } = this.getProps();
          if (!tR(e, i, this.currentDirection)) return;
          let {
            projection: n2
          } = this.visualElement, s2 = this.getAxisMotionValue(e);
          if (n2 && n2.layout) {
            let {
              min: i2,
              max: r2
            } = n2.layout.layoutBox[e], o2 = s2.get() || 0;
            s2.set(t[e] - (0, q.k)(i2, r2, 0.5) + o2);
          }
        });
      }
      scalePositionWithinConstraints() {
        if (!this.visualElement.current) return;
        let {
          drag: t,
          dragConstraints: e
        } = this.getProps(), {
          projection: i
        } = this.visualElement;
        if (!(0, tp.X)(e) || !i || !this.constraints) return;
        this.stopAnimation();
        let n2 = {
          x: 0,
          y: 0
        };
        z((t10) => {
          let e10 = this.getAxisMotionValue(t10);
          if (e10 && false !== this.constraints) {
            var i2, s3;
            let r2, o2, a2, l2 = e10.get();
            n2[t10] = (i2 = {
              min: l2,
              max: l2
            }, s3 = this.constraints[t10], r2 = 0.5, o2 = Y(i2), (a2 = Y(s3)) > o2 ? r2 = (0, tT.q)(s3.min, s3.max - o2, i2.min) : o2 > a2 && (r2 = (0, tT.q)(i2.min, i2.max - a2, s3.min)), (0, tP.q)(0, 1, r2));
          }
        });
        let {
          transformTemplate: s2
        } = this.visualElement.getProps();
        this.visualElement.current.style.transform = s2 ? s2({}, "") : "none", i.root && i.root.updateScroll(), i.updateLayout(), this.constraints = false, this.resolveConstraints(), z((e10) => {
          if (!tR(e10, t, null)) return;
          let i2 = this.getAxisMotionValue(e10), {
            min: s3,
            max: r2
          } = this.constraints[e10];
          i2.set((0, q.k)(s3, r2, n2[e10]));
        }), this.visualElement.render();
      }
      addListeners() {
        let t;
        if (!this.visualElement.current) return;
        tC.set(this.visualElement, this);
        let e = this.visualElement.current, i = td(e, "pointerdown", (t10) => {
          let {
            drag: i2,
            dragListener: n3 = true
          } = this.getProps(), s3 = t10.target, r3 = s3 !== e && (to.has(s3.tagName) || true === s3.isContentEditable);
          i2 && n3 && !r3 && this.start(t10);
        }), n2 = () => {
          var i2, n3, s3;
          let r3, o3, {
            dragConstraints: a3
          } = this.getProps();
          (0, tp.X)(a3) && a3.current && (this.constraints = this.resolveRefConstraints(), t || (i2 = e, n3 = a3.current, s3 = () => this.scalePositionWithinConstraints(), r3 = (0, tl.X)(i2, tD(s3)), o3 = (0, tl.X)(n3, tD(s3)), t = () => {
            r3(), o3();
          }));
        }, {
          projection: s2
        } = this.visualElement, r2 = s2.addEventListener("measure", n2);
        s2 && !s2.layout && (s2.root && s2.root.updateScroll(), s2.updateLayout()), te.Gt.read(n2);
        let o2 = ta(window, "resize", () => this.scalePositionWithinConstraints()), a2 = s2.addEventListener("didUpdate", ({
          delta: t10,
          hasLayoutChanged: e10
        }) => {
          this.isDragging && e10 && (z((e11) => {
            let i2 = this.getAxisMotionValue(e11);
            i2 && (this.originPoint[e11] += t10[e11].translate, i2.set(i2.get() + t10[e11].translate));
          }), this.visualElement.render());
        });
        return () => {
          o2(), i(), r2(), a2 && a2(), t && t();
        };
      }
      getProps() {
        let t = this.visualElement.getProps(), {
          drag: e = false,
          dragDirectionLock: i = false,
          dragPropagation: n2 = false,
          dragConstraints: s2 = false,
          dragElastic: r2 = 0.35,
          dragMomentum: o2 = true
        } = t;
        return {
          ...t,
          drag: e,
          dragDirectionLock: i,
          dragPropagation: n2,
          dragConstraints: s2,
          dragElastic: r2,
          dragMomentum: o2
        };
      }
    };
    function tD(t) {
      let e = true;
      return () => {
        if (e) {
          e = false;
          return;
        }
        t();
      };
    }
    function tR(t, e, i) {
      return (true === e || e === t) && (null === i || i === t);
    }
    var tL = class extends E {
      constructor(t) {
        super(t), this.removeGroupControls = G.l, this.removeListeners = G.l, this.controls = new tM(t);
      }
      mount() {
        let {
          dragControls: t
        } = this.node.getProps();
        t && (this.removeGroupControls = t.subscribe(this.controls)), this.removeListeners = this.controls.addListeners() || G.l;
      }
      update() {
        let {
          dragControls: t
        } = this.node.getProps(), {
          dragControls: e
        } = this.node.prevProps || {};
        t !== e && (this.removeGroupControls(), t && (this.removeGroupControls = t.subscribe(this.controls)));
      }
      unmount() {
        this.removeGroupControls(), this.removeListeners(), this.controls.isDragging || this.controls.endPanSession();
      }
    };
    var tB = (t) => (e, i) => {
      t && te.Gt.update(() => t(e, i), false, true);
    };
    var tj = class extends E {
      constructor() {
        super(...arguments), this.removePointerDownListener = G.l;
      }
      onPointerDown(t) {
        this.session = new tg(t, this.createPanHandlers(), {
          transformPagePoint: this.node.getTransformPagePoint(),
          contextWindow: tc(this.node)
        });
      }
      createPanHandlers() {
        let {
          onPanSessionStart: t,
          onPanStart: e,
          onPan: i,
          onPanEnd: n2
        } = this.node.getProps();
        return {
          onSessionStart: tB(t),
          onStart: tB(e),
          onMove: tB(i),
          onEnd: (t10, e10) => {
            delete this.session, n2 && te.Gt.postRender(() => n2(t10, e10));
          }
        };
      }
      mount() {
        this.removePointerDownListener = td(this.node.current, "pointerdown", (t) => this.onPointerDown(t));
      }
      update() {
        this.session && this.session.updateHandlers(this.createPanHandlers());
      }
      unmount() {
        this.removePointerDownListener(), this.session && this.session.end();
      }
    };
    var tF = HostJSX;
    var tO = {
      hasAnimatedSinceResize: true,
      hasEverUpdated: false
    };
    var tI = require__72();
    var tW = require__146();
    var tU = require__100();
    var tN = require__106();
    var t$ = false;
    var tX = class extends P.Component {
      componentDidMount() {
        let {
          visualElement: t,
          layoutGroup: e,
          switchLayoutGroup: i,
          layoutId: n2
        } = this.props, {
          projection: s2
        } = t;
        s2 && (e.group && e.group.add(s2), i && i.register && n2 && i.register(s2), t$ && s2.root.didUpdate(), s2.addEventListener("animationComplete", () => {
          this.safeToRemove();
        }), s2.setOptions({
          ...s2.options,
          layoutDependency: this.props.layoutDependency,
          onExitComplete: () => this.safeToRemove()
        })), tO.hasEverUpdated = true;
      }
      getSnapshotBeforeUpdate(t) {
        let {
          layoutDependency: e,
          visualElement: i,
          drag: n2,
          isPresent: s2
        } = this.props, {
          projection: r2
        } = i;
        return r2 && (r2.isPresent = s2, t.layoutDependency !== e && r2.setOptions({
          ...r2.options,
          layoutDependency: e
        }), t$ = true, n2 || t.layoutDependency !== e || void 0 === e || t.isPresent !== s2 ? r2.willUpdate() : this.safeToRemove(), t.isPresent !== s2 && (s2 ? r2.promote() : r2.relegate() || te.Gt.postRender(() => {
          let t10 = r2.getStack();
          t10 && t10.members.length || this.safeToRemove();
        }))), null;
      }
      componentDidUpdate() {
        let {
          visualElement: t,
          layoutAnchor: e
        } = this.props, {
          projection: i
        } = t;
        i && (i.options.layoutAnchor = e, i.root.didUpdate(), tI.k.postRender(() => {
          !i.currentAnimation && i.isLead() && this.safeToRemove();
        }));
      }
      componentWillUnmount() {
        let {
          visualElement: t,
          layoutGroup: e,
          switchLayoutGroup: i
        } = this.props, {
          projection: n2
        } = t;
        t$ = true, n2 && (n2.scheduleCheckAfterUnmount(), e && e.group && e.group.remove(n2), i && i.deregister && i.deregister(n2));
      }
      safeToRemove() {
        let {
          safeToRemove: t
        } = this.props;
        t && t();
      }
      render() {
        return null;
      }
    };
    function tG(t) {
      let [e, i] = (0, tW.xQ)(), n2 = (0, P.useContext)(tU.L);
      return (0, tF.jsx)(tX, {
        ...t,
        layoutGroup: n2,
        switchLayoutGroup: (0, P.useContext)(tN.N),
        isPresent: e,
        safeToRemove: i
      });
    }
    var tK = require__57();
    var tz = require__147();
    var tH = require__66();
    var tq = require__116();
    var tY = require__112();
    var t_ = require__65();
    var tQ = require__91();
    var tZ = require__143();
    var tJ = require__74();
    var t0 = require__102();
    var t1 = require__130();
    var t2 = require__89();
    var t5 = t2.S.length;
    var t3 = (t) => "string" == typeof t ? parseFloat(t) : t;
    var t9 = (t) => "number" == typeof t || H.px.test(t);
    function t4(t, e) {
      return void 0 !== t[e] ? t[e] : t.borderRadius;
    }
    var t6 = t8(0, 0.5, t1.yT);
    var t7 = t8(0.5, 0.95, G.l);
    function t8(t, e, i) {
      return (n2) => n2 < t ? 0 : n2 > e ? 1 : i((0, tT.q)(t, e, n2));
    }
    function et(t, e) {
      t.min = e.min, t.max = e.max;
    }
    function ee(t, e) {
      et(t.x, e.x), et(t.y, e.y);
    }
    function ei(t, e) {
      t.translate = e.translate, t.scale = e.scale, t.originPoint = e.originPoint, t.origin = e.origin;
    }
    var en = require__97();
    function es(t, e, i, n2, s2) {
      return t -= e, t = (0, en.hq)(t, 1 / i, n2), void 0 !== s2 && (t = (0, en.hq)(t, 1 / s2, n2)), t;
    }
    function er(t, e, [i, n2, s2], r2, o2) {
      !(function(t10, e10 = 0, i2 = 1, n3 = 0.5, s3, r3 = t10, o3 = t10) {
        if (H.KN.test(e10) && (e10 = parseFloat(e10), e10 = (0, q.k)(o3.min, o3.max, e10 / 100) - o3.min), "number" != typeof e10) return;
        let a2 = (0, q.k)(r3.min, r3.max, n3);
        t10 === r3 && (a2 -= e10), t10.min = es(t10.min, e10, i2, a2, s3), t10.max = es(t10.max, e10, i2, a2, s3);
      })(t, e[i], e[n2], e[s2], e.scale, r2, o2);
    }
    var eo = ["x", "scaleX", "originX"];
    var ea = ["y", "scaleY", "originY"];
    function el(t, e, i, n2) {
      er(t.x, e, eo, i ? i.x : void 0, n2 ? n2.x : void 0), er(t.y, e, ea, i ? i.y : void 0, n2 ? n2.y : void 0);
    }
    function eh(t) {
      return 0 === t.translate && 1 === t.scale;
    }
    function eu(t) {
      return eh(t.x) && eh(t.y);
    }
    function ed(t, e) {
      return t.min === e.min && t.max === e.max;
    }
    function ec(t, e) {
      return Math.round(t.min) === Math.round(e.min) && Math.round(t.max) === Math.round(e.max);
    }
    function ep(t, e) {
      return ec(t.x, e.x) && ec(t.y, e.y);
    }
    function em(t) {
      return Y(t.x) / Y(t.y);
    }
    function ef(t, e) {
      return t.translate === e.translate && t.scale === e.scale && t.originPoint === e.originPoint;
    }
    var ev = require__56();
    var ey = class {
      constructor() {
        this.members = [];
      }
      add(t) {
        (0, ev.Kq)(this.members, t);
        for (let e = this.members.length - 1; e >= 0; e--) {
          let i = this.members[e];
          if (i === t || i === this.lead || i === this.prevLead) continue;
          let n2 = i.instance;
          n2 && false !== n2.isConnected || i.snapshot || ((0, ev.Ai)(this.members, i), i.unmount());
        }
        t.scheduleRender();
      }
      remove(t) {
        if ((0, ev.Ai)(this.members, t), t === this.prevLead && (this.prevLead = void 0), t === this.lead) {
          let t10 = this.members[this.members.length - 1];
          t10 && this.promote(t10);
        }
      }
      relegate(t) {
        for (let e = this.members.indexOf(t) - 1; e >= 0; e--) {
          let t10 = this.members[e];
          if (false !== t10.isPresent && t10.instance?.isConnected !== false) return this.promote(t10), true;
        }
        return false;
      }
      promote(t, e) {
        let i = this.lead;
        if (t !== i && (this.prevLead = i, this.lead = t, t.show(), i)) {
          i.updateSnapshot(), t.scheduleRender();
          let {
            layoutDependency: n2
          } = i.options, {
            layoutDependency: s2
          } = t.options;
          (void 0 === n2 || n2 !== s2) && (t.resumeFrom = i, e && (i.preserveOpacity = true), i.snapshot && (t.snapshot = i.snapshot, t.snapshot.latestValues = i.animationValues || i.latestValues), t.root?.isUpdating && (t.isLayoutDirty = true)), false === t.options.crossfade && i.hide();
        }
      }
      exitAnimationComplete() {
        this.members.forEach((t) => {
          t.options.onExitComplete?.(), t.resumingFrom?.options.onExitComplete?.();
        });
      }
      scheduleRender() {
        this.members.forEach((t) => t.instance && t.scheduleRender(false));
      }
      removeLeadSnapshot() {
        this.lead?.snapshot && (this.lead.snapshot = void 0);
      }
    };
    var eg = (t, e) => t.depth - e.depth;
    var ex = class {
      constructor() {
        this.children = [], this.isDirty = false;
      }
      add(t) {
        (0, ev.Kq)(this.children, t), this.isDirty = true;
      }
      remove(t) {
        (0, ev.Ai)(this.children, t), this.isDirty = true;
      }
      forEach(t) {
        this.isDirty && this.children.sort(eg), this.isDirty = false, this.children.forEach(t);
      }
    };
    var ew = require__96();
    var eS = ["", "X", "Y", "Z"];
    var eb = 0;
    function eT(t, e, i, n2) {
      let {
        latestValues: s2
      } = e;
      s2[t] && (i[t] = s2[t], e.setStaticValue(t, 0), n2 && (n2[t] = 0));
    }
    function eP({
      attachResizeListener: t,
      defaultParent: e,
      measureScroll: i,
      checkIsScrollRoot: n2,
      resetTransform: s2
    }) {
      return class {
        constructor(t10 = {}, i2 = e?.()) {
          this.id = eb++, this.animationId = 0, this.animationCommitId = 0, this.children = /* @__PURE__ */ new Set(), this.options = {}, this.isTreeAnimating = false, this.isAnimationBlocked = false, this.isLayoutDirty = false, this.isProjectionDirty = false, this.isSharedProjectionDirty = false, this.isTransformDirty = false, this.updateManuallyBlocked = false, this.updateBlockedByResize = false, this.isUpdating = false, this.isSVG = false, this.needsReset = false, this.shouldResetTransform = false, this.hasCheckedOptimisedAppear = false, this.treeScale = {
            x: 1,
            y: 1
          }, this.eventHandlers = /* @__PURE__ */ new Map(), this.hasTreeAnimated = false, this.layoutVersion = 0, this.updateScheduled = false, this.scheduleUpdate = () => this.update(), this.projectionUpdateScheduled = false, this.checkUpdateFailed = () => {
            this.isUpdating && (this.isUpdating = false, this.clearAllSnapshots());
          }, this.updateProjection = () => {
            this.projectionUpdateScheduled = false, this.nodes.forEach(eE), this.nodes.forEach(eF), this.nodes.forEach(eO), this.nodes.forEach(eV);
          }, this.resolvedRelativeTargetAt = 0, this.linkedParentVersion = 0, this.hasProjected = false, this.isVisible = true, this.animationProgress = 0, this.sharedNodes = /* @__PURE__ */ new Map(), this.latestValues = t10, this.root = i2 ? i2.root || i2 : this, this.path = i2 ? [...i2.path, i2] : [], this.parent = i2, this.depth = i2 ? i2.depth + 1 : 0;
          for (let t11 = 0; t11 < this.path.length; t11++) this.path[t11].shouldResetTransform = true;
          this.root === this && (this.nodes = new ex());
        }
        addEventListener(t10, e10) {
          return this.eventHandlers.has(t10) || this.eventHandlers.set(t10, new tK.v()), this.eventHandlers.get(t10).add(e10);
        }
        notifyListeners(t10, ...e10) {
          let i2 = this.eventHandlers.get(t10);
          i2 && i2.notify(...e10);
        }
        hasListeners(t10) {
          return this.eventHandlers.has(t10);
        }
        mount(e10) {
          if (this.instance) return;
          this.isSVG = (0, tZ.x)(e10) && (!(0, tZ.x)(e10) || "svg" !== e10.tagName), this.instance = e10;
          let {
            layoutId: i2,
            layout: n3,
            visualElement: s3
          } = this.options;
          if (s3 && !s3.current && s3.mount(e10), this.root.nodes.add(this), this.parent && this.parent.children.add(this), this.root.hasTreeAnimated && (n3 || i2) && (this.isLayoutDirty = true), t) {
            let i3, n4 = 0, s4 = () => this.root.updateBlockedByResize = false;
            te.Gt.read(() => {
              n4 = window.innerWidth;
            }), t(e10, () => {
              let t10 = window.innerWidth;
              if (t10 !== n4) {
                let e11, r2;
                n4 = t10, this.root.updateBlockedByResize = true, i3 && i3(), e11 = t_.k.now(), r2 = ({
                  timestamp: t11
                }) => {
                  let i4 = t11 - e11;
                  i4 >= 250 && ((0, te.WG)(r2), s4());
                }, te.Gt.setup(r2, true), i3 = () => (0, te.WG)(r2), tO.hasAnimatedSinceResize && (tO.hasAnimatedSinceResize = false, this.nodes.forEach(ej));
              }
            });
          }
          i2 && this.root.registerSharedNode(i2, this), false !== this.options.animate && s3 && (i2 || n3) && this.addEventListener("didUpdate", ({
            delta: t10,
            hasLayoutChanged: e11,
            hasRelativeLayoutChanged: i3,
            layout: n4
          }) => {
            if (this.isTreeAnimationBlocked()) {
              this.target = void 0, this.relativeTarget = void 0;
              return;
            }
            let r2 = this.options.transition || s3.getDefaultTransition() || eX, {
              onLayoutAnimationStart: o2,
              onLayoutAnimationComplete: a2
            } = s3.getProps(), l2 = !this.targetLayout || !ep(this.targetLayout, n4), h2 = !e11 && i3;
            if (this.options.layoutRoot || this.resumeFrom || h2 || e11 && (l2 || !this.currentAnimation)) {
              this.resumeFrom && (this.resumingFrom = this.resumeFrom, this.resumingFrom.resumingFrom = void 0);
              let e12 = {
                ...(0, tY.r)(r2, "layout"),
                onPlay: o2,
                onComplete: a2
              };
              (s3.shouldReduceMotion || this.options.layoutRoot) && (e12.delay = 0, e12.type = false), this.startAnimation(e12), this.setAnimationOrigin(t10, h2, e12.path);
            } else e11 || ej(this), this.isLead() && this.options.onExitComplete && this.options.onExitComplete();
            this.targetLayout = n4;
          });
        }
        unmount() {
          this.options.layoutId && this.willUpdate(), this.root.nodes.remove(this);
          let t10 = this.getStack();
          t10 && t10.remove(this), this.parent && this.parent.children.delete(this), this.instance = void 0, this.eventHandlers.clear(), (0, te.WG)(this.updateProjection);
        }
        blockUpdate() {
          this.updateManuallyBlocked = true;
        }
        unblockUpdate() {
          this.updateManuallyBlocked = false;
        }
        isUpdateBlocked() {
          return this.updateManuallyBlocked || this.updateBlockedByResize;
        }
        isTreeAnimationBlocked() {
          return this.isAnimationBlocked || this.parent && this.parent.isTreeAnimationBlocked() || false;
        }
        startUpdate() {
          !this.isUpdateBlocked() && (this.isUpdating = true, this.nodes && this.nodes.forEach(eI), this.animationId++);
        }
        getTransformTemplate() {
          let {
            visualElement: t10
          } = this.options;
          return t10 && t10.getProps().transformTemplate;
        }
        willUpdate(t10 = true) {
          if (this.root.hasTreeAnimated = true, this.root.isUpdateBlocked()) {
            this.options.onExitComplete && this.options.onExitComplete();
            return;
          }
          if (window.MotionCancelOptimisedAnimation && !this.hasCheckedOptimisedAppear && (function t11(e11) {
            if (e11.hasCheckedOptimisedAppear = true, e11.root === e11) return;
            let {
              visualElement: i3
            } = e11.options;
            if (!i3) return;
            let n4 = (0, tq.P)(i3);
            if (window.MotionHasOptimisedAnimation(n4, "transform")) {
              let {
                layout: t12,
                layoutId: i4
              } = e11.options;
              window.MotionCancelOptimisedAnimation(n4, "transform", te.Gt, !(t12 || i4));
            }
            let {
              parent: s3
            } = e11;
            s3 && !s3.hasCheckedOptimisedAppear && t11(s3);
          })(this), this.root.isUpdating || this.root.startUpdate(), this.isLayoutDirty) return;
          this.isLayoutDirty = true;
          for (let t11 = 0; t11 < this.path.length; t11++) {
            let e11 = this.path[t11];
            e11.shouldResetTransform = true, ("string" == typeof e11.latestValues.x || "string" == typeof e11.latestValues.y) && (e11.isLayoutDirty = true), e11.updateScroll("snapshot"), e11.options.layoutRoot && e11.willUpdate(false);
          }
          let {
            layoutId: e10,
            layout: i2
          } = this.options;
          if (void 0 === e10 && !i2) return;
          let n3 = this.getTransformTemplate();
          this.prevTransformTemplateValue = n3 ? n3(this.latestValues, "") : void 0, this.updateSnapshot(), t10 && this.notifyListeners("willUpdate");
        }
        update() {
          if (this.updateScheduled = false, this.isUpdateBlocked()) {
            let t11 = this.updateBlockedByResize;
            this.unblockUpdate(), this.updateBlockedByResize = false, this.clearAllSnapshots(), t11 && this.nodes.forEach(eD), this.nodes.forEach(eM);
            return;
          }
          if (this.animationId <= this.animationCommitId) return void this.nodes.forEach(eR);
          this.animationCommitId = this.animationId, this.isUpdating ? (this.isUpdating = false, this.nodes.forEach(eL), this.nodes.forEach(eB), this.nodes.forEach(eA), this.nodes.forEach(ek)) : this.nodes.forEach(eR), this.clearAllSnapshots();
          let t10 = t_.k.now();
          te.uv.delta = (0, tP.q)(0, 1e3 / 60, t10 - te.uv.timestamp), te.uv.timestamp = t10, te.uv.isProcessing = true, te.PP.update.process(te.uv), te.PP.preRender.process(te.uv), te.PP.render.process(te.uv), te.uv.isProcessing = false;
        }
        didUpdate() {
          this.updateScheduled || (this.updateScheduled = true, tI.k.read(this.scheduleUpdate));
        }
        clearAllSnapshots() {
          this.nodes.forEach(eC), this.sharedNodes.forEach(eW);
        }
        scheduleUpdateProjection() {
          this.projectionUpdateScheduled || (this.projectionUpdateScheduled = true, te.Gt.preRender(this.updateProjection, false, true));
        }
        scheduleCheckAfterUnmount() {
          te.Gt.postRender(() => {
            this.isLayoutDirty ? this.root.didUpdate() : this.root.checkUpdateFailed();
          });
        }
        updateSnapshot() {
          !this.snapshot && this.instance && (this.snapshot = this.measure(), !this.snapshot || Y(this.snapshot.measuredBox.x) || Y(this.snapshot.measuredBox.y) || (this.snapshot = void 0));
        }
        updateLayout() {
          if (!this.instance || (this.updateScroll(), !(this.options.alwaysMeasureLayout && this.isLead()) && !this.isLayoutDirty)) return;
          if (this.resumeFrom && !this.resumeFrom.instance) for (let t11 = 0; t11 < this.path.length; t11++) this.path[t11].updateScroll();
          let t10 = this.layout;
          this.layout = this.measure(false), this.layoutVersion++, this.layoutCorrected || (this.layoutCorrected = (0, r.ge)()), this.isLayoutDirty = false, this.projectionDelta = void 0, this.notifyListeners("measure", this.layout.layoutBox);
          let {
            visualElement: e10
          } = this.options;
          e10 && e10.notify("LayoutMeasure", this.layout.layoutBox, t10 ? t10.layoutBox : void 0);
        }
        updateScroll(t10 = "measure") {
          let e10 = !!(this.options.layoutScroll && this.instance);
          if (this.scroll && this.scroll.animationId === this.root.animationId && this.scroll.phase === t10 && (e10 = false), e10 && this.instance) {
            let e11 = n2(this.instance);
            this.scroll = {
              animationId: this.root.animationId,
              phase: t10,
              isRoot: e11,
              offset: i(this.instance),
              wasRoot: this.scroll ? this.scroll.isRoot : e11
            };
          }
        }
        resetTransform() {
          if (!s2) return;
          let t10 = this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout, e10 = this.projectionDelta && !eu(this.projectionDelta), i2 = this.getTransformTemplate(), n3 = i2 ? i2(this.latestValues, "") : void 0, r2 = n3 !== this.prevTransformTemplateValue;
          t10 && this.instance && (e10 || (0, ew.HD)(this.latestValues) || r2) && (s2(this.instance, n3), this.shouldResetTransform = false, this.scheduleRender());
        }
        measure(t10 = true) {
          var e10;
          let i2 = this.measurePageBox(), n3 = this.removeElementScroll(i2);
          return t10 && (n3 = this.removeTransform(n3)), ez((e10 = n3).x), ez(e10.y), {
            animationId: this.root.animationId,
            measuredBox: i2,
            layoutBox: n3,
            latestValues: {},
            source: this.id
          };
        }
        measurePageBox() {
          let {
            visualElement: t10
          } = this.options;
          if (!t10) return (0, r.ge)();
          let e10 = t10.measureViewportBox();
          if (!(this.scroll?.wasRoot || this.path.some(eq))) {
            let {
              scroll: t11
            } = this.root;
            t11 && ((0, en.Ql)(e10.x, t11.offset.x), (0, en.Ql)(e10.y, t11.offset.y));
          }
          return e10;
        }
        removeElementScroll(t10) {
          let e10 = (0, r.ge)();
          if (ee(e10, t10), this.scroll?.wasRoot) return e10;
          for (let i2 = 0; i2 < this.path.length; i2++) {
            let n3 = this.path[i2], {
              scroll: s3,
              options: r2
            } = n3;
            n3 !== this.root && s3 && r2.layoutScroll && (s3.wasRoot && ee(e10, t10), (0, en.Ql)(e10.x, s3.offset.x), (0, en.Ql)(e10.y, s3.offset.y));
          }
          return e10;
        }
        applyTransform(t10, e10 = false, i2) {
          let n3 = i2 || (0, r.ge)();
          ee(n3, t10);
          for (let t11 = 0; t11 < this.path.length; t11++) {
            let i3 = this.path[t11];
            !e10 && i3.options.layoutScroll && i3.scroll && i3 !== i3.root && ((0, en.Ql)(n3.x, -i3.scroll.offset.x), (0, en.Ql)(n3.y, -i3.scroll.offset.y)), (0, ew.HD)(i3.latestValues) && (0, en.Ww)(n3, i3.latestValues, i3.layout?.layoutBox);
          }
          return (0, ew.HD)(this.latestValues) && (0, en.Ww)(n3, this.latestValues, this.layout?.layoutBox), n3;
        }
        removeTransform(t10) {
          let e10 = (0, r.ge)();
          ee(e10, t10);
          for (let t11 = 0; t11 < this.path.length; t11++) {
            let i2, n3 = this.path[t11];
            (0, ew.HD)(n3.latestValues) && (n3.instance && ((0, ew.vk)(n3.latestValues) && n3.updateSnapshot(), ee(i2 = (0, r.ge)(), n3.measurePageBox())), el(e10, n3.latestValues, n3.snapshot?.layoutBox, i2));
          }
          return (0, ew.HD)(this.latestValues) && el(e10, this.latestValues), e10;
        }
        setTargetDelta(t10) {
          this.targetDelta = t10, this.root.scheduleUpdateProjection(), this.isProjectionDirty = true;
        }
        setOptions(t10) {
          this.options = {
            ...this.options,
            ...t10,
            crossfade: void 0 === t10.crossfade || t10.crossfade
          };
        }
        clearMeasurements() {
          this.scroll = void 0, this.layout = void 0, this.snapshot = void 0, this.prevTransformTemplateValue = void 0, this.targetDelta = void 0, this.target = void 0, this.isLayoutDirty = false;
        }
        forceRelativeParentToResolveTarget() {
          this.relativeParent && this.relativeParent.resolvedRelativeTargetAt !== te.uv.timestamp && this.relativeParent.resolveTargetDelta(true);
        }
        resolveTargetDelta(t10 = false) {
          let e10 = this.getLead();
          this.isProjectionDirty || (this.isProjectionDirty = e10.isProjectionDirty), this.isTransformDirty || (this.isTransformDirty = e10.isTransformDirty), this.isSharedProjectionDirty || (this.isSharedProjectionDirty = e10.isSharedProjectionDirty);
          let i2 = !!this.resumingFrom || this !== e10;
          if (!(t10 || i2 && this.isSharedProjectionDirty || this.isProjectionDirty || this.parent?.isProjectionDirty || this.attemptToResolveRelativeTarget || this.root.updateBlockedByResize)) return;
          let {
            layout: n3,
            layoutId: s3
          } = this.options;
          if (!this.layout || !(n3 || s3)) return;
          this.resolvedRelativeTargetAt = te.uv.timestamp;
          let o2 = this.getClosestProjectingParent();
          if (o2 && this.linkedParentVersion !== o2.layoutVersion && !o2.options.layoutRoot && this.removeRelativeTarget(), this.targetDelta || this.relativeTarget || (false !== this.options.layoutAnchor && o2 && o2.layout ? this.createRelativeTarget(o2, this.layout.layoutBox, o2.layout.layoutBox) : this.removeRelativeTarget()), this.relativeTarget || this.targetDelta) {
            if (this.target || (this.target = (0, r.ge)(), this.targetWithTransforms = (0, r.ge)()), this.relativeTarget && this.relativeTargetOrigin && this.relativeParent && this.relativeParent.target) {
              var a2, l2, h2, u2;
              this.forceRelativeParentToResolveTarget(), a2 = this.target, l2 = this.relativeTarget, h2 = this.relativeParent.target, u2 = this.options.layoutAnchor || void 0, Z(a2.x, l2.x, h2.x, u2?.x), Z(a2.y, l2.y, h2.y, u2?.y);
            } else this.targetDelta ? (this.resumingFrom ? this.applyTransform(this.layout.layoutBox, false, this.target) : ee(this.target, this.layout.layoutBox), (0, en.o4)(this.target, this.targetDelta)) : ee(this.target, this.layout.layoutBox);
            this.attemptToResolveRelativeTarget && (this.attemptToResolveRelativeTarget = false, false !== this.options.layoutAnchor && o2 && !!o2.resumingFrom == !!this.resumingFrom && !o2.options.layoutScroll && o2.target && 1 !== this.animationProgress ? this.createRelativeTarget(o2, this.target, o2.target) : this.relativeParent = this.relativeTarget = void 0);
          }
        }
        getClosestProjectingParent() {
          if (!(!this.parent || (0, ew.vk)(this.parent.latestValues) || (0, ew.vF)(this.parent.latestValues))) if (this.parent.isProjecting()) return this.parent;
          else return this.parent.getClosestProjectingParent();
        }
        isProjecting() {
          return !!((this.relativeTarget || this.targetDelta || this.options.layoutRoot) && this.layout);
        }
        createRelativeTarget(t10, e10, i2) {
          this.relativeParent = t10, this.linkedParentVersion = t10.layoutVersion, this.forceRelativeParentToResolveTarget(), this.relativeTarget = (0, r.ge)(), this.relativeTargetOrigin = (0, r.ge)(), tt(this.relativeTargetOrigin, e10, i2, this.options.layoutAnchor || void 0), ee(this.relativeTarget, this.relativeTargetOrigin);
        }
        removeRelativeTarget() {
          this.relativeParent = this.relativeTarget = void 0;
        }
        calcProjection() {
          let t10 = this.getLead(), e10 = !!this.resumingFrom || this !== t10, i2 = true;
          if ((this.isProjectionDirty || this.parent?.isProjectionDirty) && (i2 = false), e10 && (this.isSharedProjectionDirty || this.isTransformDirty) && (i2 = false), this.resolvedRelativeTargetAt === te.uv.timestamp && (i2 = false), i2) return;
          let {
            layout: n3,
            layoutId: s3
          } = this.options;
          if (this.isTreeAnimating = !!(this.parent && this.parent.isTreeAnimating || this.currentAnimation || this.pendingAnimation), this.isTreeAnimating || (this.targetDelta = this.relativeTarget = void 0), !this.layout || !(n3 || s3)) return;
          ee(this.layoutCorrected, this.layout.layoutBox);
          let o2 = this.treeScale.x, a2 = this.treeScale.y;
          (0, en.OU)(this.layoutCorrected, this.treeScale, this.path, e10), t10.layout && !t10.target && (1 !== this.treeScale.x || 1 !== this.treeScale.y) && (t10.target = t10.layout.layoutBox, t10.targetWithTransforms = (0, r.ge)());
          let {
            target: l2
          } = t10;
          if (!l2) {
            this.prevProjectionDelta && (this.createProjectionDeltas(), this.scheduleRender());
            return;
          }
          this.projectionDelta && this.prevProjectionDelta ? (ei(this.prevProjectionDelta.x, this.projectionDelta.x), ei(this.prevProjectionDelta.y, this.projectionDelta.y)) : this.createProjectionDeltas(), Q(this.projectionDelta, this.layoutCorrected, l2, this.latestValues), this.treeScale.x === o2 && this.treeScale.y === a2 && ef(this.projectionDelta.x, this.prevProjectionDelta.x) && ef(this.projectionDelta.y, this.prevProjectionDelta.y) || (this.hasProjected = true, this.scheduleRender(), this.notifyListeners("projectionUpdate", l2));
        }
        hide() {
          this.isVisible = false;
        }
        show() {
          this.isVisible = true;
        }
        scheduleRender(t10 = true) {
          if (this.options.visualElement?.scheduleRender(), t10) {
            let t11 = this.getStack();
            t11 && t11.scheduleRender();
          }
          this.resumingFrom && !this.resumingFrom.instance && (this.resumingFrom = void 0);
        }
        createProjectionDeltas() {
          this.prevProjectionDelta = (0, r.xU)(), this.projectionDelta = (0, r.xU)(), this.projectionDeltaWithTransform = (0, r.xU)();
        }
        setAnimationOrigin(t10, e10 = false, i2) {
          let n3, s3 = this.snapshot, o2 = s3 ? s3.latestValues : {}, a2 = {
            ...this.latestValues
          }, l2 = (0, r.xU)();
          this.relativeParent && this.relativeParent.options.layoutRoot || (this.relativeTarget = this.relativeTargetOrigin = void 0), this.attemptToResolveRelativeTarget = !e10;
          let h2 = (0, r.ge)(), u2 = (s3 ? s3.source : void 0) !== (this.layout ? this.layout.source : void 0), d2 = this.getStack(), c2 = !d2 || d2.members.length <= 1, p2 = !!(u2 && !c2 && true === this.options.crossfade && !this.path.some(e$));
          this.animationProgress = 0;
          let m2 = i2?.interpolateProjection(t10);
          this.mixTargetDelta = (e11) => {
            let i3 = e11 / 1e3, s4 = m2?.(i3);
            if (s4 ? (l2.x.translate = s4.x, l2.x.scale = (0, q.k)(t10.x.scale, 1, i3), l2.x.origin = t10.x.origin, l2.x.originPoint = t10.x.originPoint, l2.y.translate = s4.y, l2.y.scale = (0, q.k)(t10.y.scale, 1, i3), l2.y.origin = t10.y.origin, l2.y.originPoint = t10.y.originPoint) : (eU(l2.x, t10.x, i3), eU(l2.y, t10.y, i3)), this.setTargetDelta(l2), this.relativeTarget && this.relativeTargetOrigin && this.layout && this.relativeParent && this.relativeParent.layout) {
              var d3, f2, v2, y2, g2, x2;
              tt(h2, this.layout.layoutBox, this.relativeParent.layout.layoutBox, this.options.layoutAnchor || void 0), v2 = this.relativeTarget, y2 = this.relativeTargetOrigin, g2 = h2, x2 = i3, eN(v2.x, y2.x, g2.x, x2), eN(v2.y, y2.y, g2.y, x2), n3 && (d3 = this.relativeTarget, f2 = n3, ed(d3.x, f2.x) && ed(d3.y, f2.y)) && (this.isProjectionDirty = false), n3 || (n3 = (0, r.ge)()), ee(n3, this.relativeTarget);
            }
            u2 && (this.animationValues = a2, (function(t11, e12, i4, n4, s5, r2) {
              s5 ? (t11.opacity = (0, q.k)(0, i4.opacity ?? 1, t6(n4)), t11.opacityExit = (0, q.k)(e12.opacity ?? 1, 0, t7(n4))) : r2 && (t11.opacity = (0, q.k)(e12.opacity ?? 1, i4.opacity ?? 1, n4));
              for (let s6 = 0; s6 < t5; s6++) {
                let r3 = t2.S[s6], o3 = t4(e12, r3), a3 = t4(i4, r3);
                (void 0 !== o3 || void 0 !== a3) && (o3 || (o3 = 0), a3 || (a3 = 0), 0 === o3 || 0 === a3 || t9(o3) === t9(a3) ? (t11[r3] = Math.max((0, q.k)(t3(o3), t3(a3), n4), 0), (H.KN.test(a3) || H.KN.test(o3)) && (t11[r3] += "%")) : t11[r3] = a3);
              }
              (e12.rotate || i4.rotate) && (t11.rotate = (0, q.k)(e12.rotate || 0, i4.rotate || 0, n4));
            })(a2, o2, this.latestValues, i3, p2, c2)), s4 && void 0 !== s4.rotate && (this.animationValues || (this.animationValues = a2), this.animationValues.pathRotation = s4.rotate), this.root.scheduleUpdateProjection(), this.scheduleRender(), this.animationProgress = i3;
          }, this.mixTargetDelta(1e3 * !!this.options.layoutRoot);
        }
        startAnimation(t10) {
          this.notifyListeners("animationStart"), this.currentAnimation?.stop(), this.resumingFrom?.currentAnimation?.stop(), this.pendingAnimation && ((0, te.WG)(this.pendingAnimation), this.pendingAnimation = void 0), this.pendingAnimation = te.Gt.update(() => {
            tO.hasAnimatedSinceResize = true, this.motionValue || (this.motionValue = (0, tJ.OQ)(0)), this.motionValue.jump(0, false), this.currentAnimation = (0, tz.z)(this.motionValue, [0, 1e3], {
              ...t10,
              velocity: 0,
              isSync: true,
              onUpdate: (e10) => {
                this.mixTargetDelta(e10), t10.onUpdate && t10.onUpdate(e10);
              },
              onComplete: () => {
                t10.onComplete && t10.onComplete(), this.completeAnimation();
              }
            }), (0, tH.m)(this.currentAnimation, this), this.resumingFrom && (this.resumingFrom.currentAnimation = this.currentAnimation), this.pendingAnimation = void 0;
          });
        }
        completeAnimation() {
          this.resumingFrom && (this.resumingFrom.currentAnimation = void 0, this.resumingFrom.preserveOpacity = void 0);
          let t10 = this.getStack();
          t10 && t10.exitAnimationComplete(), this.resumingFrom = this.currentAnimation = this.animationValues = void 0, this.notifyListeners("animationComplete");
        }
        finishAnimation() {
          this.currentAnimation && (this.mixTargetDelta && this.mixTargetDelta(1e3), this.currentAnimation.stop()), this.completeAnimation();
        }
        applyTransformsToTarget() {
          let t10 = this.getLead(), {
            targetWithTransforms: e10,
            layout: i2,
            latestValues: n3
          } = t10, {
            target: s3
          } = t10;
          if (e10 && s3 && i2) {
            if (this !== t10 && this.layout && i2 && eH(this.options.animationType, this.layout.layoutBox, i2.layoutBox)) {
              s3 = this.target || (0, r.ge)();
              let e11 = Y(this.layout.layoutBox.x);
              s3.x.min = t10.target.x.min, s3.x.max = s3.x.min + e11;
              let i3 = Y(this.layout.layoutBox.y);
              s3.y.min = t10.target.y.min, s3.y.max = s3.y.min + i3;
            }
            ee(e10, s3), (0, en.Ww)(e10, n3), Q(this.projectionDeltaWithTransform, this.layoutCorrected, e10, n3);
          }
        }
        registerSharedNode(t10, e10) {
          this.sharedNodes.has(t10) || this.sharedNodes.set(t10, new ey()), this.sharedNodes.get(t10).add(e10);
          let i2 = e10.options.initialPromotionConfig;
          e10.promote({
            transition: i2 ? i2.transition : void 0,
            preserveFollowOpacity: i2 && i2.shouldPreserveFollowOpacity ? i2.shouldPreserveFollowOpacity(e10) : void 0
          });
        }
        isLead() {
          let t10 = this.getStack();
          return !t10 || t10.lead === this;
        }
        getLead() {
          let {
            layoutId: t10
          } = this.options;
          return t10 && this.getStack()?.lead || this;
        }
        getPrevLead() {
          let {
            layoutId: t10
          } = this.options;
          return t10 ? this.getStack()?.prevLead : void 0;
        }
        getStack() {
          let {
            layoutId: t10
          } = this.options;
          if (t10) return this.root.sharedNodes.get(t10);
        }
        promote({
          needsReset: t10,
          transition: e10,
          preserveFollowOpacity: i2
        } = {}) {
          let n3 = this.getStack();
          n3 && n3.promote(this, i2), t10 && (this.projectionDelta = void 0, this.needsReset = true), e10 && this.setOptions({
            transition: e10
          });
        }
        relegate() {
          let t10 = this.getStack();
          return !!t10 && t10.relegate(this);
        }
        resetSkewAndRotation() {
          let {
            visualElement: t10
          } = this.options;
          if (!t10) return;
          let e10 = false, {
            latestValues: i2
          } = t10;
          if ((i2.z || i2.rotate || i2.rotateX || i2.rotateY || i2.rotateZ || i2.skewX || i2.skewY) && (e10 = true), !e10) return;
          let n3 = {};
          i2.z && eT("z", t10, n3, this.animationValues);
          for (let e11 = 0; e11 < eS.length; e11++) eT(`rotate${eS[e11]}`, t10, n3, this.animationValues), eT(`skew${eS[e11]}`, t10, n3, this.animationValues);
          for (let e11 in t10.render(), n3) t10.setStaticValue(e11, n3[e11]), this.animationValues && (this.animationValues[e11] = n3[e11]);
          t10.scheduleRender();
        }
        applyProjectionStyles(t10, e10) {
          if (!this.instance || this.isSVG) return;
          if (!this.isVisible) {
            t10.visibility = "hidden";
            return;
          }
          let i2 = this.getTransformTemplate();
          if (this.needsReset) {
            this.needsReset = false, t10.visibility = "", t10.opacity = "", t10.pointerEvents = (0, t0.u)(e10?.pointerEvents) || "", t10.transform = i2 ? i2(this.latestValues, "") : "none";
            return;
          }
          let n3 = this.getLead();
          if (!this.projectionDelta || !this.layout || !n3.target) {
            this.options.layoutId && (t10.opacity = void 0 !== this.latestValues.opacity ? this.latestValues.opacity : 1, t10.pointerEvents = (0, t0.u)(e10?.pointerEvents) || ""), this.hasProjected && !(0, ew.HD)(this.latestValues) && (t10.transform = i2 ? i2({}, "") : "none", this.hasProjected = false);
            return;
          }
          t10.visibility = "";
          let s3 = n3.animationValues || n3.latestValues;
          this.applyTransformsToTarget();
          let r2 = (function(t11, e11, i3) {
            let n4 = "", s4 = t11.x.translate / e11.x, r3 = t11.y.translate / e11.y, o3 = i3?.z || 0;
            if ((s4 || r3 || o3) && (n4 = `translate3d(${s4}px, ${r3}px, ${o3}px) `), (1 !== e11.x || 1 !== e11.y) && (n4 += `scale(${1 / e11.x}, ${1 / e11.y}) `), i3) {
              let {
                transformPerspective: t12,
                rotate: e12,
                pathRotation: s5,
                rotateX: r4,
                rotateY: o4,
                skewX: a4,
                skewY: l3
              } = i3;
              t12 && (n4 = `perspective(${t12}px) ${n4}`), e12 && (n4 += `rotate(${e12}deg) `), s5 && (n4 += `rotate(${s5}deg) `), r4 && (n4 += `rotateX(${r4}deg) `), o4 && (n4 += `rotateY(${o4}deg) `), a4 && (n4 += `skewX(${a4}deg) `), l3 && (n4 += `skewY(${l3}deg) `);
            }
            let a3 = t11.x.scale * e11.x, l2 = t11.y.scale * e11.y;
            return (1 !== a3 || 1 !== l2) && (n4 += `scale(${a3}, ${l2})`), n4 || "none";
          })(this.projectionDeltaWithTransform, this.treeScale, s3);
          i2 && (r2 = i2(s3, r2)), t10.transform = r2;
          let {
            x: o2,
            y: a2
          } = this.projectionDelta;
          for (let e11 in t10.transformOrigin = `${100 * o2.origin}% ${100 * a2.origin}% 0`, n3.animationValues ? t10.opacity = n3 === this ? s3.opacity ?? this.latestValues.opacity ?? 1 : this.preserveOpacity ? this.latestValues.opacity : s3.opacityExit : t10.opacity = n3 === this ? void 0 !== s3.opacity ? s3.opacity : "" : void 0 !== s3.opacityExit ? s3.opacityExit : 0, tQ.H) {
            if (void 0 === s3[e11]) continue;
            let {
              correct: i3,
              applyTo: o3,
              isCSSVariable: a3
            } = tQ.H[e11], l2 = "none" === r2 ? s3[e11] : i3(s3[e11], n3);
            if (o3) {
              let e12 = o3.length;
              for (let i4 = 0; i4 < e12; i4++) t10[o3[i4]] = l2;
            } else a3 ? this.options.visualElement.renderState.vars[e11] = l2 : t10[e11] = l2;
          }
          this.options.layoutId && (t10.pointerEvents = n3 === this ? (0, t0.u)(e10?.pointerEvents) || "" : "none");
        }
        clearSnapshot() {
          this.resumeFrom = this.snapshot = void 0;
        }
        resetTree() {
          this.root.nodes.forEach((t10) => t10.currentAnimation?.stop()), this.root.nodes.forEach(eM), this.root.sharedNodes.clear();
        }
      };
    }
    function eA(t) {
      t.updateLayout();
    }
    function ek(t) {
      let e = t.resumeFrom?.snapshot || t.snapshot;
      if (t.isLead() && t.layout && e && t.hasListeners("didUpdate")) {
        let {
          layoutBox: i,
          measuredBox: n2
        } = t.layout, {
          animationType: s2
        } = t.options, o2 = e.source !== t.layout.source;
        if ("size" === s2) z((t10) => {
          let n3 = o2 ? e.measuredBox[t10] : e.layoutBox[t10], s3 = Y(n3);
          n3.min = i[t10].min, n3.max = n3.min + s3;
        });
        else if ("x" === s2 || "y" === s2) {
          let t10 = "x" === s2 ? "y" : "x";
          et(o2 ? e.measuredBox[t10] : e.layoutBox[t10], i[t10]);
        } else eH(s2, e.layoutBox, i) && z((n3) => {
          let s3 = o2 ? e.measuredBox[n3] : e.layoutBox[n3], r2 = Y(i[n3]);
          s3.max = s3.min + r2, t.relativeTarget && !t.currentAnimation && (t.isProjectionDirty = true, t.relativeTarget[n3].max = t.relativeTarget[n3].min + r2);
        });
        let a2 = (0, r.xU)();
        Q(a2, i, e.layoutBox);
        let l2 = (0, r.xU)();
        o2 ? Q(l2, t.applyTransform(n2, true), e.measuredBox) : Q(l2, i, e.layoutBox);
        let h2 = !eu(a2), u2 = false;
        if (!t.resumeFrom) {
          let n3 = t.getClosestProjectingParent();
          if (n3 && !n3.resumeFrom) {
            let {
              snapshot: s3,
              layout: o3
            } = n3;
            if (s3 && o3) {
              let a3 = t.options.layoutAnchor || void 0, l3 = (0, r.ge)();
              tt(l3, e.layoutBox, s3.layoutBox, a3);
              let h3 = (0, r.ge)();
              tt(h3, i, o3.layoutBox, a3), ep(l3, h3) || (u2 = true), n3.options.layoutRoot && (t.relativeTarget = h3, t.relativeTargetOrigin = l3, t.relativeParent = n3);
            }
          }
        }
        t.notifyListeners("didUpdate", {
          layout: i,
          snapshot: e,
          delta: l2,
          layoutDelta: a2,
          hasLayoutChanged: h2,
          hasRelativeLayoutChanged: u2
        });
      } else if (t.isLead()) {
        let {
          onExitComplete: e10
        } = t.options;
        e10 && e10();
      }
      t.options.transition = void 0;
    }
    function eE(t) {
      t.parent && (t.isProjecting() || (t.isProjectionDirty = t.parent.isProjectionDirty), t.isSharedProjectionDirty || (t.isSharedProjectionDirty = !!(t.isProjectionDirty || t.parent.isProjectionDirty || t.parent.isSharedProjectionDirty)), t.isTransformDirty || (t.isTransformDirty = t.parent.isTransformDirty));
    }
    function eV(t) {
      t.isProjectionDirty = t.isSharedProjectionDirty = t.isTransformDirty = false;
    }
    function eC(t) {
      t.clearSnapshot();
    }
    function eM(t) {
      t.clearMeasurements();
    }
    function eD(t) {
      t.isLayoutDirty = true, t.updateLayout();
    }
    function eR(t) {
      t.isLayoutDirty = false;
    }
    function eL(t) {
      t.isAnimationBlocked && t.layout && !t.isLayoutDirty && (t.snapshot = t.layout, t.isLayoutDirty = true);
    }
    function eB(t) {
      let {
        visualElement: e
      } = t.options;
      e && e.getProps().onBeforeLayoutMeasure && e.notify("BeforeLayoutMeasure"), t.resetTransform();
    }
    function ej(t) {
      t.finishAnimation(), t.targetDelta = t.relativeTarget = t.target = void 0, t.isProjectionDirty = true;
    }
    function eF(t) {
      t.resolveTargetDelta();
    }
    function eO(t) {
      t.calcProjection();
    }
    function eI(t) {
      t.resetSkewAndRotation();
    }
    function eW(t) {
      t.removeLeadSnapshot();
    }
    function eU(t, e, i) {
      t.translate = (0, q.k)(e.translate, 0, i), t.scale = (0, q.k)(e.scale, 1, i), t.origin = e.origin, t.originPoint = e.originPoint;
    }
    function eN(t, e, i, n2) {
      t.min = (0, q.k)(e.min, i.min, n2), t.max = (0, q.k)(e.max, i.max, n2);
    }
    function e$(t) {
      return t.animationValues && void 0 !== t.animationValues.opacityExit;
    }
    var eX = {
      duration: 0.45,
      ease: [0.4, 0, 0.1, 1]
    };
    var eG = (t) => "u" > typeof navigator && navigator.userAgent && navigator.userAgent.toLowerCase().includes(t);
    var eK = eG("applewebkit/") && !eG("chrome/") ? Math.round : G.l;
    function ez(t) {
      t.min = eK(t.min), t.max = eK(t.max);
    }
    function eH(t, e, i) {
      return "position" === t || "preserve-aspect" === t && !(0.2 >= Math.abs(em(e) - em(i)));
    }
    function eq(t) {
      return t !== t.root && t.scroll?.wasRoot;
    }
    var eY = eP({
      attachResizeListener: (t, e) => ta(t, "resize", e),
      measureScroll: () => ({
        x: document.documentElement.scrollLeft || document.body?.scrollLeft || 0,
        y: document.documentElement.scrollTop || document.body?.scrollTop || 0
      }),
      checkIsScrollRoot: () => true
    });
    var e_ = {
      current: void 0
    };
    var eQ = eP({
      measureScroll: (t) => ({
        x: t.scrollLeft,
        y: t.scrollTop
      }),
      defaultParent: () => {
        if (!e_.current) {
          let t = new eY({});
          t.mount(window), t.setOptions({
            layoutScroll: true
          }), e_.current = t;
        }
        return e_.current;
      },
      resetTransform: (t, e) => {
        t.style.transform = void 0 !== e ? e : "none";
      },
      checkIsScrollRoot: (t) => "fixed" === window.getComputedStyle(t).position
    });
    var eZ = require__144();
    function eJ(t, e) {
      let i = (0, eZ.K)(t), n2 = new AbortController();
      return [i, {
        passive: true,
        ...e,
        signal: n2.signal
      }, () => n2.abort()];
    }
    function e0(t, e, i) {
      let {
        props: n2
      } = t;
      t.animationState && n2.whileHover && t.animationState.setActive("whileHover", "Start" === i);
      let s2 = n2["onHover" + i];
      s2 && te.Gt.postRender(() => s2(e, tu(e)));
    }
    var e1 = class extends E {
      mount() {
        let {
          current: t
        } = this.node;
        t && (this.unmount = (function(t10, e, i = {}) {
          let [n2, s2, r2] = eJ(t10, i);
          return n2.forEach((t11) => {
            let i2, n3 = false, r3 = false, o2 = (e10) => {
              i2 && (i2(e10), i2 = void 0), t11.removeEventListener("pointerleave", l2);
            }, a2 = (t12) => {
              n3 = false, window.removeEventListener("pointerup", a2), window.removeEventListener("pointercancel", a2), r3 && (r3 = false, o2(t12));
            }, l2 = (t12) => {
              if ("touch" !== t12.pointerType) {
                if (n3) {
                  r3 = true;
                  return;
                }
                o2(t12);
              }
            };
            t11.addEventListener("pointerenter", (n4) => {
              if ("touch" === n4.pointerType || K.x || K.y) return;
              r3 = false;
              let o3 = e(t11, n4);
              "function" == typeof o3 && (i2 = o3, t11.addEventListener("pointerleave", l2, s2));
            }, s2), t11.addEventListener("pointerdown", () => {
              n3 = true, window.addEventListener("pointerup", a2, s2), window.addEventListener("pointercancel", a2, s2);
            }, s2);
          }), r2;
        })(t, (t10, e) => (e0(this.node, e, "Start"), (t11) => e0(this.node, t11, "End"))));
      }
      unmount() {
      }
    };
    var e2 = class extends E {
      constructor() {
        super(...arguments), this.isActive = false;
      }
      onFocus() {
        let t = false;
        try {
          t = this.node.current.matches(":focus-visible");
        } catch (e) {
          t = true;
        }
        t && this.node.animationState && (this.node.animationState.setActive("whileFocus", true), this.isActive = true);
      }
      onBlur() {
        this.isActive && this.node.animationState && (this.node.animationState.setActive("whileFocus", false), this.isActive = false);
      }
      mount() {
        this.unmount = (0, tm.F)(ta(this.node.current, "focus", () => this.onFocus()), ta(this.node.current, "blur", () => this.onBlur()));
      }
      unmount() {
      }
    };
    var e5 = require__148();
    var e3 = (t, e) => !!e && (t === e || e3(t, e.parentElement));
    var e9 = /* @__PURE__ */ new WeakSet();
    function e4(t) {
      return (e) => {
        "Enter" === e.key && t(e);
      };
    }
    function e6(t, e) {
      t.dispatchEvent(new PointerEvent("pointer" + e, {
        isPrimary: true,
        bubbles: true
      }));
    }
    function e7(t) {
      return th(t) && !(K.x || K.y);
    }
    var e8 = /* @__PURE__ */ new WeakSet();
    function it(t, e, i) {
      let {
        props: n2
      } = t;
      if (t.current instanceof HTMLButtonElement && t.current.disabled) return;
      t.animationState && n2.whileTap && t.animationState.setActive("whileTap", "Start" === i);
      let s2 = n2["onTap" + ("End" === i ? "" : i)];
      s2 && te.Gt.postRender(() => s2(e, tu(e)));
    }
    var ie = class extends E {
      mount() {
        let {
          current: t
        } = this.node;
        if (!t) return;
        let {
          globalTapTarget: e,
          propagate: i
        } = this.node.props;
        this.unmount = (function(t10, e10, i2 = {}) {
          let [n2, s2, r2] = eJ(t10, i2), o2 = (t11) => {
            let n3 = t11.currentTarget;
            if (!e7(t11) || e8.has(t11)) return;
            e9.add(n3), i2.stopPropagation && e8.add(t11);
            let r3 = e10(n3, t11), o3 = {
              ...s2,
              capture: true
            }, a2 = (t12, e11) => {
              window.removeEventListener("pointerup", l2, o3), window.removeEventListener("pointercancel", h2, o3), e9.has(n3) && e9.delete(n3), e7(t12) && "function" == typeof r3 && r3(t12, {
                success: e11
              });
            }, l2 = (t12) => {
              a2(t12, n3 === window || n3 === document || i2.useGlobalTarget || e3(n3, t12.target));
            }, h2 = (t12) => {
              a2(t12, false);
            };
            window.addEventListener("pointerup", l2, o3), window.addEventListener("pointercancel", h2, o3);
          };
          return n2.forEach((t11) => {
            ((i2.useGlobalTarget ? window : t11).addEventListener("pointerdown", o2, s2), (0, e5.s)(t11)) && (t11.addEventListener("focus", (t12) => ((t13, e11) => {
              let i3 = t13.currentTarget;
              if (!i3) return;
              let n3 = e4(() => {
                if (e9.has(i3)) return;
                e6(i3, "down");
                let t14 = e4(() => {
                  e6(i3, "up");
                });
                i3.addEventListener("keyup", t14, e11), i3.addEventListener("blur", () => e6(i3, "cancel"), e11);
              });
              i3.addEventListener("keydown", n3, e11), i3.addEventListener("blur", () => i3.removeEventListener("keydown", n3), e11);
            })(t12, s2)), tr.has(t11.tagName) || true === t11.isContentEditable || t11.hasAttribute("tabindex") || (t11.tabIndex = 0));
          }), r2;
        })(t, (t10, e10) => (it(this.node, e10, "Start"), (t11, {
          success: e11
        }) => it(this.node, t11, e11 ? "End" : "Cancel")), {
          useGlobalTarget: e,
          stopPropagation: i?.tap === false
        });
      }
      unmount() {
      }
    };
    var ii = /* @__PURE__ */ new WeakMap();
    var is = /* @__PURE__ */ new WeakMap();
    var ir = (t) => {
      let e = ii.get(t.target);
      e && e(t);
    };
    var io = (t) => {
      t.forEach(ir);
    };
    var ia = {
      some: 0,
      all: 1
    };
    var il = class extends E {
      constructor() {
        super(...arguments), this.hasEnteredView = false, this.isInView = false;
      }
      startObserver() {
        var t;
        let e;
        this.stopObserver?.();
        let {
          viewport: i = {}
        } = this.node.getProps(), {
          root: n2,
          margin: s2,
          amount: r2 = "some",
          once: o2
        } = i, a2 = {
          root: n2 ? n2.current : void 0,
          rootMargin: s2,
          threshold: "number" == typeof r2 ? r2 : ia[r2]
        }, l2 = (t10) => {
          let {
            isIntersecting: e10
          } = t10;
          if (this.isInView === e10 || (this.isInView = e10, o2 && !e10 && this.hasEnteredView)) return;
          e10 && (this.hasEnteredView = true), this.node.animationState && this.node.animationState.setActive("whileInView", e10);
          let {
            onViewportEnter: i2,
            onViewportLeave: n3
          } = this.node.getProps(), s3 = e10 ? i2 : n3;
          s3 && s3(t10);
        };
        this.stopObserver = (t = this.node.current, e = (function({
          root: t10,
          ...e10
        }) {
          let i2 = t10 || document;
          is.has(i2) || is.set(i2, {});
          let n3 = is.get(i2), s3 = JSON.stringify(e10);
          return n3[s3] || (n3[s3] = new IntersectionObserver(io, {
            root: t10,
            ...e10
          })), n3[s3];
        })(a2), ii.set(t, l2), e.observe(t), () => {
          ii.delete(t), e.unobserve(t);
        });
      }
      mount() {
        this.startObserver();
      }
      update() {
        if ("u" < typeof IntersectionObserver) return;
        let {
          props: t,
          prevProps: e
        } = this.node;
        ["amount", "margin", "root"].some((function({
          viewport: t10 = {}
        }, {
          viewport: e10 = {}
        } = {}) {
          return (i) => t10[i] !== e10[i];
        })(t, e)) && this.startObserver();
      }
      unmount() {
        this.stopObserver?.(), this.hasEnteredView = false, this.isInView = false;
      }
    };
    var ih = (0, k.H)({
      animation: {
        Feature: N
      },
      exit: {
        Feature: X
      },
      inView: {
        Feature: il
      },
      tap: {
        Feature: ie
      },
      focus: {
        Feature: e2
      },
      hover: {
        Feature: e1
      },
      pan: {
        Feature: tj
      },
      drag: {
        Feature: tL,
        ProjectionNode: eQ,
        MeasureLayout: tG
      },
      layout: {
        ProjectionNode: eQ,
        MeasureLayout: tG
      }
    }, (t, e) => e.isSVG ?? (0, A.Q)(t) ? new v(e) : new T(e, {
      allowProjection: t !== P.Fragment
    }));
  }
});

// src/dependencies/25354.cjs
var require__150 = __commonJS({
  "src/dependencies/25354.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      PY1: () => s
    });
    var n = require__149();
    require__109();
    var s = n.P;
  }
});

// src/dependencies/18310.cjs
var require__151 = __commonJS({
  "src/dependencies/18310.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      I: () => o
    });
    var n = require__80();
    var s = require__81();
    var r = HostReact;
    function o() {
      n.r.current || (0, s.Uu)();
      let [t] = (0, r.useState)(n.O.current);
      return t;
    }
  }
});

// src/dependencies/80642.cjs
var require__152 = __commonJS({
  "src/dependencies/80642.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      N: () => k
    });
    var n = HostJSX;
    var o = HostReact;
    var s = require__100();
    var l = require__104();
    var i = require__108();
    var u = require__103();
    var a = require__148();
    var c = require__101();
    function h(e, t) {
      if ("function" == typeof e) return e(t);
      null != e && (e.current = t);
    }
    var f = class extends o.Component {
      getSnapshotBeforeUpdate(e) {
        let t = this.props.childRef.current;
        if ((0, a.s)(t) && e.isPresent && !this.props.isPresent && false !== this.props.pop) {
          let e2 = t.offsetParent, r = (0, a.s)(e2) && e2.offsetWidth || 0, n2 = (0, a.s)(e2) && e2.offsetHeight || 0, o2 = getComputedStyle(t), s2 = this.props.sizeRef.current;
          s2.height = parseFloat(o2.height), s2.width = parseFloat(o2.width), s2.top = t.offsetTop, s2.left = t.offsetLeft, s2.right = r - s2.width - s2.left, s2.bottom = n2 - s2.height - s2.top, s2.direction = o2.direction;
        }
        return null;
      }
      componentDidUpdate() {
      }
      render() {
        return this.props.children;
      }
    };
    function p({
      children: e,
      isPresent: t,
      anchorX: r,
      anchorY: s2,
      root: l2,
      pop: i2
    }) {
      let u2 = (0, o.useId)(), a2 = (0, o.useRef)(null), d2 = (0, o.useRef)({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        direction: "ltr"
      }), {
        nonce: m2
      } = (0, o.useContext)(c.Q), g2 = (function(...e2) {
        return o.useCallback(/* @__PURE__ */ (function(...e3) {
          return (t2) => {
            let r2 = false, n2 = e3.map((e4) => {
              let n3 = h(e4, t2);
              return r2 || "function" != typeof n3 || (r2 = true), n3;
            });
            if (r2) return () => {
              for (let t3 = 0; t3 < n2.length; t3++) {
                let r3 = n2[t3];
                "function" == typeof r3 ? r3() : h(e3[t3], null);
              }
            };
          };
        })(...e2), e2);
      })(a2, false !== i2 ? e.props?.ref ?? e?.ref : void 0);
      return (0, o.useInsertionEffect)(() => {
        let {
          width: e2,
          height: n2,
          top: o2,
          left: c2,
          right: h2,
          bottom: f2,
          direction: p2
        } = d2.current;
        if (t || false === i2 || !a2.current || !e2 || !n2) return;
        let g3 = "rtl" === p2, y2 = "left" === r ? g3 ? `right: ${h2}` : `left: ${c2}` : g3 ? `left: ${c2}` : `right: ${h2}`, x2 = "bottom" === s2 ? `bottom: ${f2}` : `top: ${o2}`;
        a2.current.dataset.motionPopId = u2;
        let k2 = document.createElement("style");
        m2 && (k2.nonce = m2);
        let v = l2 ?? document.head;
        return v.appendChild(k2), k2.sheet && k2.sheet.insertRule(`
          [data-motion-pop-id="${u2}"] {
            position: absolute !important;
            width: ${e2}px !important;
            height: ${n2}px !important;
            ${y2}px !important;
            ${x2}px !important;
          }
        `), () => {
          a2.current?.removeAttribute("data-motion-pop-id"), v.contains(k2) && v.removeChild(k2);
        };
      }, [t]), (0, n.jsx)(f, {
        isPresent: t,
        childRef: a2,
        sizeRef: d2,
        pop: i2,
        children: false === i2 ? e : o.cloneElement(e, {
          ref: g2
        })
      });
    }
    var d = ({
      children: e,
      initial: t,
      isPresent: r,
      onExitComplete: s2,
      custom: a2,
      presenceAffectsLayout: c2,
      mode: h2,
      anchorX: f2,
      anchorY: d2,
      root: g2
    }) => {
      let y2 = (0, l.M)(m), x2 = (0, o.useId)(), k2 = (0, o.useRef)(r), v = (0, o.useRef)(s2);
      (0, i.E)(() => {
        k2.current = r, v.current = s2;
      });
      let E = true, R = (0, o.useMemo)(() => (E = false, {
        id: x2,
        initial: t,
        isPresent: r,
        custom: a2,
        onExitComplete: (e2) => {
          for (let t2 of (y2.set(e2, true), y2.values())) if (!t2) return;
          s2 && s2();
        },
        register: (e2) => (y2.set(e2, false), () => {
          y2.delete(e2), k2.current || y2.size || v.current?.();
        })
      }), [r, y2, s2]);
      return c2 && E && (R = {
        ...R
      }), (0, o.useMemo)(() => {
        y2.forEach((e2, t2) => y2.set(t2, false));
      }, [r]), o.useEffect(() => {
        r || y2.size || !s2 || s2();
      }, [r]), e = (0, n.jsx)(p, {
        pop: "popLayout" === h2,
        isPresent: r,
        anchorX: f2,
        anchorY: d2,
        root: g2,
        children: e
      }), (0, n.jsx)(u.t.Provider, {
        value: R,
        children: e
      });
    };
    function m() {
      return /* @__PURE__ */ new Map();
    }
    var g = require__146();
    var y = (e) => e.key || "";
    function x(e) {
      let t = [];
      return o.Children.forEach(e, (e2) => {
        (0, o.isValidElement)(e2) && t.push(e2);
      }), t;
    }
    var k = ({
      children: e,
      custom: t,
      initial: r = true,
      onExitComplete: u2,
      presenceAffectsLayout: a2 = true,
      mode: c2 = "sync",
      propagate: h2 = false,
      anchorX: f2 = "left",
      anchorY: p2 = "top",
      root: m2
    }) => {
      let [k2, v] = (0, g.xQ)(h2), E = (0, o.useMemo)(() => x(e), [e]), R = h2 && !k2 ? [] : E.map(y), w = (0, o.useRef)(true), P = (0, o.useRef)(E), C = (0, l.M)(() => /* @__PURE__ */ new Map()), M = (0, o.useRef)(/* @__PURE__ */ new Set()), [$, b] = (0, o.useState)(E), [z, j] = (0, o.useState)(E);
      (0, i.E)(() => {
        !h2 || k2 || z.length || v?.();
      }, [k2, h2, z.length, v]), (0, i.E)(() => {
        w.current = false, P.current = E;
        for (let e2 = 0; e2 < z.length; e2++) {
          let t2 = y(z[e2]);
          R.includes(t2) ? (C.delete(t2), M.current.delete(t2)) : true !== C.get(t2) && C.set(t2, false);
        }
      }, [z, R.length, R.join("-")]);
      let A = [];
      if (E !== $) {
        let e2 = [...E], t2 = 0;
        for (let r2 of z) {
          let n2 = R.indexOf(y(r2));
          -1 === n2 ? (e2.splice(t2++, 0, r2), A.push(r2)) : t2 = n2 + A.length + 1;
        }
        return "wait" === c2 && A.length && (e2 = A), j(x(e2)), b(E), null;
      }
      let {
        forceRender: S
      } = (0, o.useContext)(s.L);
      return (0, n.jsx)(n.Fragment, {
        children: z.map((e2) => {
          let o2 = y(e2), s2 = (!h2 || !!k2) && (E === z || R.includes(o2));
          return (0, n.jsx)(d, {
            isPresent: s2,
            initial: (!w.current || !!r) && void 0,
            custom: t,
            presenceAffectsLayout: a2,
            mode: c2,
            root: m2,
            onExitComplete: s2 ? void 0 : () => {
              if (M.current.has(o2) || !C.has(o2)) return;
              M.current.add(o2), C.set(o2, true);
              let e3 = true;
              C.forEach((t2) => {
                t2 || (e3 = false);
              }), e3 && (S?.(), j(P.current), h2 && v?.(), u2 && u2());
            },
            anchorX: f2,
            anchorY: p2,
            children: e2
          }, o2);
        })
      });
    };
  }
});

// src/dependencies/90209.cjs
var require__153 = __commonJS({
  "src/dependencies/90209.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      default: () => a
    });
    var n = HostReact;
    var s = (...t) => t.filter((t2, e, i) => !!t2 && "" !== t2.trim() && i.indexOf(t2) === e).join(" ").trim();
    var r = {
      xmlns: "http://www.w3.org/2000/svg",
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    };
    var o = (0, n.createContext)({});
    var a = (0, n.forwardRef)(({
      color: t,
      size: e,
      width: i,
      height: a2,
      strokeWidth: l,
      absoluteStrokeWidth: h,
      nonScalingStroke: u,
      className: d = "",
      children: c,
      iconNode: p = [],
      icon: m = {
        node: p,
        aliases: [],
        size: 24
      },
      ...f
    }, v) => {
      let {
        size: y = 24,
        strokeWidth: g = 2,
        absoluteStrokeWidth: x = false,
        nonScalingStroke: w = false,
        color: S = "currentColor",
        className: b = ""
      } = (0, n.useContext)(o) ?? {}, T = !!c || ((t2) => {
        for (let e2 in t2) if (e2.startsWith("aria-") || "role" === e2 || "title" === e2) return true;
        return false;
      })(f), [P, A, k = []] = (function(t2, e2 = {}) {
        return (function(t3, e3 = {}) {
          let i2 = e3.attributeNames ?? {}, n2 = (t4) => i2[t4] ?? t4, o2 = t3.size ?? t3.width ?? r.width, a3 = t3.size ?? t3.height ?? r.height, l2 = t3.aliases?.filter((t4) => "string" == typeof t4 && "" !== t4.trim()).map((t4) => `lucide-${t4}`) ?? [], h2 = [...t3.name ? [`lucide-${t3.name}`] : [], ...l2], u2 = e3.className?.split(" ").filter(Boolean) ?? [], d2 = false === e3.includeDefaultClasses ? s(...u2) : s("lucide", ...h2, ...u2), c2 = e3.absoluteStrokeWidth ? Number(e3.strokeWidth ?? r["stroke-width"]) * Number(t3.size ?? t3.width ?? r.width) / Number(e3.size ?? e3.width ?? r.width) : e3.strokeWidth ?? r["stroke-width"];
          return ["svg", {
            ...Object.entries(r).reduce((t4, [e4, i3]) => (t4[n2(e4)] = i3, t4), {}),
            ..."color" in e3 && e3.color && {
              [n2("stroke")]: e3.color
            },
            ..."size" in e3 && null != e3.size && {
              [n2("width")]: e3.size,
              [n2("height")]: e3.size
            },
            ..."width" in e3 && null != e3.width && {
              [n2("width")]: e3.width
            },
            ..."height" in e3 && null != e3.height && {
              [n2("height")]: e3.height
            },
            [n2("stroke-width")]: c2,
            ...d2 && {
              [n2("class")]: d2
            },
            [n2("viewBox")]: `0 0 ${o2} ${a3}`,
            ...false === e3.hasA11yProp ? {
              [n2("aria-hidden")]: "true"
            } : {},
            ..."attributes" in e3 && e3.attributes
          }, t3.node.map((t4) => {
            let [i3, s2, r2] = t4, o3 = e3.nonScalingStroke ? {
              [n2("vector-effect")]: "non-scaling-stroke",
              ...s2
            } : s2;
            return r2 ? [i3, o3, r2] : [i3, o3];
          })];
        })(t2, {
          ...e2,
          attributeNames: {
            ...e2.attributeNames,
            class: "className",
            "stroke-width": "strokeWidth",
            "stroke-linecap": "strokeLinecap",
            "stroke-linejoin": "strokeLinejoin",
            "vector-effect": "vectorEffect"
          }
        });
      })(m, {
        color: t ?? S,
        width: i ?? e ?? y,
        height: a2 ?? e ?? y,
        strokeWidth: l ?? g,
        absoluteStrokeWidth: h ?? x,
        nonScalingStroke: u ?? w,
        className: s(b, d),
        hasA11yProp: T,
        attributes: f
      });
      return (0, n.createElement)(P, {
        ref: v,
        ...A
      }, [...k.map(([t2, e2]) => (0, n.createElement)(t2, e2)), ...Array.isArray(c) ? c : [c]]);
    });
  }
});

// src/dependencies/51811.cjs
var require__154 = __commonJS({
  "src/dependencies/51811.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      A: () => r
    });
    var n = HostReact;
    var s = require__153();
    function r(t, e = [], i = []) {
      let o, a = "string" == typeof t ? (function(t2, e2, i2 = []) {
        if (null == e2) throw Error("[lucide]: iconNode is required when icon name is used");
        return {
          name: t2?.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
          size: 24,
          node: e2,
          ...i2.length > 0 ? {
            aliases: i2
          } : {}
        };
      })(t, e, i) : t, l = (0, n.forwardRef)(({
        className: t2,
        ...e2
      }, i2) => (0, n.createElement)(s.default, {
        ref: i2,
        icon: a,
        className: t2,
        ...e2
      }));
      return a.name && (l.displayName = (o = ((t2) => {
        let e2 = "", i2 = false;
        for (let n2 of t2) {
          if ("-" === n2 || "_" === n2 || n2 <= " ") {
            i2 = e2.length > 0;
            continue;
          }
          0 === e2.length ? e2 += n2.toLowerCase() : e2 += i2 ? n2.toUpperCase() : n2, i2 = false;
        }
        return e2;
      })(a.name)).charAt(0).toUpperCase() + o.slice(1)), l;
    }
  }
});

// src/dependencies/31966.cjs
var require__155 = __commonJS({
  "src/dependencies/31966.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      A: () => o
    });
    var t = require__154();
    var s = {
      name: "arrow-left",
      size: 24,
      node: [["path", {
        d: "m12 19-7-7 7-7",
        key: "1l729n"
      }], ["path", {
        d: "M19 12H5",
        key: "x3x0zl"
      }]]
    };
    s.node;
    var o = (0, t.A)(s);
  }
});

// src/dependencies/90467.cjs
var require__156 = __commonJS({
  "src/dependencies/90467.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      A: () => s
    });
    var n = require__154();
    var o = {
      name: "arrow-right",
      size: 24,
      node: [["path", {
        d: "M5 12h14",
        key: "1ays0h"
      }], ["path", {
        d: "m12 5 7 7-7 7",
        key: "xquz4c"
      }]]
    };
    o.node;
    var s = (0, n.A)(o);
  }
});

// src/dependencies/57700.cjs
var require__157 = __commonJS({
  "src/dependencies/57700.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      o: () => u
    });
    var n = HostJSX;
    var o = HostReact;
    var l = require__100();
    var a = (0, o.createContext)(null);
    var i = require__52();
    var s = require__108();
    var c = (e) => !e.isLayoutDirty && e.willUpdate(false);
    var u = ({
      children: e,
      id: t,
      inherit: r = true
    }) => {
      let u2 = (0, o.useContext)(l.L), d = (0, o.useContext)(a), [f, p] = (function() {
        let e2, t2 = (e2 = (0, o.useRef)(false), (0, s.E)(() => (e2.current = true, () => {
          e2.current = false;
        }), []), e2), [r2, n2] = (0, o.useState)(0), l2 = (0, o.useCallback)(() => {
          t2.current && n2(r2 + 1);
        }, [r2]);
        return [(0, o.useCallback)(() => i.Gt.postRender(l2), [l2]), r2];
      })(), g = (0, o.useRef)(null), h = u2.id || d;
      if (null === g.current) {
        let e2, n2, o2, l2;
        (true == (true === (l2 = r)) || "id" === l2) && h && (t = t ? h + "-" + t : h), g.current = {
          id: t,
          group: true === r && u2.group || (e2 = /* @__PURE__ */ new Set(), n2 = /* @__PURE__ */ new WeakMap(), {
            add: (t2) => {
              e2.add(t2), n2.set(t2, t2.addEventListener("willUpdate", o2));
            },
            remove: (t2) => {
              e2.delete(t2);
              let r2 = n2.get(t2);
              r2 && (r2(), n2.delete(t2)), o2();
            },
            dirty: o2 = () => e2.forEach(c)
          })
        };
      }
      let v = (0, o.useMemo)(() => ({
        ...g.current,
        forceRender: f
      }), [p]);
      return (0, n.jsx)(l.L.Provider, {
        value: v,
        children: e
      });
    };
  }
});

// src/dependencies/7770.cjs
var require__158 = __commonJS({
  "src/dependencies/7770.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      T: () => i
    });
    var i = {
      duration: {
        instant: 0.12,
        fast: 0.16,
        exit: 0.18,
        standard: 0.24,
        considered: 0.48
      },
      ease: {
        enter: [0.16, 1, 0.3, 1],
        exit: [0.7, 0, 0.84, 0],
        standard: [0.22, 1, 0.36, 1],
        inOut: [0.65, 0, 0.35, 1]
      },
      spring: {
        responsive: {
          type: "spring",
          stiffness: 520,
          damping: 38
        },
        gentle: {
          type: "spring",
          stiffness: 340,
          damping: 34
        },
        snappy: {
          type: "spring",
          visualDuration: 0.26,
          bounce: 0.12
        },
        smooth: {
          type: "spring",
          visualDuration: 0.4,
          bounce: 0
        },
        morph: {
          type: "spring",
          visualDuration: 0.42,
          bounce: 0.16
        }
      },
      stagger: {
        char: 0.016,
        word: 0.04,
        line: 0.08,
        item: 0.035
      },
      blur: {
        subtle: 2,
        soft: 4,
        text: 8
      }
    };
  }
});

// src/dependencies/42686.cjs
var require__159 = __commonJS({
  "src/dependencies/42686.cjs"(exports, module2) {
    "use strict";
    var interop = require_interop();
    module2.exports = {
      root: "segmented-control_root__Dpc5W",
      track: "segmented-control_track___VuS7",
      button: "segmented-control_button__66qu5",
      selection: "segmented-control_selection__VfPRX",
      label: "segmented-control_label__4wRlo"
    };
  }
});

// src/dependencies/66558.cjs
var require__160 = __commonJS({
  "src/dependencies/66558.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      A: () => u
    });
    var i = HostJSX;
    var n = HostReact;
    var r = require__151();
    var s = require__157();
    var o = require__150();
    var l = require__158();
    var c = require__159();
    var d = interop.n(c);
    function u({
      options: e,
      value: a,
      onValueChange: t,
      label: c2,
      onOptionIntent: p,
      className: h
    }) {
      let m = (0, n.useId)(), g = (0, r.I)(), _ = (0, n.useRef)(null);
      (0, n.useLayoutEffect)(() => {
        let e2 = _.current;
        if (!e2) return;
        let a2 = () => {
          let a3 = e2.scrollWidth - e2.clientWidth - e2.scrollLeft;
          e2.toggleAttribute("data-fade-start", e2.scrollLeft > 1), e2.toggleAttribute("data-fade-end", a3 > 1);
        };
        a2(), e2.addEventListener("scroll", a2, {
          passive: true
        });
        let t2 = "u" < typeof ResizeObserver ? null : new ResizeObserver(a2);
        return t2?.observe(e2), () => {
          e2.removeEventListener("scroll", a2), t2?.disconnect();
        };
      }, [e.length]);
      let A = (0, n.useRef)(true);
      (0, n.useEffect)(() => {
        let e2 = _.current, a2 = e2?.querySelector('[aria-pressed="true"]');
        if (!e2 || !a2 || e2.scrollWidth <= e2.clientWidth) {
          A.current = false;
          return;
        }
        let t2 = a2.offsetLeft - 20, i2 = a2.offsetLeft + a2.offsetWidth + 20 - e2.clientWidth, n2 = e2.scrollLeft > t2 ? t2 : e2.scrollLeft < i2 ? i2 : e2.scrollLeft;
        n2 !== e2.scrollLeft && e2.scrollTo({
          left: Math.max(0, n2),
          behavior: A.current || g ? "auto" : "smooth"
        }), A.current = false;
      }, [a, g]);
      let f = Math.max(0, e.findIndex((e2) => e2.value === a)), b = (a2) => {
        let i2 = e.length - 1, n2 = "ArrowRight" === a2.key || "ArrowDown" === a2.key ? f === i2 ? 0 : f + 1 : "ArrowLeft" === a2.key || "ArrowUp" === a2.key ? 0 === f ? i2 : f - 1 : "Home" === a2.key ? 0 : "End" === a2.key ? i2 : -1;
        !(n2 < 0) && e[n2] && (a2.preventDefault(), t(e[n2].value), _.current?.querySelector(`[data-value="${CSS.escape(e[n2].value)}"]`)?.focus({
          preventScroll: true
        }));
      };
      return (0, i.jsx)("div", {
        className: `${d().root} ${h ?? ""}`,
        role: "group",
        "aria-label": c2,
        children: (0, i.jsx)(s.o, {
          id: m,
          children: (0, i.jsx)(o.PY1.div, {
            ref: _,
            layoutScroll: true,
            className: d().track,
            children: e.map((e2, n2) => (0, i.jsxs)("button", {
              id: `${m}-${e2.value}`,
              className: d().button,
              type: "button",
              "data-value": e2.value,
              "aria-pressed": a === e2.value,
              tabIndex: n2 === f ? 0 : -1,
              onClick: () => t(e2.value),
              onKeyDown: b,
              onPointerEnter: p ? () => p(e2.value) : void 0,
              onFocus: p ? () => p(e2.value) : void 0,
              children: [a === e2.value && (0, i.jsx)(o.PY1.span, {
                className: d().selection,
                layoutId: "selection",
                layoutDependency: a,
                transition: g ? {
                  duration: 0
                } : l.T.spring.morph,
                "aria-hidden": "true"
              }), (0, i.jsxs)("span", {
                className: d().label,
                children: [e2.label, e2.accessory]
              })]
            }, e2.value))
          })
        })
      });
    }
  }
});

// src/dependencies/35484.cjs
var require__161 = __commonJS({
  "src/dependencies/35484.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      A: () => l
    });
    var n = require__154();
    var o = {
      name: "circle-alert",
      size: 24,
      node: [["circle", {
        cx: "12",
        cy: "12",
        r: "10",
        key: "1mglay"
      }], ["line", {
        x1: "12",
        x2: "12",
        y1: "8",
        y2: "12",
        key: "1pkeuh"
      }], ["line", {
        x1: "12",
        x2: "12.01",
        y1: "16",
        y2: "16",
        key: "4dfq90"
      }]],
      aliases: ["alert-circle"]
    };
    o.node;
    var l = (0, n.A)(o);
  }
});

// src/dependencies/99314.cjs
var require__162 = __commonJS({
  "src/dependencies/99314.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      A: () => l
    });
    var n = require__154();
    var o = {
      name: "copy",
      size: 24,
      node: [["rect", {
        width: "14",
        height: "14",
        x: "8",
        y: "8",
        rx: "2",
        ry: "2",
        key: "17jyea"
      }], ["path", {
        d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
        key: "zix9uf"
      }]]
    };
    o.node;
    var l = (0, n.A)(o);
  }
});

// src/dependencies/55665.cjs
var require__163 = __commonJS({
  "src/dependencies/55665.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      q: () => n
    });
    var i = HostReact;
    function n(e = 1900) {
      let [a, t] = (0, i.useState)("idle"), [r, s] = (0, i.useState)(null), o = (0, i.useRef)(null), l = (0, i.useCallback)(() => {
        o.current && clearTimeout(o.current), o.current = null, t("idle"), s(null);
      }, []);
      return (0, i.useEffect)(() => () => {
        o.current && clearTimeout(o.current);
      }, []), {
        state: a,
        activeKey: r,
        copy: (0, i.useCallback)(async (a2, i2 = "default") => {
          o.current && clearTimeout(o.current), s(i2);
          try {
            return await navigator.clipboard.writeText(a2), t("copied"), o.current = setTimeout(l, e), true;
          } catch {
            return t("error"), o.current = setTimeout(l, e), false;
          }
        }, [e, l]),
        reset: l
      };
    }
  }
});

// src/dependencies/13858.cjs
var require__164 = __commonJS({
  "src/dependencies/13858.cjs"(exports, module2) {
    "use strict";
    var interop = require_interop();
    module2.exports = {
      button: "copy-button_button__B_Zx4",
      iconOnly: "copy-button_iconOnly__sHHow",
      plain: "copy-button_plain__4zaC5",
      icon: "copy-button_icon___1xyN",
      iconInner: "copy-button_iconInner__DLVGL",
      label: "copy-button_label__eXbyF",
      measure: "copy-button_measure__mOhyu",
      glyphs: "copy-button_glyphs__22lEg",
      glyph: "copy-button_glyph__wHY4M",
      srOnly: "copy-button_srOnly__S_RSl"
    };
  }
});

// src/dependencies/73474.cjs
var require__165 = __commonJS({
  "src/dependencies/73474.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      CopyButton: () => A
    });
    var t = HostJSX;
    var s = HostReact;
    var o = require__150();
    var n = require__152();
    var r = require__151();
    var l = require__161();
    var d = require__162();
    var c = require__158();
    var h = require__163();
    var m = require__164();
    var p = interop.n(m);
    var g = {
      type: "spring",
      visualDuration: 0.5,
      bounce: 0.06
    };
    var u = {
      duration: 0.36,
      ease: [...c.T.ease.enter]
    };
    var y = {
      duration: 0.2,
      ease: [...c.T.ease.standard]
    };
    var w = {
      duration: c.T.duration.instant
    };
    var _ = `blur(${c.T.blur.soft}px)`;
    var j = {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)"
    };
    var f = {
      ...j,
      opacity: 0
    };
    var x = {
      opacity: 0,
      transition: w
    };
    var b = {
      opacity: 0,
      scale: 0.6,
      filter: _
    };
    var v = {
      opacity: 0,
      scale: 0.6,
      filter: _,
      transition: {
        duration: 0.24,
        ease: [...c.T.ease.standard]
      }
    };
    var N = {
      scale: g,
      opacity: {
        ...u,
        delay: 0.03
      },
      filter: {
        ...u,
        delay: 0.03
      }
    };
    var k = {
      opacity: 0,
      y: 4,
      filter: _
    };
    var C = {
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
              duration: 0.5,
              ease: [...c.T.ease.standard],
              delay: 0.05
            },
            opacity: {
              duration: 0.01,
              delay: 0.05
            }
          }
        })
      });
    }
    var P = (e, a) => e.map((e2, i) => ({
      id: `${a}:${i}`,
      char: e2,
      order: i
    }));
    function S({
      text: e,
      reduced: a
    }) {
      let i = (function(e2) {
        let [a2, i2] = (0, s.useState)(() => ({
          text: e2,
          seq: 0,
          glyphs: P([...e2], 0)
        }));
        if (a2.text === e2) return a2.glyphs;
        let t2 = [...a2.text], o2 = [...e2], n2 = 0, r2 = 0;
        for (; n2 < t2.length && n2 < o2.length && t2[n2] === o2[n2]; ) n2++;
        for (; r2 < t2.length - n2 && r2 < o2.length - n2 && t2[t2.length - 1 - r2] === o2[o2.length - 1 - r2]; ) r2++;
        n2 < 2 && (n2 = 0), r2 < 2 && (r2 = 0);
        let l2 = a2.seq + 1, d2 = [...a2.glyphs.slice(0, n2), ...P(o2.slice(n2, o2.length - r2), l2), ...a2.glyphs.slice(a2.glyphs.length - r2)];
        return i2({
          text: e2,
          seq: l2,
          glyphs: d2
        }), d2;
      })(e);
      return (0, t.jsx)(o.PY1.span, {
        className: p().glyphs,
        layoutRoot: true,
        children: (0, t.jsx)(n.N, {
          mode: "popLayout",
          initial: false,
          children: i.map((i2) => (0, t.jsx)(o.PY1.span, {
            className: p().glyph,
            layout: !a && "position",
            layoutDependency: e,
            initial: a ? f : k,
            animate: j,
            exit: a ? x : C,
            transition: a ? w : {
              ...u,
              delay: Math.min(0.02 * i2.order, 0.12),
              layout: g
            },
            children: i2.char
          }, i2.id))
        })
      });
    }
    function A({
      value: e,
      label: a = "Copy",
      className: i,
      iconOnly: s2 = false,
      variant: c2 = "outline",
      disabled: m2,
      onCopied: g2
    }) {
      let {
        state: u2,
        copy: y2
      } = (0, h.q)(), _2 = (0, r.I)() ?? false, k2 = "copied" === u2 ? "Copied" : "error" === u2 ? "Failed" : a;
      async function C2() {
        await y2(e) && g2?.();
      }
      return (0, t.jsxs)(t.Fragment, {
        children: [(0, t.jsxs)("button", {
          type: "button",
          className: [p().button, s2 && p().iconOnly, "plain" === c2 && p().plain, i].filter(Boolean).join(" "),
          onClick: () => void C2(),
          "aria-label": a,
          "data-copy-state": u2,
          disabled: m2,
          children: [(0, t.jsx)("span", {
            className: p().icon,
            "aria-hidden": "true",
            children: (0, t.jsx)(n.N, {
              initial: false,
              children: (0, t.jsx)(o.PY1.span, {
                className: p().iconInner,
                "data-state": u2,
                initial: _2 ? f : b,
                animate: j,
                exit: _2 ? x : v,
                transition: _2 ? w : N,
                children: "copied" === u2 ? (0, t.jsx)(T, {
                  reduced: _2
                }) : "error" === u2 ? (0, t.jsx)(l.A, {
                  size: 16,
                  strokeWidth: 1.75
                }) : (0, t.jsx)(d.A, {
                  size: 16,
                  strokeWidth: 1.75
                })
              }, u2)
            })
          }), !s2 && (0, t.jsxs)("span", {
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
              text: k2,
              reduced: _2
            })]
          })]
        }), (0, t.jsx)("span", {
          className: p().srOnly,
          role: "status",
          "aria-live": "polite",
          children: "idle" === u2 ? "" : "error" === u2 ? `${a}: Could not copy` : `${a}: Copied`
        })]
      });
    }
  }
});

// src/dependencies/67752.cjs
var require__166 = __commonJS({
  "src/dependencies/67752.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      KQ: () => s,
      MV: () => o,
      c0: () => t,
      jW: () => n,
      my: () => r,
      o4: () => l
    });
    var t = [{
      id: "emma-collins",
      name: "Emma Collins",
      role: "Product designer",
      src: __arcMedia5
    }, {
      id: "marcus-johnson",
      name: "Marcus Johnson",
      role: "Frontend engineer",
      src: __arcMedia9
    }, {
      id: "jasmine-brooks",
      name: "Jasmine Brooks",
      role: "Design lead",
      src: __arcMedia7
    }, {
      id: "olivia-bennett",
      name: "Olivia Bennett",
      role: "Platform engineer",
      src: __arcMedia12
    }, {
      id: "sofia-ramirez",
      name: "Sofia Ramirez",
      role: "Operations lead",
      src: __arcMedia17
    }, {
      id: "ryan-sullivan",
      name: "Ryan Sullivan",
      role: "Account executive",
      src: __arcMedia16
    }, {
      id: "hannah-walsh",
      name: "Hannah Walsh",
      role: "Customer success",
      src: __arcMedia6
    }, {
      id: "chloe-nguyen",
      name: "Chloe Nguyen",
      role: "Data analyst",
      src: __arcMedia2
    }, {
      id: "ava-mitchell",
      name: "Ava Mitchell",
      role: "Marketing manager",
      src: __arcMedia1
    }, {
      id: "daniel-kim",
      name: "Daniel Kim",
      role: "Backend engineer",
      src: __arcMedia3
    }, {
      id: "jordan-reyes",
      name: "Jordan Reyes",
      role: "Support specialist",
      src: __arcMedia8
    }, {
      id: "mateo-alvarez",
      name: "Mateo Alvarez",
      role: "Mobile engineer",
      src: __arcMedia10
    }, {
      id: "tyler-hayes",
      name: "Tyler Hayes",
      role: "Sales lead",
      src: __arcMedia18
    }, {
      id: "andre-williams",
      name: "Andre Williams",
      role: "Finance partner",
      src: __arcMedia0
    }, {
      id: "nathan-cole",
      name: "Nathan Cole",
      role: "Engineering manager",
      src: __arcMedia11
    }, {
      id: "diane-foster",
      name: "Diane Foster",
      role: "Chief operating officer",
      src: __arcMedia4
    }];
    var s = [{
      id: "lounge-chair",
      alt: "A woven oak lounge chair with a sheepskin and linen cushion on a concrete floor",
      src: __arcMedia33,
      width: 1280,
      height: 1600
    }, {
      id: "table-lamp",
      alt: "A white mushroom table lamp glowing beside books and a small vase",
      src: __arcMedia43,
      width: 1600,
      height: 900
    }, {
      id: "linen-throw",
      alt: "Folded natural linen throws with fringed edges in soft window light",
      src: __arcMedia28,
      width: 1067,
      height: 1600
    }, {
      id: "glass-carafe",
      alt: "A hand pouring water from a ribbed glass carafe into tumblers",
      src: __arcMedia26,
      width: 1280,
      height: 1600
    }, {
      id: "stoneware-cups",
      alt: "Two speckled stoneware cups with a lid on a pale table",
      src: __arcMedia41,
      width: 1067,
      height: 1600
    }, {
      id: "stacked-bowls",
      alt: "Two stacked speckled ceramic bowls against a dark wall",
      src: __arcMedia40,
      width: 1600,
      height: 1067
    }, {
      id: "ceramic-lamp",
      alt: "A sculptural ceramic lamp with a linen shade on a walnut sideboard",
      src: __arcMedia21,
      width: 1067,
      height: 1600
    }, {
      id: "living-room",
      alt: "A bright living room with timber beams, arched windows, and cream sofas",
      src: __arcMedia32,
      width: 1200,
      height: 1600
    }, {
      id: "sunroom",
      alt: "A sunroom with a round dining table, plants, and windows on three sides",
      src: __arcMedia42,
      width: 1600,
      height: 1067
    }, {
      id: "home-office",
      alt: "A home office with a wooden desk and deep green walls",
      src: __arcMedia27,
      width: 1600,
      height: 1200
    }, {
      id: "reading-chair",
      alt: "A grey armchair and ottoman with a knit throw in a dark green room",
      src: __arcMedia36,
      width: 1600,
      height: 900
    }, {
      id: "bedroom",
      alt: "A made bed with striped linen pillows against an oak headboard",
      src: __arcMedia20,
      width: 1067,
      height: 1600
    }, {
      id: "restaurant",
      alt: "A warm restaurant dining room with woven pendant lights and a tree",
      src: __arcMedia37,
      width: 1067,
      height: 1600
    }, {
      id: "wine-bar",
      alt: "A glass carafe of red wine on a bar table in low evening light",
      src: __arcMedia45,
      width: 1600,
      height: 1067
    }, {
      id: "concert-hall",
      alt: "Curved stainless steel panels of the Walt Disney Concert Hall against a blue sky",
      src: __arcMedia24,
      width: 1600,
      height: 1143
    }, {
      id: "curved-facade",
      alt: "A white tiled building facade with curved balconies",
      src: __arcMedia25,
      width: 1600,
      height: 1067
    }, {
      id: "pool-house",
      alt: "A modern glass house beside a long pool under a clear sky",
      src: __arcMedia35,
      width: 1600,
      height: 900
    }, {
      id: "terracotta-waves",
      alt: "Wavy terracotta walls rising toward a blue sky",
      src: __arcMedia44,
      width: 1067,
      height: 1600
    }, {
      id: "mountain-ridges",
      alt: "Layered mountain ridges under a warm evening sky",
      src: __arcMedia34,
      width: 1600,
      height: 1068
    }, {
      id: "alpine-lake",
      alt: "A calm alpine lake reflecting a rocky peak at golden hour",
      src: __arcMedia19,
      width: 1067,
      height: 1600
    }, {
      id: "coastline",
      alt: "A long coastline with waves rolling onto a beach below green cliffs",
      src: __arcMedia23,
      width: 1200,
      height: 1600
    }, {
      id: "sea-at-dusk",
      alt: "A calm sea at dusk with a low island on the horizon",
      src: __arcMedia39,
      width: 1067,
      height: 1600
    }, {
      id: "lisbon-tram",
      alt: "A yellow tram on a street lined with historic buildings in Lisbon",
      src: __arcMedia31,
      width: 1600,
      height: 1064
    }, {
      id: "lisbon-bridge",
      alt: "The 25 de Abril Bridge crossing the Tagus in Lisbon",
      src: __arcMedia29,
      width: 1600,
      height: 1166
    }, {
      id: "lisbon-rooftops",
      alt: "Terracotta rooftops of Lisbon running down to the river",
      src: __arcMedia30,
      width: 1280,
      height: 1600
    }, {
      id: "salmon-dinner",
      alt: "Seared salmon with a bright herb salsa and a glass of red wine",
      src: __arcMedia38,
      width: 1067,
      height: 1600
    }, {
      id: "chef-plating",
      alt: "A chef spooning sauce onto a plated dish in a dark kitchen",
      src: __arcMedia22,
      width: 1600,
      height: 1600
    }];
    function o(e) {
      return t.find((a) => a.id === e);
    }
    function n(e) {
      return s.find((a) => a.id === e);
    }
    var r = (e) => o(e).src;
    var l = (e) => ({"emma-collins":"__arcMedia13","marcus-johnson":"__arcMedia14","sofia-ramirez":"__arcMedia15"})[e];
  }
});

// src/dependencies/37380.cjs
var require__167 = __commonJS({
  "src/dependencies/37380.cjs"(exports, module2) {
    "use strict";
    var interop = require_interop();
    module2.exports = {
      showcase: "team-showcase_showcase__XBNWz",
      header: "team-showcase_header__xuRdp",
      gallery: "team-showcase_gallery__QHgOR",
      galleryGrid: "team-showcase_galleryGrid__BZDJR",
      galleryPerson: "team-showcase_galleryPerson__kmQXB",
      galleryPhoto: "team-showcase_galleryPhoto__GyOw0",
      personName: "team-showcase_personName__xn4Bc",
      personRole: "team-showcase_personRole__HnoAI",
      galleryDetail: "team-showcase_galleryDetail__ZASzd",
      crossfade: "team-showcase_crossfade__Vi0TW",
      galleryBioStage: "team-showcase_galleryBioStage__D6tzA",
      galleryBio: "team-showcase_galleryBio__aldd2",
      galleryBioIdentity: "team-showcase_galleryBioIdentity__xU2RK",
      galleryBioContent: "team-showcase_galleryBioContent__o7dMi",
      contact: "team-showcase_contact__FX52M",
      contactItems: "team-showcase_contactItems__8RzDm",
      contactItem: "team-showcase_contactItem__RRSpl",
      galleryNavigation: "team-showcase_galleryNavigation__bD6Oi",
      bio: "team-showcase_bio__jo2e1",
      bioStack: "team-showcase_bioStack__YV8ou",
      location: "team-showcase_location__2TJwh",
      filmTrack: "team-showcase_filmTrack__BiA45",
      filmPerson: "team-showcase_filmPerson__CPP2C",
      filmName: "team-showcase_filmName__ECk54",
      filmDetail: "team-showcase_filmDetail__e2YRN",
      arrows: "team-showcase_arrows__yesjU",
      directory: "team-showcase_directory__uEbUm",
      directoryList: "team-showcase_directoryList__et6Cu",
      directoryPerson: "team-showcase_directoryPerson__dSN1C",
      directoryTrigger: "team-showcase_directoryTrigger__PN6cF",
      directoryThumb: "team-showcase_directoryThumb__DtAa9",
      directoryName: "team-showcase_directoryName__E72_p",
      directoryRole: "team-showcase_directoryRole__PXXUQ",
      directoryIcon: "team-showcase_directoryIcon__ne_PT",
      directoryIconBar: "team-showcase_directoryIconBar__YLTjl",
      directoryPanel: "team-showcase_directoryPanel__p3DZm",
      directoryExpanded: "team-showcase_directoryExpanded__7_yTO",
      directoryPhoto: "team-showcase_directoryPhoto__R1quc",
      spotlight: "team-showcase_spotlight__D69PL",
      spotlightStage: "team-showcase_spotlightStage__VaNSo",
      spotlightCopy: "team-showcase_spotlightCopy__Smnc4",
      spotlightPhoto: "team-showcase_spotlightPhoto__E0TGQ",
      spotlightLayer: "team-showcase_spotlightLayer__cXHvY",
      srOnly: "team-showcase_srOnly__0uGYz",
      spotlightNav: "team-showcase_spotlightNav__74i82",
      spotlightThumb: "team-showcase_spotlightThumb___Ny2R",
      review: "team-showcase_review__wVtrf",
      reviewControls: "team-showcase_reviewControls__P08Ve"
    };
  }
});

// src/TeamShowcase.cjs
var require_TeamShowcase = __commonJS({
  "src/TeamShowcase.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.r(exports), interop.d(exports, {
      TeamShowcase: () => b,
      TeamShowcaseReview: () => v,
      default: () => N
    });
    var t = HostJSX;
    var s = require__19();
    var o = HostReact;
    var n = require__150();
    var r = require__151();
    var l = require__152();
    var d = require__155();
    var c = require__156();
    var h = require__160();
    var m = require__165();
    var p = require__166();
    var g = require__158();
    var u = require__167();
    var y = interop.n(u);
    var w = [{
      id: "emma",
      name: "Emma Collins",
      role: "Product designer",
      location: "Z\xFCrich, Switzerland",
      image: (0, p.o4)("emma-collins"),
      introduction: "Emma turns complex product decisions into calm, useful experiences. She cares about the first five minutes of a workflow and the details people notice much later.",
      focus: "Design systems and onboarding",
      email: "emma@arc.example",
      phone: "+1 (202) 555-0101"
    }, {
      id: "marcus",
      name: "Marcus Johnson",
      role: "Frontend engineer",
      location: "London, United Kingdom",
      image: (0, p.o4)("marcus-johnson"),
      introduction: "Marcus builds the foundations that let good ideas become dependable interfaces. He is happiest when a component feels simple to use and has room to grow.",
      focus: "Component architecture",
      email: "marcus@arc.example",
      phone: "+1 (202) 555-0102"
    }, {
      id: "ava",
      name: "Ava Mitchell",
      role: "Design lead",
      location: "Amsterdam, Netherlands",
      image: (0, p.o4)("ava-mitchell"),
      introduction: "Ava gives teams a shared point of view. She connects research, product direction, and the small decisions that make a service feel coherent.",
      focus: "Product direction",
      email: "ava@arc.example",
      phone: "+1 (202) 555-0103"
    }, {
      id: "jasmine",
      name: "Jasmine Brooks",
      role: "Platform engineer",
      location: "Berlin, Germany",
      image: (0, p.o4)("jasmine-brooks"),
      introduction: "Jasmine keeps the platform steady as the product finds its next shape. She works across performance, integrations, and the systems that should quietly keep working.",
      focus: "Platform and performance",
      email: "jasmine@arc.example",
      phone: "+1 (202) 555-0104"
    }, {
      id: "sofia",
      name: "Sofia Ramirez",
      role: "Operations partner",
      location: "New York, United States",
      image: (0, p.o4)("sofia-ramirez"),
      introduction: "Sofia makes space for focused work across a distributed team. She brings the right context together and helps a promising idea find its next practical step.",
      focus: "Team operations",
      email: "sofia@arc.example",
      phone: "+1 (202) 555-0105"
    }];
    var _ = [{
      value: "gallery",
      label: "Gallery"
    }, {
      value: "filmstrip",
      label: "Filmstrip"
    }, {
      value: "directory",
      label: "Directory"
    }, {
      value: "spotlight",
      label: "Spotlight"
    }];
    function j({
      person: e,
      sizes: a = "(max-width: 620px) 80vw, 30vw"
    }) {
      return (0, t.jsx)(s.default, {
        src: e.image,
        alt: "",
        fill: true,
        sizes: a
      });
    }
    function f({
      person: e
    }) {
      return (0, t.jsx)("div", {
        className: y().contact,
        "aria-label": `Sample contact details for ${e.name}`,
        children: (0, t.jsxs)("div", {
          className: y().contactItems,
          children: [(0, t.jsxs)("span", {
            className: y().contactItem,
            children: [(0, t.jsx)("span", {
              children: e.email
            }), (0, t.jsx)(m.CopyButton, {
              value: e.email,
              label: `Copy ${e.name}'s email`,
              iconOnly: true,
              variant: "plain"
            })]
          }), (0, t.jsxs)("span", {
            className: y().contactItem,
            children: [(0, t.jsx)("span", {
              children: e.phone
            }), (0, t.jsx)(m.CopyButton, {
              value: e.phone,
              label: `Copy ${e.name}'s phone number`,
              iconOnly: true,
              variant: "plain"
            })]
          })]
        })
      });
    }
    function x({
      people: e,
      selectedIndex: a,
      reduce: i,
      offset: s2 = 8,
      className: o2,
      itemClassName: r2,
      render: l2
    }) {
      let d2 = {
        duration: g.T.duration.standard,
        ease: [...g.T.ease.standard]
      };
      return (0, t.jsx)("div", {
        className: [y().crossfade, o2].filter(Boolean).join(" "),
        children: e.map((e2, o3) => {
          let c2 = o3 === a, h2 = i || c2 ? 0 : o3 < a ? -s2 : s2;
          return (0, t.jsx)(n.PY1.div, {
            className: r2,
            "data-active": c2 || void 0,
            "aria-hidden": !c2,
            inert: !c2,
            initial: false,
            animate: {
              opacity: +!!c2,
              x: 0,
              y: h2
            },
            transition: i ? {
              duration: 0
            } : c2 ? d2 : {
              ...d2,
              duration: g.T.duration.fast
            },
            children: l2(e2)
          }, e2.id);
        })
      });
    }
    function b({
      variant: e = "gallery",
      onPersonSelect: a,
      people: i = w,
      title: s2
    }) {
      let h2 = (0, r.I)() ?? false, m2 = (0, o.useId)(), p2 = (0, o.useRef)(null), u2 = (0, o.useRef)(null), [_2, v2] = (0, o.useState)(0), N2 = i[_2], [k, C] = (0, o.useState)(true), T = {
        duration: h2 ? 0 : g.T.duration.standard,
        ease: [...g.T.ease.enter]
      };
      function P(e2) {
        let t2 = (e2 + i.length) % i.length;
        v2(t2);
        let s3 = p2.current, o2 = s3?.children[t2];
        s3 && o2 && s3.scrollWidth > s3.clientWidth && s3.scrollTo({
          left: o2.offsetLeft - s3.firstElementChild.offsetLeft,
          behavior: h2 ? "instant" : "smooth"
        });
        let n2 = u2.current, r2 = n2?.children[t2];
        n2 && r2 && n2.scrollWidth > n2.clientWidth && n2.scrollTo({
          left: r2.offsetLeft - n2.firstElementChild.offsetLeft,
          behavior: h2 ? "instant" : "smooth"
        }), a?.(i[t2]);
      }
      let S = (0, t.jsx)(x, {
        people: i,
        selectedIndex: _2,
        reduce: h2,
        className: y().bioStack,
        itemClassName: y().bio,
        render: (e2) => (0, t.jsxs)(t.Fragment, {
          children: [(0, t.jsxs)("div", {
            children: [(0, t.jsx)("h3", {
              children: e2.name
            }), (0, t.jsx)("span", {
              children: e2.role
            })]
          }), (0, t.jsx)("p", {
            children: e2.introduction
          }), (0, t.jsx)("span", {
            className: y().location,
            children: e2.location
          })]
        })
      }), A = (0, t.jsxs)("p", {
        className: y().srOnly,
        "aria-live": "polite",
        "aria-atomic": "true",
        children: [N2.name, ", ", N2.role]
      }), B = (0, t.jsxs)("div", {
        className: y().arrows,
        children: [(0, t.jsx)("button", {
          type: "button",
          onClick: () => P(_2 - 1),
          "aria-label": "Show previous team member",
          children: (0, t.jsx)(d.A, {
            size: 16,
            strokeWidth: 1.75,
            "aria-hidden": "true"
          })
        }), (0, t.jsxs)("span", {
          children: [_2 + 1, " / ", i.length]
        }), (0, t.jsx)("button", {
          type: "button",
          onClick: () => P(_2 + 1),
          "aria-label": "Show next team member",
          children: (0, t.jsx)(c.A, {
            size: 16,
            strokeWidth: 1.75,
            "aria-hidden": "true"
          })
        })]
      });
      return (0, t.jsxs)("section", {
        className: `${y().showcase} ${y()[e]}`,
        "aria-labelledby": `${m2}-title`,
        children: [(0, t.jsxs)(n.PY1.header, {
          className: y().header,
          initial: !h2 && {
            opacity: 0,
            y: 8
          },
          whileInView: {
            opacity: 1,
            y: 0
          },
          viewport: {
            once: true,
            amount: 0.5
          },
          transition: {
            duration: h2 ? 0 : g.T.duration.considered,
            ease: [...g.T.ease.enter]
          },
          children: [(0, t.jsx)("h2", {
            id: `${m2}-title`,
            children: s2 ?? ("directory" === e ? "The people behind Arc" : "Meet the team")
          }), "gallery" !== e && (0, t.jsx)("p", {
            children: "Five people across design, engineering, and operations."
          })]
        }), "gallery" === e && (0, t.jsxs)(t.Fragment, {
          children: [(0, t.jsx)("div", {
            className: y().galleryGrid,
            ref: u2,
            children: i.map((e2, a2) => (0, t.jsxs)(n.PY1.button, {
              type: "button",
              initial: !h2 && {
                opacity: 0,
                y: 12
              },
              whileInView: {
                opacity: 1,
                y: 0
              },
              viewport: {
                once: true,
                amount: 0.2
              },
              transition: {
                duration: h2 ? 0 : g.T.duration.considered,
                delay: h2 ? 0 : 0.05 * a2,
                ease: [...g.T.ease.enter]
              },
              onFocus: (e3) => {
                e3.currentTarget.style.opacity = "1", e3.currentTarget.style.transform = "none";
              },
              className: y().galleryPerson,
              onClick: () => P(a2),
              "aria-pressed": _2 === a2,
              "aria-label": `Read about ${e2.name}`,
              "aria-controls": `${m2}-detail`,
              children: [(0, t.jsx)("span", {
                className: y().galleryPhoto,
                children: (0, t.jsx)(j, {
                  person: e2,
                  sizes: "(max-width: 620px) 70vw, 20vw"
                })
              }), (0, t.jsx)("span", {
                className: y().personName,
                children: e2.name
              }), (0, t.jsx)("span", {
                className: y().personRole,
                children: e2.role
              })]
            }, e2.id))
          }), (0, t.jsxs)("div", {
            id: `${m2}-detail`,
            className: y().galleryDetail,
            children: [(0, t.jsx)(x, {
              people: i,
              selectedIndex: _2,
              reduce: h2,
              className: y().galleryBioStage,
              itemClassName: y().galleryBio,
              render: (e2) => (0, t.jsxs)(t.Fragment, {
                children: [(0, t.jsxs)("div", {
                  className: y().galleryBioIdentity,
                  children: [(0, t.jsx)("h3", {
                    children: e2.name
                  }), (0, t.jsxs)("span", {
                    children: [e2.role, " \xB7 ", e2.location]
                  })]
                }), (0, t.jsxs)("div", {
                  className: y().galleryBioContent,
                  children: [(0, t.jsx)("p", {
                    children: e2.introduction
                  }), (0, t.jsx)(f, {
                    person: e2
                  })]
                })]
              })
            }), (0, t.jsx)("div", {
              className: y().galleryNavigation,
              children: B
            }), A]
          })]
        }), "filmstrip" === e && (0, t.jsxs)(t.Fragment, {
          children: [(0, t.jsx)("div", {
            ref: p2,
            className: y().filmTrack,
            children: i.map((e2, a2) => (0, t.jsxs)("button", {
              type: "button",
              className: y().filmPerson,
              "data-selected": _2 === a2,
              "aria-pressed": _2 === a2,
              "aria-label": `Read about ${e2.name}`,
              "aria-controls": `${m2}-detail`,
              onClick: () => P(a2),
              children: [(0, t.jsx)(j, {
                person: e2
              }), (0, t.jsx)("span", {
                className: y().filmName,
                children: e2.name
              })]
            }, e2.id))
          }), (0, t.jsxs)("div", {
            id: `${m2}-detail`,
            className: y().filmDetail,
            children: [S, B, A]
          })]
        }), "directory" === e && (0, t.jsx)("div", {
          className: y().directoryList,
          children: i.map((e2, a2) => (0, t.jsxs)("div", {
            className: y().directoryPerson,
            "data-selected": _2 === a2,
            children: [(0, t.jsxs)("button", {
              type: "button",
              className: y().directoryTrigger,
              onClick: () => {
                C(a2 !== _2 || !k), P(a2);
              },
              "aria-expanded": _2 === a2 && k,
              "aria-controls": `${m2}-${e2.id}`,
              children: [(0, t.jsx)("span", {
                className: y().directoryThumb,
                children: (0, t.jsx)(j, {
                  person: e2,
                  sizes: "96px"
                })
              }), (0, t.jsx)("span", {
                className: y().directoryName,
                children: e2.name
              }), (0, t.jsx)("span", {
                className: y().directoryRole,
                children: e2.role
              }), (0, t.jsxs)("svg", {
                className: y().directoryIcon,
                "data-open": _2 === a2 && k || void 0,
                width: "18",
                height: "18",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: 1.75,
                strokeLinecap: "round",
                "aria-hidden": "true",
                children: [(0, t.jsx)("path", {
                  d: "M5 12h14"
                }), (0, t.jsx)("path", {
                  className: y().directoryIconBar,
                  d: "M12 5v14"
                })]
              })]
            }), (0, t.jsx)(l.N, {
              initial: false,
              children: _2 === a2 && k && (0, t.jsx)(n.PY1.div, {
                id: `${m2}-${e2.id}`,
                className: y().directoryPanel,
                initial: h2 ? {
                  opacity: 0
                } : {
                  height: 0,
                  opacity: 0
                },
                animate: {
                  height: "auto",
                  opacity: 1
                },
                exit: h2 ? {
                  opacity: 0,
                  transition: {
                    duration: 0
                  }
                } : {
                  height: 0,
                  opacity: 0
                },
                transition: h2 ? {
                  duration: 0
                } : {
                  height: g.T.spring.smooth,
                  opacity: {
                    duration: g.T.duration.standard
                  }
                },
                children: (0, t.jsxs)("div", {
                  className: y().directoryExpanded,
                  children: [(0, t.jsx)("div", {
                    className: y().directoryPhoto,
                    children: (0, t.jsx)(j, {
                      person: e2
                    })
                  }), (0, t.jsxs)("div", {
                    children: [(0, t.jsx)("p", {
                      children: e2.introduction
                    }), (0, t.jsxs)("dl", {
                      children: [(0, t.jsxs)("div", {
                        children: [(0, t.jsx)("dt", {
                          children: "Based in"
                        }), (0, t.jsx)("dd", {
                          children: e2.location
                        })]
                      }), (0, t.jsxs)("div", {
                        children: [(0, t.jsx)("dt", {
                          children: "Working on"
                        }), (0, t.jsx)("dd", {
                          children: e2.focus
                        })]
                      })]
                    })]
                  })]
                })
              }, "panel")
            })]
          }, e2.id))
        }), "spotlight" === e && (0, t.jsxs)(t.Fragment, {
          children: [(0, t.jsxs)("div", {
            className: y().spotlightStage,
            children: [(0, t.jsxs)("div", {
              className: y().spotlightCopy,
              children: [S, B, A]
            }), (0, t.jsx)("div", {
              className: y().spotlightPhoto,
              children: i.map((e2, a2) => {
                let i2 = a2 === _2;
                return (0, t.jsx)(n.PY1.div, {
                  className: y().spotlightLayer,
                  "aria-hidden": "true",
                  style: {
                    zIndex: +!!i2
                  },
                  initial: false,
                  animate: {
                    opacity: +!!i2,
                    x: i2 || h2 ? 0 : a2 < _2 ? -12 : 12
                  },
                  transition: h2 ? {
                    duration: 0
                  } : i2 ? T : {
                    duration: 0,
                    delay: g.T.duration.standard
                  },
                  children: (0, t.jsx)(j, {
                    person: e2
                  })
                }, e2.id);
              })
            })]
          }), (0, t.jsx)("nav", {
            className: y().spotlightNav,
            "aria-label": "Choose a team member",
            children: i.map((e2, a2) => (0, t.jsxs)("button", {
              type: "button",
              onClick: () => P(a2),
              "aria-pressed": _2 === a2,
              children: [(0, t.jsx)("span", {
                className: y().spotlightThumb,
                children: (0, t.jsx)(j, {
                  person: e2,
                  sizes: "64px"
                })
              }), (0, t.jsx)("span", {
                children: e2.name.split(" ")[0]
              })]
            }, e2.id))
          })]
        })]
      });
    }
    function v() {
      let [e, a] = (0, o.useState)("gallery");
      return (0, t.jsxs)("div", {
        className: y().review,
        children: [(0, t.jsx)("div", {
          className: y().reviewControls,
          children: (0, t.jsx)(h.A, {
            label: "Team section design",
            options: _,
            value: e,
            onValueChange: (e2) => a(e2)
          })
        }), (0, t.jsx)(b, {
          variant: e
        }, e)]
      });
    }
    var N = b;
  }
});

// src/index.js
var index_exports = {};
__export(index_exports, {
  TeamShowcase: () => TeamShowcase,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_TeamShowcase = __toESM(require_TeamShowcase(), 1);
var TeamShowcase = import_TeamShowcase.default.TeamShowcase;
var index_default = TeamShowcase;

const PortableTeamShowcase = module.exports.TeamShowcase;
export {PortableTeamShowcase as TeamShowcase};
export default PortableTeamShowcase;
