// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  OU: () => h,
  Ql: () => u,
  Ww: () => p,
  hq: () => r,
  o4: () => l
});
var n = require("./56260.cjs"),
  s = require("./33411.cjs");
function r(t, e, i) {
  return i + e * (t - i);
}
function o(t, e, i, n, s) {
  return void 0 !== s && (t = n + s * (t - n)), n + i * (t - n) + e;
}
function a(t, e = 0, i = 1, n, s) {
  t.min = o(t.min, e, i, n, s), t.max = o(t.max, e, i, n, s);
}
function l(t, {
  x: e,
  y: i
}) {
  a(t.x, e.translate, e.scale, e.originPoint), a(t.y, i.translate, i.scale, i.originPoint);
}
function h(t, e, i, n = !1) {
  let r,
    o,
    a = i.length;
  if (a) {
    e.x = e.y = 1;
    for (let h = 0; h < a; h++) {
      o = (r = i[h]).projectionDelta;
      let {
        visualElement: a
      } = r.options;
      (!a || !a.props.style || "contents" !== a.props.style.display) && (n && r.options.layoutScroll && r.scroll && r !== r.root && (u(t.x, -r.scroll.offset.x), u(t.y, -r.scroll.offset.y)), o && (e.x *= o.x.scale, e.y *= o.y.scale, l(t, o)), n && (0, s.HD)(r.latestValues) && p(t, r.latestValues, r.layout?.layoutBox));
    }
    e.x < 1.0000000000001 && e.x > .999999999999 && (e.x = 1), e.y < 1.0000000000001 && e.y > .999999999999 && (e.y = 1);
  }
}
function u(t, e) {
  t.min += e, t.max += e;
}
function d(t, e, i, s, r = .5) {
  let o = (0, n.k)(t.min, t.max, r);
  a(t, e, i, o, s);
}
function c(t, e) {
  return "string" == typeof t ? parseFloat(t) / 100 * (e.max - e.min) : t;
}
function p(t, e, i) {
  let n = i ?? t;
  d(t.x, c(e.x, n.x), e.scaleX, e.scale, e.originX), d(t.y, c(e.y, n.y), e.scaleY, e.scale, e.originY);
}
