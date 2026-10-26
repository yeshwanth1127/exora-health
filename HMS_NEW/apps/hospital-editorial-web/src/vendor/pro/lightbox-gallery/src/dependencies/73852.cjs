// Reconstructed from captured browser-delivered JavaScript; original TSX was not recovered.
const interop = require("../interop.cjs");
interop.d(exports, {
  v: () => s
});
var n = require("./78170.cjs");
class s {
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
    let n = this.subscriptions.length;
    if (n) if (1 === n) this.subscriptions[0](t, e, i);else for (let s = 0; s < n; s++) {
      let n = this.subscriptions[s];
      n && n(t, e, i);
    }
  }
  getSize() {
    return this.subscriptions.length;
  }
  clear() {
    this.subscriptions.length = 0;
  }
}
