// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
var n = require("react");
function a(e) {
  var t = "https://react.dev/errors/" + e;
  if (1 < arguments.length) {
    t += "?args[]=" + encodeURIComponent(arguments[1]);
    for (var r = 2; r < arguments.length; r++) t += "&args[]=" + encodeURIComponent(arguments[r]);
  }
  return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
}
function u() {}
var l = {
    d: {
      f: u,
      r: function () {
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
  },
  o = Symbol.for("react.portal"),
  i = Symbol.for("react.recoverable"),
  s = Symbol.for("react.optimistic_key"),
  c = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
function f(e, t) {
  return "font" === e ? "" : "string" == typeof t ? "use-credentials" === t ? t : "" : void 0;
}
exports.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = l, exports.browser = function () {
  var e = Error(a(603));
  return Object.defineProperty(e, "$$typeof", {
    value: i
  }), e;
}, exports.createPortal = function (e, t) {
  var r = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
  if (!t || 1 !== t.nodeType && 9 !== t.nodeType && 11 !== t.nodeType) throw Error(a(299));
  return function (e, t, r) {
    var n = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
    return {
      $$typeof: o,
      key: null == n ? null : n === s ? s : "" + n,
      children: e,
      containerInfo: t,
      implementation: r
    };
  }(e, t, null, r);
}, exports.flushSync = function (e) {
  var t = c.T,
    r = l.p;
  try {
    if (c.T = null, l.p = 2, e) return e();
  } finally {
    c.T = t, l.p = r, l.d.f();
  }
}, exports.preconnect = function (e, t) {
  "string" == typeof e && (t = t ? "string" == typeof (t = t.crossOrigin) ? "use-credentials" === t ? t : "" : void 0 : null, l.d.C(e, t));
}, exports.prefetchDNS = function (e) {
  "string" == typeof e && l.d.D(e);
}, exports.preinit = function (e, t) {
  if ("string" == typeof e && t && "string" == typeof t.as) {
    var r = t.as,
      n = f(r, t.crossOrigin),
      a = "string" == typeof t.integrity ? t.integrity : void 0,
      u = "string" == typeof t.fetchPriority ? t.fetchPriority : void 0;
    "style" === r ? l.d.S(e, "string" == typeof t.precedence ? t.precedence : void 0, {
      crossOrigin: n,
      integrity: a,
      fetchPriority: u
    }) : "script" === r && l.d.X(e, {
      crossOrigin: n,
      integrity: a,
      fetchPriority: u,
      nonce: "string" == typeof t.nonce ? t.nonce : void 0
    });
  }
}, exports.preinitModule = function (e, t) {
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
}, exports.preload = function (e, t) {
  if ("string" == typeof e && "object" == typeof t && null !== t && "string" == typeof t.as) {
    var r = t.as,
      n = f(r, t.crossOrigin);
    l.d.L(e, r, {
      crossOrigin: n,
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
}, exports.preloadModule = function (e, t) {
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
}, exports.requestFormReset = function (e) {
  l.d.r(e);
}, exports.unstable_batchedUpdates = function (e, t) {
  return e(t);
}, exports.useFormState = function (e, t, r) {
  return c.H.useFormState(e, t, r);
}, exports.useFormStatus = function () {
  return c.H.useHostTransitionStatus();
}, exports.version = "19.3.0-canary-cbb046ab-20260731";
