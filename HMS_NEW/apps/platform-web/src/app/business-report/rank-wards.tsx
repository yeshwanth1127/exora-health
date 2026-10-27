"use client";
// Ward choropleth adapted from Arc's choropleth explorer: stepped fills that sweep west to east, a legend whose steps
// light their regions, a ranked list synced with the map both ways, and a spring camera that zooms into one area.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowLeft, ChevronRight } from "lucide-react";

export type WardShape = { name: string; path: string };
type Step = { label: string; fill: string; count: number };
type Props = {
  mapImage?:string; viewBox: [number, number]; home: [number, number]; noun: string; label: string;
  shapes: WardShape[]; fills: string[]; bins: number[]; values: string[]; norms: number[]; order: number[];
  legend: Step[]; legendNote: string; listMeta: string;
  summary: ReactNode; openSummary(i: number): ReactNode; card(i: number): ReactNode; detail(i: number): ReactNode;
};
const CAMERA = { type: "spring", visualDuration: 0.62, bounce: 0 } as const;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function RankWards({ mapImage, viewBox: [width, height], home, noun, label, shapes, fills, bins, values, norms, order, legend, legendNote, listMeta, summary, openSummary, card, detail }: Props) {
  const still = useReducedMotion();
  const [hover, setHover] = useState<{ i: number; source: "map" | "list" } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [bin, setBin] = useState<number | null>(null), [pinned, setPinned] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
  const [tip, setTip] = useState(false), [tipAt, setTipAt] = useState<number | null>(null);
  const [live, setLive] = useState("");
  const camera = useRef<SVGGElement>(null), marker = useRef<SVGCircleElement>(null), frame = useRef<HTMLDivElement>(null), tipRef = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null), rows = useRef<(HTMLButtonElement | null)[]>([]), paths = useRef<(SVGPathElement | null)[]>([]);
  const x = useMotionValue(0), y = useMotionValue(0), s = useMotionValue(1);
  const waves = useMemo(() => shapes.map(shape => Number(shape.path.slice(1, shape.path.indexOf(" "))) / width), [shapes, width]);
  const lit = pinned ?? bin;

  useEffect(() => {
    const write = () => {
      camera.current?.setAttribute("transform", `translate(${x.get()} ${y.get()}) scale(${s.get()})`);
      marker.current?.setAttribute("r", String(5 / s.get()));
      marker.current?.setAttribute("stroke-width", String(2.5 / s.get()));
    };
    const stop = [x.on("change", write), y.on("change", write), s.on("change", write)];
    return () => stop.forEach(off => off());
  }, [x, y, s]);
  useEffect(() => {
    let target = { x: 0, y: 0, s: 1 };
    const box = open === null ? null : paths.current[open]?.getBBox();
    if (box && box.width > 0 && box.height > 0) {
      // A gentle zoom: the area fills about half the map and its neighbours stay readable as context.
      const scale = clamp(Math.min(0.5 * width / box.width, 0.5 * height / box.height), 1, 2.5);
      target = { x: width / 2 - (box.x + box.width / 2) * scale, y: height / 2 - (box.y + box.height / 2) * scale, s: scale };
    }
    const options = still ? { duration: 0 } : CAMERA;
    const runs = [animate(x, target.x, options), animate(y, target.y, options), animate(s, target.s, options)];
    return () => runs.forEach(run => run.stop());
  }, [open, width, height, still, x, y, s]);

  function zoom(i: number | null) {
    setOpen(i); setHover(null); setPinned(null); setBin(null); setTip(false);
    setLive(i === null ? `Showing all ${shapes.length} ${noun}.` : `${shapes[i].name}. ${values[i].startsWith("#") ? `Position ${values[i]}` : values[i]}. Press Escape to zoom out.`);
  }
  function moveTip(clientX: number, clientY: number) {
    const box = frame.current?.getBoundingClientRect(), el = tipRef.current;
    if (!box || !el) return;
    const w = el.offsetWidth, h = el.offsetHeight, mx = clientX - box.left, my = clientY - box.top;
    el.style.transform = `translate3d(${mx + 16 + w > box.width ? Math.max(0, mx - 16 - w) : mx + 16}px, ${clamp(my - h / 2, 0, Math.max(0, box.height - h))}px, 0)`;
  }
  const wardAt = (target: EventTarget | null) => { const el = (target as Element | null)?.closest?.("[data-i]"); return el ? Number(el.getAttribute("data-i")) : null; };
  const fine = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function focusRow(position: number) {
    const next = clamp(position, 0, order.length - 1), button = rows.current[next], box = scroller.current;
    setCursor(next); setHover({ i: order[next], source: "list" }); button?.focus({ preventScroll: true });
    if (button && box) {
      const top = button.offsetTop - box.offsetTop, bottom = top + button.offsetHeight;
      if (top < box.scrollTop) box.scrollTop = top - 4; else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 4;
    }
  }
  const listKeys = (event: KeyboardEvent) => {
    const step: Record<string, number> = { ArrowDown: cursor + 1, ArrowUp: cursor - 1, Home: 0, End: order.length - 1 };
    if (event.key in step) { event.preventDefault(); focusRow(step[event.key]); }
  };
  // Escape releases a pinned legend step, then zooms out, wherever focus is.
  const escape = useRef<(event: globalThis.KeyboardEvent) => void>(() => {});
  escape.current = event => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (pinned !== null) { setPinned(null); setLive(`Showing every area.`); } else if (open !== null) zoom(null); else return;
    event.preventDefault();
  };
  useEffect(() => {
    if (open === null && pinned === null) return;
    const onKey = (event: globalThis.KeyboardEvent) => escape.current(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pinned]);
  // The list swaps for the detail panel: keep focus on the back button, then return it to the area's row.
  const back = useRef<HTMLButtonElement>(null), wasOpen = useRef<number | null>(null);
  useEffect(() => {
    const inside = (el: Element | null) => !el || el === document.body || !!el.closest(".rank-wards");
    if (open !== null && inside(document.activeElement)) back.current?.focus({ preventScroll: true });
    else if (open === null && wasOpen.current !== null && inside(document.activeElement)) { const position = order.indexOf(wasOpen.current); if (position >= 0) { setCursor(position); rows.current[position]?.focus({ preventScroll: true }); } }
    wasOpen.current = open;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // The hovered row follows the map without scrolling the page.
  useEffect(() => {
    if (hover?.source !== "map") return;
    const position = order.indexOf(hover.i), button = rows.current[position], box = scroller.current;
    if (!button || !box) return;
    const top = button.offsetTop - box.offsetTop, bottom = top + button.offsetHeight;
    if (top < box.scrollTop || bottom > box.scrollTop + box.clientHeight) box.scrollTop = top - box.clientHeight / 2 + button.offsetHeight / 2;
  }, [hover, order]);

  const outlined = hover && hover.i !== open ? hover.i : null;
  const ramp = legend.slice(1);
  return <div className="rank-wards">
    <div className="rank-wards-main">
      <div className="rank-wards-summary">
        {open === null ? summary : openSummary(open)}
        {open !== null && <button type="button" className="rank-wards-back" onClick={() => zoom(null)}><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />All {noun}</button>}
      </div>
      <div ref={frame} className="rank-wards-frame" style={{ aspectRatio: `${width} / ${height}` }} data-bin={lit ?? undefined} data-open={open === null ? undefined : ""}
        onPointerMove={event => { if (!fine()) return; const i = wardAt(event.target); setHover(i === null ? null : { i, source: "map" }); if (i !== null) setTipAt(i); setTip(i !== null && i !== open); moveTip(event.clientX, event.clientY); }}
        onPointerLeave={() => { setTip(false); setHover(current => current?.source === "map" ? null : current); }}
        onClick={event => { const i = wardAt(event.target); if (i === null) { if (open !== null) zoom(null); return; } zoom(i === open ? null : i); }}>
        <svg className="rank-wards-map" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
          <g ref={camera}>
            {mapImage && <image href={mapImage} x={0} y={0} width={width} height={height} />}
            <g className="rank-wards-area" data-enter="">
              {shapes.map((shape, i) => <path key={shape.name} ref={el => { paths.current[i] = el; }} data-i={i} d={shape.path} className="rank-wards-region"
                data-context={open !== null && open !== i ? "" : undefined} data-dim={lit !== null && bins[i] !== lit ? "" : undefined}
                style={{ "--fill": fills[i], "--wave": waves[i] } as CSSProperties} />)}
            </g>
            {outlined !== null && <path className="rank-wards-outline" d={shapes[outlined].path} aria-hidden="true" />}
            {open !== null && <path className="rank-wards-pinned" d={shapes[open].path} aria-hidden="true" />}
            <circle ref={marker} cx={home[0]} cy={home[1]} r={5} className="rank-wards-home" aria-hidden="true" />
          </g>
        </svg>
        {mapImage && <div className="rank-wards-google-credit" aria-label="Google Maps attribution"><div style={{aspectRatio:`${width} / ${height}`,backgroundImage:`url("${mapImage}")`}} /></div>}
        <div ref={tipRef} className="rank-wards-tip" data-on={tip && hover?.source === "map" ? "" : undefined} aria-hidden="true">{tipAt !== null && card(tipAt)}</div>
      </div>
      <div className="rank-wards-legend">
        <div className="rank-wards-steps">
          <div className="rank-wards-ramp" style={{ "--bins": ramp.length } as CSSProperties}>
            {ramp.map((step, k) => <button key={step.label} type="button" className="rank-wards-step" aria-pressed={pinned === k + 1} data-active={bin === k + 1 ? "" : undefined}
              aria-label={`${step.count} ${noun} ranked ${step.label}`} onPointerEnter={() => setBin(k + 1)} onPointerLeave={() => setBin(null)} onFocus={() => setBin(k + 1)} onBlur={() => setBin(null)}
              onClick={() => setPinned(pinned === k + 1 ? null : k + 1)}><i className="rank-wards-swatch" style={{ "--fill": step.fill } as CSSProperties} /></button>)}
            <div className="rank-wards-ticks" aria-hidden="true">{ramp.map((step, k) => <span key={step.label} style={{ left: `${(k + 0.5) / ramp.length * 100}%` }}>{step.label} <b>{step.count}</b></span>)}</div>
          </div>
          <button type="button" className="rank-wards-step rank-wards-none" aria-pressed={pinned === 0} data-active={bin === 0 ? "" : undefined} aria-label={`${legend[0].count} ${noun} ${legend[0].label.toLowerCase()}`}
            onPointerEnter={() => setBin(0)} onPointerLeave={() => setBin(null)} onFocus={() => setBin(0)} onBlur={() => setBin(null)} onClick={() => setPinned(pinned === 0 ? null : 0)}>
            <i className="rank-wards-swatch" style={{ "--fill": legend[0].fill } as CSSProperties} /><span className="rank-wards-none-label">{legend[0].label} <b>{legend[0].count}</b></span>
          </button>
        </div>
        <p className="rank-wards-note">{legendNote}</p>
      </div>
    </div>
    <div className="rank-wards-side">
      {open === null ? <>
        <div className="rank-wards-side-head"><h3>{shapes.length} {noun}</h3><span>{listMeta}</span></div>
        <div ref={scroller} className="rank-wards-scroller">
          <ol className="rank-wards-list" onKeyDown={listKeys}>
            {order.map((i, position) => <li key={shapes[i].name} className="rank-wards-item" data-dim={lit !== null && bins[i] !== lit ? "" : undefined}>
              <button ref={el => { rows.current[position] = el; }} type="button" className="rank-wards-row" tabIndex={position === cursor ? 0 : -1} data-on={hover?.i === i ? "" : undefined}
                aria-label={`${position + 1}. ${shapes[i].name}, ${values[i].startsWith("#") ? `position ${values[i]}` : values[i]}. Zoom in.`}
                onPointerEnter={() => fine() && setHover({ i, source: "list" })} onPointerLeave={() => setHover(current => current?.source === "list" ? null : current)}
                onFocus={() => { setCursor(position); setHover({ i, source: "list" }); }} onBlur={() => setHover(current => current?.source === "list" ? null : current)} onClick={() => zoom(i)}>
                <span className="rank-wards-rank">{position + 1}</span>
                <span className="rank-wards-name">{shapes[i].name}</span>
                <span className="rank-wards-value">{values[i]}</span>
                <span className="rank-wards-bar"><i style={{ transform: `scaleX(${norms[i]})`, background: fills[i] }} /></span>
                <ChevronRight className="rank-wards-chevron" size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>)}
          </ol>
        </div>
      </> : <div className="rank-wards-detail">
        {detail(open)}
        <button ref={back} type="button" className="rank-wards-back" onClick={() => zoom(null)}><ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />Back to all {noun}</button>
      </div>}
    </div>
    <p className="rank-terrain-sr" aria-live="polite">{live}</p>
  </div>;
}
