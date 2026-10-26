import * as HostReact from 'react';import * as HostJSX from 'react/jsx-runtime';import * as HostReactDOM from 'react-dom';const module={exports:{}};const PortableAssetBase=globalThis.location?.origin+'/';const __assetUrl=value=>value;
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

// src/vendor/pro/date-reel/src/interop.cjs
var require_interop = __commonJS({
  "src/vendor/pro/date-reel/src/interop.cjs"(exports) {
    "use strict";
    exports.d = (target, defs) => {
      for (const key in defs) if (!Object.prototype.hasOwnProperty.call(target, key)) Object.defineProperty(target, key, { enumerable: true, get: defs[key] });
    };
    exports.r = (target) => {
      Object.defineProperty(target, Symbol.toStringTag, { value: "Module" });
      Object.defineProperty(target, "__esModule", { value: true });
    };
    exports.n = (value) => {
      const getter = value && value.__esModule ? () => value.default : () => value;
      Object.defineProperty(getter, "a", { get: getter });
      return getter;
    };
    exports.t = (value, mode, requireModule) => {
      if (mode & 1) {
        if (typeof requireModule !== "function") throw new Error("Webpack namespace mode 1 requires an explicit module resolver");
        value = requireModule(value);
      }
      if (mode & 8) return value;
      if (mode & 4 && value && typeof value === "object" && value.__esModule) return value;
      const namespace = /* @__PURE__ */ Object.create(null);
      exports.r(namespace);
      Object.defineProperty(namespace, "default", { enumerable: true, value });
      if (mode & 2 && typeof value !== "string" && value != null) for (const key in Object(value)) exports.d(namespace, { [key]: () => value[key] });
      return namespace;
    };
    exports.o = (object, property) => Object.prototype.hasOwnProperty.call(object, property);
    exports.nc = void 0;
    exports.g = globalThis;
  }
});

// src/vendor/pro/date-reel/src/dependencies/25620.cjs
var require__ = __commonJS({
  "src/vendor/pro/date-reel/src/dependencies/25620.cjs"(exports) {
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

// src/vendor/pro/date-reel/src/dependencies/10887.cjs
var require__2 = __commonJS({
  "src/vendor/pro/date-reel/src/dependencies/10887.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      Uu: () => r
    });
    var n = require__();
    var s = "u" > typeof window;
    function r() {
      if (n.r.current = true, s) if (window.matchMedia) {
        let t = window.matchMedia("(prefers-reduced-motion)"), e = () => n.O.current = t.matches;
        t.addEventListener("change", e), e();
      } else n.O.current = false;
    }
  }
});

// src/vendor/pro/date-reel/src/dependencies/18310.cjs
var require__3 = __commonJS({
  "src/vendor/pro/date-reel/src/dependencies/18310.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      I: () => o
    });
    var n = require__();
    var s = require__2();
    var r = HostReact;
    function o() {
      n.r.current || (0, s.Uu)();
      let [t] = (0, r.useState)(n.O.current);
      return t;
    }
  }
});

// src/vendor/pro/date-reel/src/dependencies/90209.cjs
var require__4 = __commonJS({
  "src/vendor/pro/date-reel/src/dependencies/90209.cjs"(exports) {
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

// src/vendor/pro/date-reel/src/dependencies/51811.cjs
var require__5 = __commonJS({
  "src/vendor/pro/date-reel/src/dependencies/51811.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      A: () => r
    });
    var n = HostReact;
    var s = require__4();
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

// src/vendor/pro/date-reel/src/dependencies/92571.cjs
var require__6 = __commonJS({
  "src/vendor/pro/date-reel/src/dependencies/92571.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      A: () => l
    });
    var n = require__5();
    var a = {
      name: "loader-circle",
      size: 24,
      node: [["path", {
        d: "M21 12a9 9 0 1 1-6.219-8.56",
        key: "13zald"
      }]],
      aliases: ["loader-2"]
    };
    a.node;
    var l = (0, n.A)(a);
  }
});

// src/vendor/pro/date-reel/src/dependencies/64577.cjs
var require__7 = __commonJS({
  "src/vendor/pro/date-reel/src/dependencies/64577.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.d(exports, {
      A: () => l
    });
    var n = require__5();
    var a = {
      name: "check",
      size: 24,
      node: [["path", {
        d: "M20 6 9 17l-5-5",
        key: "1gmf2c"
      }]]
    };
    a.node;
    var l = (0, n.A)(a);
  }
});

// src/vendor/pro/date-reel/src/dependencies/40426.cjs
var require__8 = __commonJS({
  "src/vendor/pro/date-reel/src/dependencies/40426.cjs"(exports, module2) {
    "use strict";
    var interop = require_interop();
    module2.exports = {
      root: "date-reel_root__Ic5be",
      body: "date-reel_body__cRUqq",
      header: "date-reel_header__M1A_a",
      title: "date-reel_title__2CiaT",
      summary: "date-reel_summary__NXtNp",
      headline: "date-reel_headline__0QliI",
      detail: "date-reel_detail__5uCvf",
      stage: "date-reel_stage__mmtdh",
      lens: "date-reel_lens__TxQGl",
      reels: "date-reel_reels__CJ79k",
      reel: "date-reel_reel__o021h",
      sizer: "date-reel_sizer__YLduZ",
      drum: "date-reel_drum__FTpDm",
      window: "date-reel_window__m0DLY",
      item: "date-reel_item__SRN9Z",
      lensItem: "date-reel_lensItem__s6jEt",
      footer: "date-reel_footer__cesU_",
      presets: "date-reel_presets__rwD4J",
      preset: "date-reel_preset__lxjeZ",
      confirm: "date-reel_confirm__3Nq1A",
      confirmStack: "date-reel_confirmStack__p8l56",
      spin: "date-reel_spin__N5y9z",
      srOnly: "date-reel_srOnly__4NGu8"
    };
  }
});

// src/vendor/pro/date-reel/src/dependencies/72575.cjs
var require__9 = __commonJS({
  "src/vendor/pro/date-reel/src/dependencies/72575.cjs"(exports, module2) {
    "use strict";
    var interop = require_interop();
    module2.exports = {
      demo: "date-reel_demo__u_Y__"
    };
  }
});

// src/vendor/pro/date-reel/src/Component.cjs
var require_Component = __commonJS({
  "src/vendor/pro/date-reel/src/Component.cjs"(exports) {
    "use strict";
    var interop = require_interop();
    interop.r(exports), interop.d(exports, {
      DateReelDemo: () => C,
      DateReel: () => A,
      default: () => I
    });
    var n = HostJSX;
    var a = HostReact;
    var l = require__3();
    var o = require__6();
    var u = require__7();
    var i = require__8();
    var c = interop.n(i);
    var s = 20 * Math.PI / 180;
    var d = 1 / (2 * Math.sin(s / 2));
    var m = new Date(2026, 8, 24, 9, 30);
    var p = (e, t) => (e % t + t) % t;
    var h = (e, t, r) => Math.min(r, Math.max(t, e));
    var f = (e) => new Date(e.getFullYear(), e.getMonth(), e.getDate());
    var g = (e, t) => new Date(e.getFullYear(), e.getMonth(), e.getDate() + t, e.getHours(), e.getMinutes());
    var y = (e, t) => Math.round((f(e).getTime() - f(t).getTime()) / 864e5);
    var M = (e, t) => new Date(e, t + 1, 0).getDate();
    var v = (e) => e.charAt(0).toLocaleUpperCase() + e.slice(1);
    var _ = (e) => String(e).padStart(2, "0");
    var w = (e) => ({
      p: e,
      v: 0,
      mode: 0,
      target: e,
      k: 0,
      stiff: 0,
      damp: 0,
      delay: 0,
      wheelAt: 0,
      samples: []
    });
    var b = (e) => 0.55 * e * 2.4 / (2.4 + 0.55 * e);
    var x = [{
      label: "This evening",
      value: (e) => new Date(e.getFullYear(), e.getMonth(), e.getDate(), 18, 0)
    }, {
      label: "Tomorrow",
      value: (e) => new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1, 9, 0)
    }, {
      label: "Monday",
      value: (e) => new Date(e.getFullYear(), e.getMonth(), e.getDate() + ((8 - e.getDay()) % 7 || 7), 9, 0)
    }];
    var k = {
      day: "Day",
      month: "Month",
      date: "Day of month",
      year: "Year",
      hour: "Hour",
      minute: "Minute",
      period: "AM or PM",
      at: "at",
      presets: "Quick picks",
      confirm: "Schedule",
      pending: "Scheduling",
      done: "Scheduled",
      failed: "Try again"
    };
    function D(e, t, r, n2, a2) {
      let l2;
      if ("date" === t) return {
        headline: n2.full.format(e).replace(/,? \d{4}$/, ""),
        detail: `${(function(e2, t2, r2) {
          let n3 = y(e2, t2);
          if (45 > Math.abs(n3)) return v(r2.relative.format(n3, "day"));
          let a3 = (e2.getFullYear() - t2.getFullYear()) * 12 + e2.getMonth() - t2.getMonth();
          return 18 > Math.abs(a3) ? v(r2.relative.format(a3, "month")) : v(r2.relative.format(Math.trunc(a3 / 12), "year"));
        })(e, r, n2)}, ${e.getFullYear()}`
      };
      let o2 = n2.time.format(e);
      return "time" === t ? {
        headline: o2,
        detail: n2.full.format(e)
      } : {
        headline: `${1 >= Math.abs(l2 = y(e, r)) ? v(n2.relative.format(l2, "day")) : l2 > 1 && l2 < 7 ? n2.shortDay.format(e) : n2.monthDay.format(e)} ${a2} ${o2}`,
        detail: n2.full.format(e)
      };
    }
    function j(e, t, r, n2, a2, l2, o2, u2) {
      let i2 = Math.min(60 / o2 - 1, Math.round(e.getMinutes() / o2)), c2 = e.getHours(), s2 = 12 === u2 ? [c2 % 12, i2, +(c2 >= 12)] : [c2, i2];
      return "time" === t ? s2 : "date" === t ? [e.getMonth(), e.getDate() - 1, h(e.getFullYear() - n2, 0, a2 - 1)] : [h(y(e, r), 0, l2 - 1), ...s2];
    }
    function A({
      mode: e = "datetime",
      value: t,
      defaultValue: r,
      onChange: i2,
      today: N2,
      minDate: R2,
      maxDate: T2,
      minuteStep: F2 = 5,
      hourCycle: C2 = 12,
      locale: I2 = "en-US",
      presets: Y = x,
      title: L,
      onConfirm: S,
      labels: E,
      intro: z = true,
      speed: $ = 1,
      paused: P = false,
      accent: q,
      label: U,
      className: O,
      style: H
    }) {
      let B = (0, a.useMemo)(() => ({
        ...k,
        ...E
      }), [E]), K = (0, l.I)() ?? false, W = (0, a.useId)(), [Q] = (0, a.useState)(() => t ?? r ?? m), [Z, G] = (0, a.useState)(Q), [J, X] = (0, a.useState)(""), [V, ee] = (0, a.useState)("idle"), [et, er] = (0, a.useState)(-1), en = f(N2 ?? Q).getTime(), ea = (0, a.useMemo)(() => new Date(en), [en]), el = f(R2 ?? ("date" === e ? new Date(ea.getFullYear() - 100, 0, 1) : g(ea, -30))).getTime(), eo = f(T2 ?? ("date" === e ? new Date(ea.getFullYear() + 10, 11, 31) : g(ea, 365))).getTime(), eu = (0, a.useMemo)(() => new Date(el), [el]), ei = (0, a.useMemo)(() => new Date(Math.max(el, eo)), [el, eo]), ec = y(ei, eu) + 1, es = eu.getFullYear(), ed = ei.getFullYear() - es + 1, em = (0, a.useMemo)(() => {
        let e3, t2, r2;
        return t2 = (e3 = (e4) => new Intl.DateTimeFormat(I2, e4))({
          hour: "numeric",
          hour12: true
        }), r2 = (e4) => t2.formatToParts(new Date(2026, 0, 1, e4)).find((e5) => "dayPeriod" === e5.type)?.value ?? (e4 < 12 ? "AM" : "PM"), {
          dayLabel: e3({
            weekday: "short",
            month: "short",
            day: "numeric"
          }),
          month: e3({
            month: "long"
          }),
          time: e3({
            hour: "numeric",
            minute: "2-digit",
            hour12: 12 === C2
          }),
          full: e3({
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
          }),
          shortDay: e3({
            weekday: "long"
          }),
          monthDay: e3({
            weekday: "short",
            month: "short",
            day: "numeric"
          }),
          relative: new Intl.RelativeTimeFormat(I2, {
            numeric: "auto"
          }),
          periods: [r2(9), r2(21)]
        };
      }, [I2, C2]), ep = (0, a.useMemo)(() => (function(e3, t2, r2, n2, a2, l2, o2, u2, i3, c2) {
        let s2 = 12 === i3 ? {
          key: "hour",
          name: c2.hour,
          count: 12,
          loop: true,
          align: "end",
          page: 3,
          sizer: ["12"],
          label: (e4) => String(0 === e4 ? 12 : e4)
        } : {
          key: "hour",
          name: c2.hour,
          count: 24,
          loop: true,
          align: "end",
          page: 6,
          sizer: ["00"],
          label: _
        }, d2 = {
          key: "minute",
          name: c2.minute,
          count: 60 / u2,
          loop: true,
          align: "start",
          page: Math.max(1, Math.round(15 / u2)),
          sizer: ["00"],
          label: (e4) => _(e4 * u2)
        }, m2 = {
          key: "period",
          name: c2.period,
          count: 2,
          loop: false,
          align: "start",
          page: 1,
          sizer: [...t2.periods],
          label: (e4) => t2.periods[e4] ?? ""
        }, p2 = 12 === i3 ? [s2, d2, m2] : [s2, d2];
        if ("time" === e3) return p2;
        if ("date" === e3) {
          let e4 = Array.from({
            length: 12
          }, (e5, r3) => t2.month.format(new Date(2026, r3, 1)));
          return [{
            key: "month",
            name: c2.month,
            count: 12,
            loop: true,
            align: "start",
            page: 3,
            sizer: e4,
            label: (t3) => e4[t3]
          }, {
            key: "date",
            name: c2.date,
            count: 31,
            loop: true,
            align: "end",
            page: 7,
            sizer: ["00"],
            label: (e5) => String(e5 + 1)
          }, {
            key: "year",
            name: c2.year,
            count: o2,
            loop: false,
            align: "start",
            page: 10,
            sizer: ["0000"],
            label: (e5) => String(l2 + e5)
          }];
        }
        let h2 = y(a2, r2), f2 = v(t2.relative.format(0, "day")), M2 = (e4) => e4 === h2 ? f2 : t2.dayLabel.format(g(r2, e4)), w2 = /* @__PURE__ */ new Map([[f2, f2]]);
        for (let e4 = 0; e4 < Math.min(n2, 400); e4++) {
          let t3 = M2(e4).replace(/\d/g, "0");
          w2.has(t3) || w2.set(t3, t3);
        }
        let b2 = [...w2.values()];
        return [{
          key: "day",
          name: c2.day,
          count: n2,
          loop: false,
          align: "end",
          page: 7,
          sizer: b2,
          label: M2
        }, ...p2];
      })(e, em, eu, ec, ea, es, ed, F2, C2, B), [e, em, eu, ec, ea, es, ed, F2, C2, B]), eh = (0, a.useCallback)((t2) => j(t2, e, eu, es, ed, ec, F2, C2), [e, eu, es, ed, ec, F2, C2]), ef = (0, a.useCallback)((t2, r2) => {
        let n2 = (e3, t3, r3) => ({
          h: 12 === C2 ? p(e3, 12) + 12 * (1 === r3) : p(e3, 24),
          m: p(t3, 60 / F2) * F2
        });
        if ("date" === e) {
          let e3 = es + h(t2[2], 0, ed - 1), n3 = p(t2[0], 12);
          return new Date(e3, n3, Math.min(p(t2[1], 31) + 1, M(e3, n3)), r2.getHours(), r2.getMinutes());
        }
        if ("time" === e) {
          let e3 = n2(t2[0], t2[1], t2[2]);
          return new Date(r2.getFullYear(), r2.getMonth(), r2.getDate(), e3.h, e3.m);
        }
        let a2 = g(eu, h(t2[0], 0, ec - 1)), l2 = n2(t2[1], t2[2], t2[3]);
        return new Date(a2.getFullYear(), a2.getMonth(), a2.getDate(), l2.h, l2.m);
      }, [e, C2, F2, es, ed, eu, ec]), eg = (0, a.useRef)(null), ey = (0, a.useRef)([]), eM = (0, a.useRef)([]), ev = (0, a.useRef)([]), e_ = (0, a.useRef)([]), ew = (0, a.useRef)([]), eb = (0, a.useRef)(null), ex = (0, a.useRef)(null), ek = (0, a.useRef)(36), [eD] = (0, a.useState)(() => ({
        current: j(Q, e, eu, es, ed, ec, F2, C2).map(w)
      })), ej = (0, a.useRef)(0), eA = (0, a.useRef)(0), eN = (0, a.useRef)(false), eR = (0, a.useRef)(z), eT = (0, a.useRef)(false), eF = (0, a.useRef)(false), eC = (0, a.useRef)(""), eI = (0, a.useRef)(null), eY = (0, a.useRef)(Z), eL = (0, a.useRef)(null), eS = (0, a.useRef)({
        text: "",
        at: 0
      }), eE = (0, a.useRef)([]), ez = K || P, e$ = (0, a.useRef)({
        columns: ep,
        fromIndexes: ef,
        toIndexes: eh,
        f: em,
        today: ea,
        mode: e,
        L: B,
        instant: ez,
        speed: $,
        onChange: i2
      });
      (0, a.useLayoutEffect)(() => {
        e$.current = {
          columns: ep,
          fromIndexes: ef,
          toIndexes: eh,
          f: em,
          today: ea,
          mode: e,
          L: B,
          instant: ez,
          speed: $,
          onChange: i2
        };
      });
      let eP = ep.map((e3) => `${e3.key}:${e3.count}`).join("|"), eq = () => eD.current.map((e3, t2) => {
        let r2 = e$.current.columns[t2], n2 = Math.round(e3.p);
        return r2.loop ? p(n2, r2.count) : h(n2, 0, r2.count - 1);
      }), eU = (0, a.useCallback)(() => {
        let {
          columns: e3,
          fromIndexes: t2,
          f: r2,
          today: n2,
          mode: a2,
          L: l2
        } = e$.current, o2 = d * ek.current, u2 = 31;
        if ("date" === a2) {
          let t3 = e3.findIndex((e4) => "month" === e4.key), r3 = e3.findIndex((e4) => "year" === e4.key), n3 = p(Math.round(eD.current[t3]?.p ?? 0), 12);
          u2 = M(Number(e3[r3]?.label(h(Math.round(eD.current[r3]?.p ?? 0), 0, e3[r3].count - 1)) ?? 2026), n3);
        }
        e3.forEach((e4, t3) => {
          let r3 = eD.current[t3];
          if (!r3) return;
          let n3 = Math.round(r3.p), a3 = e_.current[t3] ??= [], l3 = ew.current[t3] ??= [];
          for (let i4 = 0; i4 < 11; i4++) {
            let c3 = n3 + i4 - 5, d2 = (c3 - r3.p) * s, m2 = eM.current[t3]?.[i4], h2 = ev.current[t3]?.[i4];
            if (!m2 || !h2) continue;
            let f2 = !e4.loop && (c3 < 0 || c3 >= e4.count), g2 = e4.loop ? p(c3, e4.count) : c3, y2 = f2 ? "" : e4.label(g2);
            a3[i4] !== y2 && (a3[i4] = y2, m2.textContent = y2, h2.textContent = y2);
            let M2 = "date" === e4.key && g2 + 1 > u2;
            if (l3[i4] !== M2 && (l3[i4] = M2, m2.toggleAttribute("data-off", M2), h2.toggleAttribute("data-off", M2)), Math.abs(d2) >= Math.PI / 2) {
              m2.style.opacity = "0", h2.style.opacity = "0";
              continue;
            }
            let v2 = Math.cos(d2), _2 = 4 / (5 - v2), w2 = `translate3d(0, ${(o2 * Math.sin(d2)).toFixed(2)}px, 0) scale(${_2.toFixed(4)}, ${(v2 * _2).toFixed(4)})`;
            m2.style.transform = w2, h2.style.transform = w2, m2.style.opacity = (v2 ** 1.5).toFixed(3), h2.style.opacity = "1";
          }
        });
        let i3 = eq(), c2 = eI.current ? `pin:${eI.current.getTime()}` : i3.join(",");
        if (c2 !== eC.current) {
          eC.current = c2;
          let e4 = D(eI.current ?? t2(i3, eY.current), a2, n2, r2, l2.at);
          eb.current && (eb.current.textContent = e4.headline), ex.current && (ex.current.textContent = e4.detail);
        }
      }, []), eO = (0, a.useCallback)(() => {
        let {
          columns: e3,
          fromIndexes: t2,
          mode: r2,
          f: n2,
          today: a2,
          L: l2,
          instant: o2
        } = e$.current;
        eT.current = false;
        let u2 = eq();
        if ("date" === r2) {
          let r3 = e3.findIndex((e4) => "date" === e4.key), n3 = t2(u2, eY.current).getDate() - 1;
          if (u2[r3] !== n3) {
            let e4 = eD.current[r3], t3 = Math.round(e4.p) - (u2[r3] - n3);
            if (o2) e4.p = t3, e4.target = t3, eU();
            else {
              e4.target = t3, e4.mode = 3, e4.stiff = 300, e4.damp = 2 * Math.sqrt(300), eT.current = true, eB();
              return;
            }
          }
        }
        let i3 = t2(eq(), eY.current);
        if (i3.getTime() !== eY.current.getTime() && (eY.current = i3, G(i3), eF.current)) {
          let e4 = D(i3, r2, a2, n2, l2.at);
          X(`${e4.headline}. ${e4.detail}`), ee((e5) => "idle" === e5 ? e5 : "idle"), e$.current.onChange?.(i3);
        }
      }, [eU]), eH = (0, a.useCallback)((e3) => {
        let t2 = Math.min(0.05, (e3 - (eA.current || e3)) / 1e3);
        eA.current = e3;
        let r2 = t2 * e$.current.speed, n2 = false;
        for (let t3 of eD.current) {
          if (0 === t3.mode || (n2 = true, 1 === t3.mode)) continue;
          if (t3.delay > 0) {
            t3.delay -= r2;
            continue;
          }
          if (4 === t3.mode) {
            let n3 = t3.p;
            t3.p += (t3.target - t3.p) * (1 - Math.exp(-22 * r2)), t3.v = r2 > 0 ? (t3.p - n3) / r2 : 0, e3 - t3.wheelAt > 100 && (t3.mode = 3, t3.target = eK(eD.current.indexOf(t3), t3.target), t3.stiff = 260, t3.damp = 2 * Math.sqrt(260));
            continue;
          }
          if (2 === t3.mode) {
            let e4 = (t3.target - t3.p) * Math.exp(-t3.k * r2);
            if (t3.p = t3.target - e4, t3.v = t3.k * e4, 0.45 > Math.abs(e4)) {
              let e5 = Math.min(Math.max(t3.k, 8), 1.75 * t3.k);
              t3.mode = 3, t3.stiff = e5 * e5, t3.damp = 2 * e5;
            }
            continue;
          }
          let a2 = 1 / 240;
          for (let e4 = 0; e4 < r2; e4 += a2) {
            let n3 = Math.min(a2, r2 - e4);
            t3.v += (-t3.stiff * (t3.p - t3.target) - t3.damp * t3.v) * n3, t3.p += t3.v * n3;
          }
          15e-4 > Math.abs(t3.p - t3.target) && 0.02 > Math.abs(t3.v) && (t3.p = t3.target, t3.v = 0, t3.mode = 0);
        }
        eU(), n2 ? ej.current = requestAnimationFrame(eH) : (ej.current = 0, eA.current = 0, eI.current && (eI.current = null, eU()), eT.current && eO());
      }, [eU, eO]);
      function eB() {
        ej.current || !eN.current || document.hidden || (ej.current = requestAnimationFrame(eH));
      }
      function eK(e3, t2) {
        let r2 = e$.current.columns[e3], n2 = Math.round(t2);
        return r2.loop ? n2 : h(n2, 0, r2.count - 1);
      }
      function eW(e3, t2, r2 = 260, n2 = 0) {
        let a2 = eD.current[e3];
        if (a2) {
          if (eT.current = true, e$.current.instant) {
            a2.p = t2, a2.target = t2, a2.v = 0, a2.mode = 0, eU(), ej.current || eO();
            return;
          }
          a2.target = t2, a2.mode = 3, a2.stiff = r2, a2.damp = 2 * Math.sqrt(r2), a2.delay = n2, eB();
        }
      }
      let eQ = (e3, t2 = 0) => {
        let r2 = e$.current.toIndexes(e3);
        e$.current.instant || (eI.current = e$.current.fromIndexes(r2, eY.current), eC.current = ""), e$.current.columns.forEach((e4, n2) => {
          let a2 = eD.current[n2], l2 = e4.loop ? Math.round(a2.target) + (p(r2[n2] - Math.round(a2.target), e4.count) + e4.count / 2) % e4.count - e4.count / 2 : r2[n2];
          eW(n2, Math.round(l2), 150, t2 * n2);
        });
      }, eZ = t?.getTime();
      (0, a.useEffect)(() => {
        if (void 0 === eZ || eZ === eY.current.getTime()) return;
        let e3 = new Date(eZ);
        eF.current = false, eQ(e3);
      }, [eZ]);
      let eG = (0, a.useRef)(eP);
      (0, a.useLayoutEffect)(() => {
        eG.current === eP || (eG.current = eP, eD.current = eh(eY.current).map(w), e_.current = [], ew.current = [], eC.current = "", eU());
      }, [eP, ep, eh, eU, eD]), (0, a.useLayoutEffect)(() => {
        let e3 = eg.current;
        if (!e3) return;
        (!eR.current || e$.current.instant) && e3.removeAttribute("data-intro");
        let t2 = () => {
          let t3 = e3.querySelector("[data-row]"), r3 = t3?.getBoundingClientRect().height || 36;
          Math.abs(r3 - ek.current) > 0.1 && (ek.current = r3, eU());
        };
        t2(), eU();
        let r2 = new ResizeObserver(t2);
        r2.observe(e3);
        let n2 = new IntersectionObserver(([t3]) => {
          if (eN.current = t3.isIntersecting, !t3.isIntersecting) {
            cancelAnimationFrame(ej.current), ej.current = 0, eA.current = 0;
            return;
          }
          eR.current && (eR.current = false, e$.current.instant || (e$.current.columns.forEach((e4, t4) => {
            let r3 = eD.current[t4], n3 = e4.loop ? r3.p - (5 + 2 * t4) : r3.p >= 1 ? Math.max(0, r3.p - 6) : Math.min(e4.count - 1, r3.p + 6);
            if (n3 === r3.p) return;
            let a3 = r3.p;
            r3.p = n3, r3.target = a3, r3.mode = 2, r3.k = 3, r3.delay = 0.07 * t4;
          }), eI.current = eY.current, eC.current = "", eU()), e3.removeAttribute("data-intro")), eD.current.some((e4) => 0 !== e4.mode) && eB();
        }, {
          threshold: 0.25
        });
        n2.observe(e3);
        let a2 = () => {
          document.hidden ? (cancelAnimationFrame(ej.current), ej.current = 0, eA.current = 0) : eD.current.some((e4) => 0 !== e4.mode) && eB();
        };
        return document.addEventListener("visibilitychange", a2), () => {
          r2.disconnect(), n2.disconnect(), document.removeEventListener("visibilitychange", a2), cancelAnimationFrame(ej.current), ej.current = 0;
        };
      }, [eU]), (0, a.useEffect)(() => {
        if (!ez) {
          eD.current.some((e4) => 0 !== e4.mode && 1 !== e4.mode) && eB();
          return;
        }
        let e3 = false;
        eD.current.forEach((t2, r2) => {
          (2 === t2.mode || 3 === t2.mode || 4 === t2.mode) && (t2.p = 4 === t2.mode ? eK(r2, t2.target) : t2.target, t2.v = 0, t2.mode = 0, e3 = true);
        }), e3 && (cancelAnimationFrame(ej.current), ej.current = 0, eU(), eO());
      }, [ez]), (0, a.useEffect)(() => {
        let e3 = ey.current.map((e4, t2) => {
          if (!e4) return () => {
          };
          let r2 = (e5) => {
            if (Math.abs(e5.deltaY) < Math.abs(e5.deltaX)) return;
            e5.preventDefault();
            let r3 = eD.current[t2], n2 = e$.current.columns[t2];
            if (!r3 || !n2 || 1 === r3.mode) return;
            let a2 = 1 === e5.deltaMode ? 16 : 2 === e5.deltaMode ? 240 : 1, l2 = e5.deltaY * a2 / (1.4 * ek.current);
            if (eF.current = true, eT.current = true, eI.current = null, !e$.current.instant) {
              4 !== r3.mode && (r3.target = r3.p), r3.target += l2, n2.loop || (r3.target = h(r3.target, -0.35, n2.count - 0.65)), r3.mode = 4, r3.wheelAt = performance.now(), eB();
              return;
            }
            r3.p += l2, n2.loop || (r3.p = h(r3.p, -0.35, n2.count - 0.65)), r3.v = 0, r3.target = r3.p, r3.mode = 4, r3.wheelAt = performance.now(), eU(), window.clearTimeout(eE.current[t2]), eE.current[t2] = window.setTimeout(() => {
              r3.p = eK(t2, r3.p), r3.target = r3.p, r3.mode = 0, eU(), eO();
            }, 140);
          };
          return e4.addEventListener("wheel", r2, {
            passive: false
          }), () => e4.removeEventListener("wheel", r2);
        });
        return () => e3.forEach((e4) => e4());
      }, [eP]);
      let eJ = (e3) => {
        let t2 = eL.current;
        if (!t2 || t2.pointer !== e3.pointerId) return;
        let r2 = eD.current[t2.col], n2 = e$.current.columns[t2.col], a2 = e3.clientY - t2.y;
        Math.abs(a2) > 3 && (t2.moved = true);
        let l2 = t2.p - a2 / ek.current;
        !n2.loop && (l2 < 0 ? l2 = -b(-l2) : l2 > n2.count - 1 && (l2 = n2.count - 1 + b(l2 - (n2.count - 1)))), r2.p = l2;
        let o2 = performance.now();
        for (r2.samples.push({
          t: o2,
          p: l2
        }); r2.samples.length > 2 && o2 - r2.samples[0].t > 100; ) r2.samples.shift();
        eN.current ? ej.current || (ej.current = requestAnimationFrame(eH)) : eU();
      }, eX = (e3) => {
        let t2 = eL.current;
        if (!t2 || t2.pointer !== e3.pointerId) return;
        eL.current = null, eg.current?.removeAttribute("data-dragging");
        let r2 = t2.col, n2 = eD.current[r2], a2 = e$.current.columns[r2];
        if (!t2.moved) {
          let t3 = e3.currentTarget.getBoundingClientRect(), a3 = Math.round(Math.asin(h((e3.clientY - (t3.top + t3.height / 2)) / (d * ek.current), -0.98, 0.98)) / s);
          n2.mode = 0, eW(r2, eK(r2, Math.round(n2.p) + a3));
          return;
        }
        let l2 = performance.now(), o2 = n2.samples[0], u2 = n2.samples[n2.samples.length - 1], i3 = o2 && u2 && u2.t - o2.t > 8 && l2 - u2.t < 90 ? (u2.p - o2.p) / ((u2.t - o2.t) / 1e3) : 0;
        if (i3 = h(i3, -60, 60), e$.current.instant) {
          n2.mode = 0, n2.p = eK(r2, n2.p + 0.3 * i3), n2.target = n2.p, eU(), eO();
          return;
        }
        let c2 = !a2.loop && (n2.p < 0 || n2.p > a2.count - 1), m2 = eK(r2, n2.p + 0.32 * i3);
        if (n2.v = i3, c2 || 0.5 > Math.abs(i3)) n2.mode = 3, n2.target = eK(r2, n2.p), n2.stiff = 260, n2.damp = 2 * Math.sqrt(260);
        else {
          let e4 = i3 / (m2 - n2.p), t3 = !a2.loop && Math.round(n2.p + 0.32 * i3) !== m2;
          !t3 && e4 > 2.2 && e4 < 14 ? (n2.mode = 2, n2.target = m2, n2.k = e4) : (n2.mode = 3, n2.target = m2, n2.stiff = 170, n2.damp = 2 * Math.sqrt(170) * (t3 ? 0.62 : 1));
        }
        eB();
      }, eV = async () => {
        if (S && "pending" !== V) {
          ee("pending");
          try {
            await S(eY.current), ee("done"), X(`${B.done}. ${D(eY.current, e, ea, em, B.at).headline}`);
          } catch {
            ee("failed"), X(B.failed);
          }
        }
      }, e0 = eh(Z), e1 = D(Z, e, ea, em, B.at), e2 = false === Y ? [] : Y;
      return (0, n.jsxs)("div", {
        ref: eg,
        role: "group",
        "aria-label": U ?? ("time" === e ? "Time" : "date" === e ? "Date" : "Date and time"),
        className: [c().root, O].filter(Boolean).join(" "),
        style: {
          ...q ? {
            "--dr-accent": q
          } : void 0,
          ...H
        },
        "data-mode": e,
        "data-intro": z ? "" : void 0,
        children: [(0, n.jsxs)("div", {
          className: c().body,
          children: [(0, n.jsxs)("div", {
            className: c().header,
            children: [L && (0, n.jsx)("h3", {
              className: c().title,
              children: L
            }), (0, n.jsxs)("p", {
              className: c().summary,
              "aria-hidden": "true",
              children: [(0, n.jsx)("span", {
                ref: eb,
                className: c().headline,
                children: e1.headline
              }), (0, n.jsx)("span", {
                ref: ex,
                className: c().detail,
                children: e1.detail
              })]
            })]
          }), (0, n.jsxs)("div", {
            className: c().stage,
            children: [(0, n.jsx)("div", {
              className: c().lens,
              "aria-hidden": "true"
            }), (0, n.jsx)("div", {
              className: c().reels,
              children: ep.map((e3, t2) => {
                let r2 = e0[t2];
                return (0, n.jsxs)("div", {
                  ref: (e4) => {
                    ey.current[t2] = e4;
                  },
                  className: c().reel,
                  "data-align": e3.align,
                  style: {
                    "--dr-i": t2
                  },
                  "data-active": et === t2 ? "" : void 0,
                  role: "spinbutton",
                  tabIndex: 0,
                  "aria-label": e3.name,
                  "aria-valuemin": 0,
                  "aria-valuemax": e3.count - 1,
                  "aria-valuenow": r2,
                  "aria-valuetext": e3.label(r2),
                  onPointerDown: (e4) => {
                    if (0 !== e4.button || eL.current) return;
                    let r3 = eD.current[t2];
                    r3 && (e4.currentTarget.setPointerCapture(e4.pointerId), e4.currentTarget.focus({
                      preventScroll: true
                    }), r3.mode = 1, r3.v = 0, r3.samples = [{
                      t: performance.now(),
                      p: r3.p
                    }], eL.current = {
                      col: t2,
                      pointer: e4.pointerId,
                      y: e4.clientY,
                      p: r3.p,
                      moved: false
                    }, eI.current = null, eF.current = true, eT.current = true, eg.current?.setAttribute("data-dragging", ""));
                  },
                  onPointerMove: eJ,
                  onPointerUp: eX,
                  onPointerCancel: eX,
                  onKeyDown: (e4) => {
                    let r3 = e$.current.columns[t2], n2 = eD.current[t2];
                    if (!r3 || !n2) return;
                    let a2 = 0 === n2.mode || 3 === n2.mode ? Math.round(n2.target) : Math.round(n2.p), l2 = null;
                    switch (e4.key) {
                      case "ArrowUp":
                        l2 = a2 - 1;
                        break;
                      case "ArrowDown":
                        l2 = a2 + 1;
                        break;
                      case "PageUp":
                        l2 = a2 - r3.page;
                        break;
                      case "PageDown":
                        l2 = a2 + r3.page;
                        break;
                      case "Home":
                        l2 = r3.loop ? a2 - p(a2, r3.count) : 0;
                        break;
                      case "End":
                        l2 = r3.loop ? a2 - p(a2, r3.count) + r3.count - 1 : r3.count - 1;
                        break;
                      case "ArrowLeft":
                      case "ArrowRight": {
                        let r4 = t2 + ("ArrowLeft" === e4.key ? -1 : 1);
                        ey.current[r4] && (e4.preventDefault(), ey.current[r4]?.focus());
                        return;
                      }
                      default: {
                        if (1 !== e4.key.length || e4.metaKey || e4.ctrlKey || e4.altKey) return;
                        let t3 = performance.now(), n3 = (t3 - eS.current.at < 900 ? eS.current.text : "") + e4.key.toLocaleLowerCase();
                        eS.current = {
                          text: n3,
                          at: t3
                        };
                        let o2 = (e5) => {
                          for (let t4 = 0; t4 < r3.count; t4++) {
                            let n4 = p(a2 + 1 + t4 - (e5.length > 1), r3.count), l3 = r3.label(n4).toLocaleLowerCase();
                            if (l3.startsWith(e5) || l3.replace(/^0/, "").startsWith(e5)) return n4;
                          }
                          return -1;
                        }, u2 = o2(n3);
                        if (u2 < 0 && n3.length > 1 && (eS.current.text = e4.key.toLocaleLowerCase(), u2 = o2(eS.current.text)), u2 < 0) return;
                        l2 = r3.loop ? a2 + (p(u2 - a2, r3.count) + r3.count / 2) % r3.count - r3.count / 2 : u2;
                      }
                    }
                    e4.preventDefault(), eF.current = true, eI.current = null, eW(t2, eK(t2, Math.round(l2)), 300);
                  },
                  onFocus: () => er(t2),
                  onBlur: () => er((e4) => e4 === t2 ? -1 : e4),
                  children: [(0, n.jsx)("span", {
                    className: c().sizer,
                    "aria-hidden": "true",
                    "data-row": true,
                    children: e3.sizer.map((e4) => (0, n.jsx)("span", {
                      children: e4
                    }, e4))
                  }), (0, n.jsx)("span", {
                    className: c().drum,
                    "aria-hidden": "true",
                    children: Array.from({
                      length: 11
                    }, (a2, l2) => {
                      let o2 = r2 + l2 - 5, u2 = !e3.loop && (o2 < 0 || o2 >= e3.count) ? "" : e3.label(e3.loop ? p(o2, e3.count) : o2);
                      return (0, n.jsx)("span", {
                        ref: (e4) => {
                          (eM.current[t2] ??= [])[l2] = e4;
                        },
                        className: c().item,
                        children: u2
                      }, l2);
                    })
                  }), (0, n.jsx)("span", {
                    className: c().window,
                    "aria-hidden": "true",
                    children: Array.from({
                      length: 11
                    }, (a2, l2) => {
                      let o2 = r2 + l2 - 5, u2 = !e3.loop && (o2 < 0 || o2 >= e3.count) ? "" : e3.label(e3.loop ? p(o2, e3.count) : o2);
                      return (0, n.jsx)("span", {
                        ref: (e4) => {
                          (ev.current[t2] ??= [])[l2] = e4;
                        },
                        className: c().lensItem,
                        children: u2
                      }, l2);
                    })
                  })]
                }, e3.key);
              })
            })]
          }), (e2.length > 0 || S) && (0, n.jsxs)("div", {
            className: c().footer,
            children: [e2.length > 0 && (0, n.jsx)("div", {
              className: c().presets,
              role: "group",
              "aria-label": B.presets,
              children: e2.map((e3) => {
                let t2 = 6e4 > Math.abs(("function" == typeof e3.value ? e3.value(ea) : e3.value).getTime() - Z.getTime());
                return (0, n.jsx)("button", {
                  type: "button",
                  className: c().preset,
                  "aria-pressed": t2,
                  onClick: () => {
                    let t3;
                    return t3 = "function" == typeof e3.value ? e3.value(ea) : e3.value, void (eF.current = true, eQ(new Date(h(t3.getTime(), eu.getTime(), ei.getTime() + 864e5 - 6e4)), 0.06));
                  },
                  children: e3.label
                }, e3.label);
              })
            }), S && (0, n.jsx)("button", {
              type: "button",
              className: c().confirm,
              "data-state": V,
              onClick: eV,
              "aria-disabled": "pending" === V,
              children: (0, n.jsxs)("span", {
                className: c().confirmStack,
                children: [(0, n.jsx)("span", {
                  "data-show": "idle" === V || void 0,
                  children: B.confirm
                }), (0, n.jsxs)("span", {
                  "data-show": "pending" === V || void 0,
                  children: [(0, n.jsx)(o.A, {
                    className: c().spin,
                    size: 16,
                    strokeWidth: 1.75,
                    "aria-hidden": "true"
                  }), B.pending]
                }), (0, n.jsxs)("span", {
                  "data-show": "done" === V || void 0,
                  children: [(0, n.jsx)(u.A, {
                    size: 16,
                    strokeWidth: 1.75,
                    "aria-hidden": "true"
                  }), B.done]
                }), (0, n.jsx)("span", {
                  "data-show": "failed" === V || void 0,
                  children: B.failed
                })]
              })
            })]
          })]
        }), (0, n.jsx)("span", {
          id: `${W}-status`,
          className: c().srOnly,
          role: "status",
          "aria-live": "polite",
          children: J
        })]
      });
    }
    var N = require__9();
    var R = interop.n(N);
    var T = new Date(2026, 8, 24);
    var F = new Date(2026, 8, 25, 9, 0);
    function C() {
      return (0, n.jsx)("div", {
        className: R().demo,
        children: (0, n.jsx)(A, {
          title: "Send later",
          today: T,
          defaultValue: F,
          onConfirm: () => new Promise((e) => setTimeout(e, 900))
        })
      });
    }
    var I = C;
  }
});

// src/vendor/pro/date-reel/src/app-entry.js
var app_entry_exports = {};
__export(app_entry_exports, {
  DateReel: () => DateReel
});
module.exports = __toCommonJS(app_entry_exports);
var import_Component = __toESM(require_Component(), 1);
var DateReel = import_Component.default.DateReel;

const PublicDateReel=module.exports.DateReel; export {PublicDateReel as DateReel};
