// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  o: () => u
});
var n = require("react/jsx-runtime"),
  o = require("react"),
  l = require("./39551.cjs");
let a = (0, o.createContext)(null);
var i = require("./27933.cjs"),
  s = require("./65239.cjs");
let c = e => !e.isLayoutDirty && e.willUpdate(!1),
  u = ({
    children: e,
    id: t,
    inherit: r = !0
  }) => {
    let u = (0, o.useContext)(l.L),
      d = (0, o.useContext)(a),
      [f, p] = function () {
        let e,
          t = (e = (0, o.useRef)(!1), (0, s.E)(() => (e.current = !0, () => {
            e.current = !1;
          }), []), e),
          [r, n] = (0, o.useState)(0),
          l = (0, o.useCallback)(() => {
            t.current && n(r + 1);
          }, [r]);
        return [(0, o.useCallback)(() => i.Gt.postRender(l), [l]), r];
      }(),
      g = (0, o.useRef)(null),
      h = u.id || d;
    if (null === g.current) {
      let e, n, o, l;
      (!0 == (!0 === (l = r)) || "id" === l) && h && (t = t ? h + "-" + t : h), g.current = {
        id: t,
        group: !0 === r && u.group || (e = new Set(), n = new WeakMap(), {
          add: t => {
            e.add(t), n.set(t, t.addEventListener("willUpdate", o));
          },
          remove: t => {
            e.delete(t);
            let r = n.get(t);
            r && (r(), n.delete(t)), o();
          },
          dirty: o = () => e.forEach(c)
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
