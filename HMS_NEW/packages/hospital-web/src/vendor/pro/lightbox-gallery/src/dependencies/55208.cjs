// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
var t = {
    156: function (e) {
      var t,
        r,
        n,
        a = e.exports = {};
      function u() {
        throw Error("setTimeout has not been defined");
      }
      function l() {
        throw Error("clearTimeout has not been defined");
      }
      try {
        t = "function" == typeof setTimeout ? setTimeout : u;
      } catch (e) {
        t = u;
      }
      try {
        r = "function" == typeof clearTimeout ? clearTimeout : l;
      } catch (e) {
        r = l;
      }
      function o(e) {
        if (t === setTimeout) return setTimeout(e, 0);
        if ((t === u || !t) && setTimeout) return t = setTimeout, setTimeout(e, 0);
        try {
          return t(e, 0);
        } catch (r) {
          try {
            return t.call(null, e, 0);
          } catch (r) {
            return t.call(this, e, 0);
          }
        }
      }
      var i = [],
        s = !1,
        c = -1;
      function f() {
        s && n && (s = !1, n.length ? i = n.concat(i) : c = -1, i.length && d());
      }
      function d() {
        if (!s) {
          var e = o(f);
          s = !0;
          for (var t = i.length; t;) {
            for (n = i, i = []; ++c < t;) n && n[c].run();
            c = -1, t = i.length;
          }
          n = null, s = !1, function (e) {
            if (r === clearTimeout) return clearTimeout(e);
            if ((r === l || !r) && clearTimeout) return r = clearTimeout, clearTimeout(e);
            try {
              r(e);
            } catch (t) {
              try {
                return r.call(null, e);
              } catch (t) {
                return r.call(this, e);
              }
            }
          }(e);
        }
      }
      function p(e, t) {
        this.fun = e, this.array = t;
      }
      function h() {}
      a.nextTick = function (e) {
        var t = Array(arguments.length - 1);
        if (arguments.length > 1) for (var r = 1; r < arguments.length; r++) t[r - 1] = arguments[r];
        i.push(new p(e, t)), 1 !== i.length || s || o(d);
      }, p.prototype.run = function () {
        this.fun.apply(null, this.array);
      }, a.title = "browser", a.browser = !0, a.env = {}, a.argv = [], a.version = "", a.versions = {}, a.on = h, a.addListener = h, a.once = h, a.off = h, a.removeListener = h, a.removeAllListeners = h, a.emit = h, a.prependListener = h, a.prependOnceListener = h, a.listeners = function (e) {
        return [];
      }, a.binding = function (e) {
        throw Error("process.binding is not supported");
      }, a.cwd = function () {
        return "/";
      }, a.chdir = function (e) {
        throw Error("process.chdir is not supported");
      }, a.umask = function () {
        return 0;
      };
    }
  },
  r = {};
function n(e) {
  var a = r[e];
  if (void 0 !== a) return a.exports;
  var u = r[e] = {
      exports: {}
    },
    l = !0;
  try {
    t[e](u, u.exports, n), l = !1;
  } finally {
    l && delete r[e];
  }
  return u.exports;
}
n.ab = "//", module.exports = n(156);
