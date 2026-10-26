// Reconstructed from public browser-delivered JavaScript; original TSX not recovered.
const interop = require("../interop.cjs");
let r;
Object.defineProperty(exports, "__esModule", {
  value: !0
});
var n = {
  getAssetToken: function () {
    return o;
  },
  getAssetTokenQuery: function () {
    return i;
  },
  getDeploymentId: function () {
    return u;
  },
  getDeploymentIdQuery: function () {
    return l;
  }
};
for (var a in n) Object.defineProperty(exports, a, {
  enumerable: !0,
  get: n[a]
});
function u() {
  return r;
}
function l(e = !1) {
  return r ? `${e ? "&" : "?"}dpl=${r}` : "";
}
function o() {
  return !1;
}
function i(e = !1) {
  return "";
}
r = document.documentElement.dataset.dplId, delete document.documentElement.dataset.dplId;
