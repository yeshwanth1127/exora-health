// Canvas engine for the hex rank terrain. Adapted from Arc's activity terrain (same spring presets, intro, hover lift,
// fly-to camera, floating panel and offscreen pausing), drawing hexagonal columns instead of a 7 by 24 grid.

export type TerrainCell = { x: number; z: number; q: number; r: number };
export type TerrainTile = { rgb: readonly number[]; norm: number };
export type TerrainHandle = {
  setTiles(tiles: TerrainTile[], from: number | null): void;
  setFocus(index: number | null): void;
  setActive(index: number | null): void;
  zoom(factor: number): void;
  reset(): void;
  destroy(): void;
};
type Events = { onHover(index: number | null): void; onPick(index: number | null): void };

type Spring = { k: number; c: number };
const spring = (visualDuration: number, bounce: number): Spring => {
  const w = (2 * Math.PI) / (1.2 * visualDuration), k = w * w;
  return { k, c: 2 * Math.min(1, Math.max(0.05, 1 - bounce)) * Math.sqrt(k) };
};
// Arc's activity terrain presets.
const S = { rise: spring(0.7, 0.24), morph: spring(0.42, 0.16), camera: spring(0.9, 0), intro: spring(1.7, 0), zoom: spring(0.36, 0), lift: spring(0.26, 0.12), dim: spring(0.24, 0), tone: spring(0.5, 0), panel: spring(0.2, 0) };
type Value = { x: number; v: number; to: number; cfg: Spring; eps: number };
const value = (x: number, cfg: Spring, eps = 1e-3): Value => ({ x, v: 0, to: x, cfg, eps });
const aim = (s: Value, to: number, cfg: Spring, snap: boolean) => { s.to = to; s.cfg = cfg; if (snap) { s.x = to; s.v = 0; } };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rgb = (c: number[], a = 1) => a >= 1 ? `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0})` : `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0} / ${a.toFixed(3)})`;
const hexDistance = (a: TerrainCell, b: TerrainCell) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

const DEG = Math.PI / 180, DIST = 60, MAX_HEIGHT = 3.4, MIN_HEIGHT = 0.06;
const OVERVIEW = { yaw: 0, pitch: 90 * DEG, zoom: 1 };
const INTRO = { yaw: -20 * DEG, pitch: 58 * DEG, zoom: 0.86 };
const FOCUS = { yaw: -22 * DEG, narrowYaw: -30 * DEG, pitch: 50 * DEG, zoom: 1.8, narrowZoom: 2.2 };
const SIDES = Array.from({ length: 6 }, (_, k) => { const a = (60 + 60 * k) * DEG; return [Math.cos(a), Math.sin(a)]; });
const CORNERS = Array.from({ length: 6 }, (_, k) => { const a = (30 + 60 * k) * DEG; return [Math.cos(a), Math.sin(a)]; });
const LIGHT = (() => { const l = Math.hypot(-0.5, -0.85); return [-0.5 / l, -0.85 / l]; })();

export function createTerrain({ plot, canvas, panel }: { plot: HTMLElement; canvas: HTMLCanvasElement; panel: HTMLElement }, cells: TerrainCell[], first: TerrainTile[], home: number, spacing: number, events: Events): TerrainHandle {
  const ctx = canvas.getContext("2d")!;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let still = motion.matches, width = 0, height = 0, ratio = 1, narrow = false, visible = false, started = false, frame = 0, last = 0;
  let hover = -1, active: number | null = null, focus: number | null = null, panelShown = false;
  const n = cells.length, radius = spacing / Math.sqrt(3) * 0.9;
  const sceneRadius = Math.max(...cells.map(c => Math.hypot(c.x, c.z))) + radius;
  const maxRing = Math.max(1, ...cells.map(c => Math.hypot(c.x, c.z)));
  let tiles = first;

  // Per cell: height (N, V toward A after delay T), appear, colour mix, hover lift (F toward E) and dim (Z toward Y).
  const N = new Float64Array(n), V = new Float64Array(n), A = Float64Array.from(first, t => t.norm), T = new Float64Array(n);
  const P = new Float64Array(n), PV = new Float64Array(n);
  const M = new Float64Array(n).fill(1), MV = new Float64Array(n);
  const F = new Float64Array(n), FV = new Float64Array(n), E = new Float64Array(n);
  const Z = new Float64Array(n), ZV = new Float64Array(n), Y = new Float64Array(n);
  const from = first.map(t => [...t.rgb]), to = first.map(t => [...t.rgb]);
  let rise = S.rise;

  const yaw = value(INTRO.yaw, S.camera, 1e-4), pitch = value(INTRO.pitch, S.camera, 1e-4), zoom = value(INTRO.zoom, S.camera, 1e-4);
  const tx = value(0, S.camera), tz = value(0, S.camera), flat = value(1, S.camera), px = value(0, S.panel, 0.05), py = value(0, S.panel, 0.05);
  const camera = [yaw, pitch, zoom, tx, tz, flat, px, py];

  let surface = [255, 255, 255], ink = [20, 20, 20], font = "sans-serif";
  function readTheme() {
    const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const read = (name: string, fallback: number[]) => {
      const css = getComputedStyle(plot).getPropertyValue(name).trim();
      if (!probe || !css) return fallback;
      probe.fillStyle = "#000"; probe.fillStyle = css; probe.fillRect(0, 0, 1, 1);
      return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    surface = read("--surface", surface); ink = read("--foreground", ink); font = getComputedStyle(plot).fontFamily || font;
  }

  // Camera orbiting the target point; y is up, z points south so north sits at the top in the overview.
  const view = { cx: 0, cy: 0, cz: 0, rx: 1, rz: 0, ux: 0, uy: 0, uz: -1, fx: 0, fy: -1, fz: 0, focal: 1 };
  function project(x: number, y: number, z: number, out: number[], at: number) {
    const dx = x - view.cx, dy = y - view.cy, dz = z - view.cz;
    const depth = Math.max(0.5, dx * view.fx + dy * view.fy + dz * view.fz), s = view.focal / depth;
    out[at] = width / 2 + (dx * view.rx + dz * view.rz) * s;
    out[at + 1] = height / 2 - (dx * view.ux + dy * view.uy + dz * view.uz) * s;
    return depth;
  }

  const order = cells.map((_, i) => i), depth = new Float64Array(n);
  const hits: number[][][] = cells.map(() => []);
  const tops: number[][] = cells.map(() => []);
  const anchor = new Float64Array(2 * n);
  function draw() {
    if (!width || !height) return;
    const sy = Math.sin(yaw.x), cy = Math.cos(yaw.x), sp = Math.sin(pitch.x), cp = Math.cos(pitch.x);
    Object.assign(view, {
      cx: tx.x + DIST * sy * cp, cy: DIST * sp, cz: tz.x + DIST * cy * cp,
      rx: cy, rz: -sy, ux: -sy * sp, uy: cp, uz: -cy * sp, fx: -sy * cp, fy: -sp, fz: -cy * cp,
      focal: Math.min((width / 2 - 16) / sceneRadius, (height / 2 - 16) / sceneRadius) * DIST * zoom.x,
    });
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < n; i++) depth[i] = (cells[i].x - view.cx) ** 2 + (cells[i].z - view.cz) ** 2 + view.cy ** 2;
    order.sort((a, b) => depth[b] - depth[a]);
    const flatness = clamp(flat.x, 0, 1), relief = 1 - 0.975 * flatness, pt = [0, 0];
    const outlined = hover >= 0 ? hover : active;
    for (const i of order) {
      const c = cells[i], appear = clamp(P[i], 0, 1.2);
      const scale = (0.35 + 0.65 * Math.min(appear, 1.08)) * (1 + 0.08 * F[i] * flatness);
      const base = 0.5 * F[i] * (1 - flatness), top = base + (MIN_HEIGHT + MAX_HEIGHT * Math.max(N[i], 0)) * relief * Math.min(appear, 1);
      const alpha = clamp(appear * 1.6, 0, 1);
      const mix = clamp(M[i], 0, 1), tone = [0, 1, 2].map(k => lerp(lerp(from[i][k], to[i][k], mix), surface[k], 0.72 * clamp(Z[i], 0, 1)));
      const upper: number[] = [], lower: number[] = [];
      for (const [cx, cz] of CORNERS) {
        project(c.x + cx * radius * scale, top, c.z + cz * radius * scale, pt, 0); upper.push(pt[0], pt[1]);
        project(c.x + cx * radius * scale, base, c.z + cz * radius * scale, pt, 0); lower.push(pt[0], pt[1]);
      }
      hits[i] = [upper];
      ctx.lineWidth = 0.6; ctx.lineJoin = "round";
      if (top - base > 0.02) {
        for (let k = 0; k < 6; k++) {
          const [nx, nz] = SIDES[k], mx = c.x + nx * radius * scale * 0.87, mz = c.z + nz * radius * scale * 0.87;
          if (nx * (view.cx - mx) + nz * (view.cz - mz) <= 0) continue;
          const shade = 0.1 + 0.24 * (1 - (nx * LIGHT[0] + nz * LIGHT[1])) / 2, j = (k + 1) % 6;
          const face = [upper[2 * k], upper[2 * k + 1], upper[2 * j], upper[2 * j + 1], lower[2 * j], lower[2 * j + 1], lower[2 * k], lower[2 * k + 1]];
          ctx.fillStyle = ctx.strokeStyle = rgb(tone.map(v => v * (1 - shade)), alpha);
          polygon(face); ctx.fill(); ctx.stroke(); hits[i].push(face);
        }
      }
      ctx.fillStyle = ctx.strokeStyle = rgb(tone, alpha);
      polygon(upper); ctx.fill(); ctx.stroke();
      tops[i] = upper;
      project(c.x, top, c.z, pt, 0); anchor[2 * i] = pt[0]; anchor[2 * i + 1] = pt[1];
      if (i === home) {
        ctx.fillStyle = rgb(surface); ctx.beginPath(); ctx.arc(pt[0], pt[1], 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgb(ink); ctx.beginPath(); ctx.arc(pt[0], pt[1], 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (focus !== null && focus !== outlined) outline(focus, 0.5, true);
    if (outlined !== null && outlined >= 0) outline(outlined, 0.9, false);
    placePanel(outlined !== null && outlined >= 0 ? outlined : focus);
  }
  function polygon(points: number[]) {
    ctx.beginPath(); ctx.moveTo(points[0], points[1]);
    for (let k = 2; k < points.length; k += 2) ctx.lineTo(points[k], points[k + 1]);
    ctx.closePath();
  }
  function outline(i: number, alpha: number, dashed: boolean) {
    ctx.strokeStyle = rgb(ink, alpha); ctx.lineWidth = 1.25; ctx.setLineDash(dashed ? [3, 3] : []);
    polygon(tops[i]); ctx.stroke(); ctx.setLineDash([]);
  }
  function placePanel(i: number | null) {
    if (i === null) { panelShown = false; return; }
    const w = panel.offsetWidth || 232, h = panel.offsetHeight || 150, ax = anchor[2 * i], ay = anchor[2 * i + 1];
    let x = ax + 22; if (x + w > width - 8) x = ax - 22 - w; x = clamp(x, 8, Math.max(8, width - w - 8));
    let y = ay - h - 16; if (y < 8) y = ay - 0.45 * h; y = clamp(y, 8, Math.max(8, height - h - 8));
    px.to = x; py.to = y;
    if (!panelShown || still) { px.x = x; py.x = y; px.v = py.v = 0; panelShown = true; } else if (Math.abs(px.x - x) > 0.05 || Math.abs(py.x - y) > 0.05) wake();
    panel.style.transform = `translate3d(${px.x.toFixed(2)}px, ${py.x.toFixed(2)}px, 0)`;
  }

  function step(dt: number) {
    let moving = false;
    for (let i = 0; i < n; i++) if (T[i] > 0) { T[i] -= dt; moving = true; }
    const count = Math.max(1, Math.ceil(dt * 240)), h = dt / count;
    for (let s = 0; s < count; s++) {
      for (const c of camera) { c.v += (-c.cfg.k * (c.x - c.to) - c.cfg.c * c.v) * h; c.x += c.v * h; }
      for (let i = 0; i < n; i++) {
        if (T[i] <= 0) {
          V[i] += (-rise.k * (N[i] - A[i]) - rise.c * V[i]) * h; N[i] += V[i] * h;
          PV[i] += (-S.rise.k * (P[i] - 1) - S.rise.c * PV[i]) * h; P[i] += PV[i] * h;
          MV[i] += (-S.tone.k * (M[i] - 1) - S.tone.c * MV[i]) * h; M[i] += MV[i] * h;
        }
        FV[i] += (-S.lift.k * (F[i] - E[i]) - S.lift.c * FV[i]) * h; F[i] += FV[i] * h;
        ZV[i] += (-S.dim.k * (Z[i] - Y[i]) - S.dim.c * ZV[i]) * h; Z[i] += ZV[i] * h;
      }
    }
    for (const c of camera) { if (Math.abs(c.x - c.to) < c.eps && Math.abs(c.v) < 10 * c.eps) { c.x = c.to; c.v = 0; } else moving = true; }
    const settle = (x: Float64Array, v: Float64Array, target: (i: number) => number) => {
      for (let i = 0; i < n; i++) { if (Math.abs(x[i] - target(i)) < 1e-4 && Math.abs(v[i]) < 1e-3) { x[i] = target(i); v[i] = 0; } else moving = true; }
    };
    if (started) { settle(N, V, i => A[i]); settle(P, PV, () => 1); settle(M, MV, () => 1); }
    settle(F, FV, i => E[i]); settle(Z, ZV, i => Y[i]);
    return moving;
  }
  function tick(now: number) {
    frame = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    const moving = step(dt); draw();
    // draw() may already have queued the next frame through placePanel's wake().
    if (moving && !frame && visible && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function wake() { if (frame || !visible || document.hidden) return; last = performance.now(); frame = requestAnimationFrame(tick); }

  function start() {
    if (started) return;
    started = true;
    for (let i = 0; i < n; i++) {
      const delay = 0.8 * Math.hypot(cells[i].x, cells[i].z) / maxRing * 0.6;
      if (still) { N[i] = A[i]; P[i] = 1; T[i] = 0; } else T[i] = delay;
    }
    const cfg = still ? S.camera : S.intro;
    aim(yaw, OVERVIEW.yaw, cfg, still); aim(pitch, OVERVIEW.pitch, cfg, still); aim(zoom, OVERVIEW.zoom, cfg, still);
    wake();
  }
  function highlight() {
    const lit = hover >= 0 ? hover : active;
    for (let i = 0; i < n; i++) {
      Y[i] = focus !== null && hexDistance(cells[i], cells[focus]) > 1 ? 0.36 : 0;
      E[i] = i === lit || i === focus ? 1 : 0;
      if (still) { Z[i] = Y[i]; F[i] = E[i]; ZV[i] = FV[i] = 0; }
    }
    wake();
  }

  // Pointer: hover to inspect, click or tap to fly in, click empty space to come back out.
  let press: { x: number; y: number; id: number } | null = null;
  const local = (event: PointerEvent) => { const box = plot.getBoundingClientRect(); return { x: event.clientX - box.left, y: event.clientY - box.top }; };
  function hit(x: number, y: number) {
    for (let o = n - 1; o >= 0; o--) {
      const i = order[o];
      for (const face of hits[i]) {
        let pos = 0, neg = 0;
        for (let k = 0; k < face.length; k += 2) {
          const ax = face[k], ay = face[k + 1], bx = face[(k + 2) % face.length], by = face[(k + 3) % face.length];
          const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
          if (cross > 0) pos++; else if (cross < 0) neg++;
        }
        if (!pos || !neg) return i;
      }
    }
    return -1;
  }
  function setHover(i: number) {
    if (i === hover) return;
    hover = i; plot.toggleAttribute("data-over", i >= 0); highlight(); events.onHover(i < 0 ? null : i);
  }
  const down = (event: PointerEvent) => { if (event.pointerType === "mouse" && event.button !== 0) return; start(); const at = local(event); press = { ...at, id: event.pointerId }; };
  const move = (event: PointerEvent) => { if (event.pointerType === "mouse" && !press) { const at = local(event); setHover(hit(at.x, at.y)); } };
  const up = (event: PointerEvent) => {
    if (!press || press.id !== event.pointerId) return;
    const at = local(event), moved = Math.hypot(at.x - press.x, at.y - press.y) > (event.pointerType === "touch" ? 8 : 4);
    press = null;
    if (moved) return;
    const i = hit(at.x, at.y);
    if (event.pointerType === "mouse") setHover(i);
    events.onPick(i < 0 ? null : i);
  };
  const leave = (event: PointerEvent) => { if (event.pointerType === "mouse") setHover(-1); };

  const resize = new ResizeObserver(() => {
    const box = plot.getBoundingClientRect();
    width = box.width; height = box.height; ratio = Math.min(2, window.devicePixelRatio || 1); narrow = width < 560;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    draw();
  });
  const seen = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && entry.intersectionRatio >= 0.3) start();
    if (visible) wake();
  }, { threshold: [0, 0.3, 0.6] });
  const theme = new MutationObserver(() => { readTheme(); draw(); });
  const onMotion = () => { still = motion.matches; if (still) { start(); highlight(); } };
  const onVisibility = () => { if (!document.hidden) wake(); };

  readTheme();
  resize.observe(plot); seen.observe(plot);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
  motion.addEventListener("change", onMotion);
  document.addEventListener("visibilitychange", onVisibility);
  plot.addEventListener("pointerdown", down); plot.addEventListener("pointermove", move);
  plot.addEventListener("pointerup", up); plot.addEventListener("pointercancel", () => { press = null; }); plot.addEventListener("pointerleave", leave);
  if (still) { aim(yaw, OVERVIEW.yaw, S.camera, true); aim(pitch, OVERVIEW.pitch, S.camera, true); aim(zoom, 1, S.camera, true); start(); }

  return {
    setTiles(next, origin) {
      tiles = next; rise = S.morph;
      const centre = cells[origin ?? home], reach = Math.max(1, ...cells.map(c => Math.hypot(c.x - centre.x, c.z - centre.z)));
      for (let i = 0; i < n; i++) {
        const mix = clamp(M[i], 0, 1);
        from[i] = [0, 1, 2].map(k => lerp(from[i][k], to[i][k], mix)); to[i] = [...next[i].rgb]; A[i] = next[i].norm;
        if (still || !started) { from[i] = [...to[i]]; M[i] = 1; N[i] = started ? A[i] : N[i]; continue; }
        M[i] = 0; MV[i] = 0; T[i] = Math.hypot(cells[i].x - centre.x, cells[i].z - centre.z) / reach * 0.36;
      }
      wake();
    },
    setFocus(index) {
      focus = index; start();
      if (index !== null) {
        const c = cells[index];
        aim(tx, c.x, S.camera, still); aim(tz, c.z, S.camera, still); aim(flat, 0, S.camera, still);
        aim(yaw, narrow ? FOCUS.narrowYaw : FOCUS.yaw, S.camera, still); aim(pitch, FOCUS.pitch, S.camera, still);
        aim(zoom, Math.max(zoom.to, narrow ? FOCUS.narrowZoom : FOCUS.zoom), S.camera, still);
      } else {
        aim(tx, 0, S.camera, still); aim(tz, 0, S.camera, still); aim(flat, 1, S.camera, still);
        aim(yaw, OVERVIEW.yaw, S.camera, still); aim(pitch, OVERVIEW.pitch, S.camera, still); aim(zoom, 1, S.camera, still);
      }
      highlight();
    },
    setActive(index) { active = index; if (index === null) hover = -1; highlight(); },
    zoom(factor) { start(); aim(zoom, clamp(zoom.to * factor, 0.8, 4), S.zoom, still); wake(); },
    reset() { this.setFocus(null); },
    destroy() {
      cancelAnimationFrame(frame); resize.disconnect(); seen.disconnect(); theme.disconnect();
      motion.removeEventListener("change", onMotion); document.removeEventListener("visibilitychange", onVisibility);
      plot.removeEventListener("pointerdown", down); plot.removeEventListener("pointermove", move);
      plot.removeEventListener("pointerup", up); plot.removeEventListener("pointerleave", leave);
    },
  };
}
