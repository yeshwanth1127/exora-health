// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
Object.defineProperty(exports, "__esModule", {
  value: !0
}), Object.defineProperty(exports, "default", {
  enumerable: !0,
  get: function () {
    return o;
  }
});
let i = require("react"),
  n = i.useLayoutEffect,
  a = i.useEffect;
function o(e) {
  let {
    headManager: t,
    reduceComponentsToState: r
  } = e;
  function o() {
    if (t && t.mountedInstances) {
      let e = i.Children.toArray(Array.from(t.mountedInstances).filter(Boolean));
      t.updateHead(r(e));
    }
  }
  return n(() => (t?.mountedInstances?.add(e.children), () => {
    t?.mountedInstances?.delete(e.children);
  })), n(() => (t && (t._pendingUpdate = o), () => {
    t && (t._pendingUpdate = o);
  })), a(() => (t && t._pendingUpdate && (t._pendingUpdate(), t._pendingUpdate = null), () => {
    t && t._pendingUpdate && (t._pendingUpdate(), t._pendingUpdate = null);
  })), null;
}
