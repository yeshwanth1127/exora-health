/** One pending destination, shared by all mounted dirty forms. No draft data is stored. */
export class LeaveState {
  private guards = new Map<symbol, boolean>();
  private listeners = new Set<() => void>();
  private accepting = false;
  private pending: (() => void) | null = null;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly isPending = () => this.pending !== null;
  readonly isBlocked = () => [...this.guards.values()].some(Boolean);
  readonly isDirty = () => this.guards.size > 0;
  private notify() {
    this.listeners.forEach((listener) => listener());
  }
  register(blocked = false) {
    const id = Symbol();
    this.guards.set(id, blocked);
    this.notify();
    return () => {
      this.guards.delete(id);
      this.notify();
    };
  }
  request(action: () => void) {
    // Do not replace a destination while its decision is still open.
    if (this.pending) return;
    if (!this.isDirty() || (this.accepting && !this.isBlocked())) {
      action();
      return;
    }
    this.pending = action;
    this.notify();
  }
  stay = () => {
    this.pending = null;
    this.notify();
  };
  discard = () => {
    if (this.isBlocked()) return;
    const action = this.pending;
    this.pending = null;
    this.notify();
    this.accepting = true;
    try {
      action?.();
    } finally {
      this.accepting = false;
    }
  };
}
