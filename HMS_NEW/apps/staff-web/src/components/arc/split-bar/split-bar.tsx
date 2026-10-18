// Port of the local Arc Pro "split-bar" reference (components/pro/split-bar/src/SplitBarDemo.cjs).
// Behaviour, motion and markup follow the reconstructed source; only the demo's sample segments are removed.
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { motionTokens as T } from "../motion-tokens";
import styles from "./split-bar.module.css";

export type SplitSegment = { id: string; label: string; value: number; color?: string };
export type SplitBarProps = {
  segments: readonly SplitSegment[];
  title?: string;
  description?: string;
  format?: Intl.NumberFormatOptions;
  unit?: string;
  totalLabel?: string;
  hidden?: readonly string[];
  defaultHidden?: readonly string[];
  onHiddenChange?: (hidden: string[]) => void;
  legend?: boolean;
  locale?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
};

type Mode = "full" | "short" | "outside" | "none";
type Slice = { id: string; start: number; end: number; share: number; on: boolean; mode: Mode };
type Measure = (text: string) => number;

const PALETTE = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--text-muted)", "var(--border-strong)"];
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const css = (vars: Record<string, string>) => vars as CSSProperties;

function Glyph({ position, digit }: { position: MotionValue<number>; digit: number }) {
  const offset = useTransform(position, (p) => (((digit - p) % 10) + 15) % 10 - 5);
  const y = useTransform(offset, (o) => `${o}em`);
  const opacity = useTransform(offset, (o) => Math.max(0, 1 - 1.2 * Math.abs(o)));
  return <motion.span className={styles.glyph} style={{ y, opacity }}>{digit}</motion.span>;
}

function Wheel({ digit, direction, reduceMotion }: { digit: number; direction: number; reduceMotion: boolean }) {
  const position = useMotionValue(digit);
  const state = useRef({ digit, target: digit });
  useEffect(() => {
    const s = state.current;
    if (s.digit === digit) return;
    s.target += direction < 0 ? -((s.digit - digit + 10) % 10) : (digit - s.digit + 10) % 10;
    s.digit = digit;
    if (reduceMotion) return void position.jump(s.target);
    const controls = animate(position, s.target, T.spring.smooth);
    return () => controls.stop();
  }, [digit, direction, position, reduceMotion]);
  return (
    <span className={styles.wheel}>
      <span className={styles.sizer}>0</span>
      {DIGITS.map((d) => <Glyph key={d} position={position} digit={d} />)}
    </span>
  );
}

const reveal = { initial: { width: 0, opacity: 0 }, animate: { width: "auto", opacity: 1 }, exit: { width: 0, opacity: 0 } };

function RollingNumber({ value, formatter, reduceMotion }: { value: number; formatter: Intl.NumberFormat; reduceMotion: boolean }) {
  const [last, setLast] = useState({ value, direction: 1 });
  if (last.value !== value) setLast({ value, direction: value >= last.value ? 1 : -1 });
  const transition = reduceMotion ? { duration: 0 } : T.spring.morph;
  const parts = formatter.formatToParts(value);
  let integer = parts.reduce((n, p) => n + (p.type === "integer" ? p.value.length : 0), 0);
  let fraction = 0;
  type Token = { key: string; digit: number } | { key: string; text: string };
  const tokens = parts.flatMap((p, i): Token[] =>
    p.type === "integer"
      ? [...p.value].map((d) => ({ key: `i${--integer}`, digit: Number(d) }))
      : p.type === "fraction"
        ? [...p.value].map((d) => ({ key: `f${fraction++}`, digit: Number(d) }))
        : [{ key: p.type === "group" ? `g${integer}` : p.type === "literal" ? `l${i}` : p.type, text: p.value }],
  );
  return (
    <span className={styles.number} aria-hidden="true">
      <AnimatePresence initial={false}>
        {tokens.map((t) =>
          "digit" in t ? (
            <motion.span key={t.key} className={styles.column} {...reveal} transition={transition}>
              <Wheel digit={t.digit} direction={last.direction} reduceMotion={reduceMotion} />
            </motion.span>
          ) : (
            <motion.span key={t.key} className={styles.symbol} {...reveal} transition={transition}>{t.text}</motion.span>
          ),
        )}
      </AnimatePresence>
    </span>
  );
}

function Segment({
  slice, color, width, active, dimmed, text, reduceMotion,
}: {
  slice: Slice; color: string; width: MotionValue<number>; active: boolean; dimmed: boolean;
  text: { name: string; share: number; formatter: Intl.NumberFormat }; reduceMotion: boolean;
}) {
  const start = useMotionValue(slice.start), end = useMotionValue(slice.end);
  useEffect(() => {
    if (reduceMotion) { start.jump(slice.start); end.jump(slice.end); return; }
    const a = animate(start, slice.start, T.spring.smooth), b = animate(end, slice.end, T.spring.smooth);
    return () => { a.stop(); b.stop(); };
  }, [end, reduceMotion, slice.end, slice.start, start]);
  const clipPath = useTransform([start, end, width], ([s = 0, e = 0, w = 0]: number[]) => {
    const left = Math.min(1, s * w), right = Math.min(1, (1 - e) * w);
    return `inset(0 calc(${((1 - e) * 100).toFixed(3)}% + ${right.toFixed(2)}px) 0 calc(${(100 * s).toFixed(3)}% + ${left.toFixed(2)}px) round 4px)`;
  });
  const capX = useTransform([end, width], ([e = 0, w = 0]: number[]) => e * w - 3 - Math.min(1, (1 - e) * w));
  const capOpacity = useTransform([start, end, width], ([s = 0, e = 0, w = 0]: number[]) => Math.max(0, Math.min(1, ((e - s) * w - 4) / 6)));
  const insideX = useTransform([start, width], ([s = 0, w = 0]: number[]) => s * w + 10);
  const showInside = slice.on && (slice.mode === "full" || slice.mode === "short");
  return (
    <motion.span
      className={styles.segment}
      data-active={active || undefined}
      data-dimmed={dimmed || undefined}
      style={{ clipPath, ...css({ "--seg": color }) }}
      aria-hidden="true"
    >
      <motion.span className={styles.cap} style={{ x: capX, opacity: capOpacity }} />
      <motion.span
        className={styles.inside}
        style={{ x: insideX }}
        initial={false}
        animate={{ opacity: +showInside }}
        transition={{ duration: reduceMotion ? 0 : T.duration.fast }}
      >
        <motion.span
          className={styles.insideName}
          initial={false}
          animate={{ opacity: +(slice.mode === "full"), width: slice.mode === "full" ? "auto" : 0, marginRight: 5 * +(slice.mode === "full") }}
          transition={reduceMotion ? { duration: 0 } : T.spring.morph}
        >
          {text.name}
        </motion.span>
        <RollingNumber value={text.share} formatter={text.formatter} reduceMotion={reduceMotion} />
      </motion.span>
    </motion.span>
  );
}

function useTextMeasure(probe: RefObject<HTMLSpanElement | null>): Measure {
  const [font, setFont] = useState("");
  useEffect(() => {
    const read = () => { if (probe.current) setFont(getComputedStyle(probe.current).font); };
    read();
    document.fonts?.ready.then(read).catch(() => {});
  }, [probe]);
  return useMemo(() => {
    const cache = new Map<string, number>();
    const ctx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
    if (ctx && font) ctx.font = font;
    return (text: string) => {
      const hit = cache.get(text);
      if (hit !== undefined) return hit;
      const w = ctx && font ? ctx.measureText(text).width : 7 * text.length;
      cache.set(text, w);
      return w;
    };
  }, [font]);
}

function layoutSlices(segments: readonly SplitSegment[], shares: Map<string, number>, focus: string | null, width: number, measure: Measure, percent: Intl.NumberFormat): Slice[] {
  const widths = new Map(shares);
  if (focus && width > 0) {
    const share = widths.get(focus) ?? 0;
    const seg = segments.find((s) => s.id === focus);
    const wanted = seg ? (measure(`${seg.label} ${percent.format(share)}`) + 30) / width : 0;
    const grown = Math.min(Math.max(share + 0.045, Math.min(wanted, 0.42)), 0.9);
    if (grown > share && share < 1) {
      const scale = (1 - grown) / (1 - share);
      for (const [id, v] of widths) widths.set(id, id === focus ? grown : v * scale);
    }
  }
  const ends = segments.reduce<number[]>((acc, s) => [...acc, (acc[acc.length - 1] ?? 0) + (widths.get(s.id) ?? 0)], []);
  return segments.map((s, i) => {
    const share = shares.get(s.id) ?? 0;
    const start = i ? ends[i - 1] ?? 0 : 0;
    const end = Math.min(1, ends[i] ?? 0);
    const px = (end - start) * width;
    const on = end - start > 0;
    const full = measure(`${s.label} ${percent.format(share)}`) + 30;
    const short = measure(percent.format(share)) + 26;
    return { id: s.id, start, end, share, on, mode: on ? (px >= full ? "full" : px >= short ? "short" : "outside") : "none" };
  });
}

type OutsideLabel = { id: string; name: string; anchor: number; width: number; x: number };
function layoutOutside(segments: readonly SplitSegment[], slices: Slice[], width: number, measure: Measure, percent: Intl.NumberFormat): OutsideLabel[] {
  const build = (named: boolean) =>
    slices.filter((s) => s.mode === "outside").map((s) => {
      const name = named ? segments.find((x) => x.id === s.id)?.label ?? "" : "";
      const share = percent.format(s.share);
      return { id: s.id, name, anchor: ((s.start + s.end) / 2) * width, width: measure(name ? `${name} ${share}` : share) + 6, x: 0 };
    });
  let labels = build(true);
  if (labels.reduce((n, l, i) => n + l.width + 12 * +!!i, 0) > width) labels = build(false);
  labels.forEach((l, i) => {
    const prev = labels[i - 1];
    l.x = Math.max(prev ? prev.x + prev.width + 12 : 0, l.anchor - l.width / 2);
  });
  for (let i = labels.length - 1; i >= 0; i--) {
    const l = labels[i], next = labels[i + 1];
    const limit = next ? next.x - 12 : width;
    if (l.x + l.width > limit) l.x = Math.max(0, limit - l.width);
  }
  return labels;
}

export function SplitBar({
  segments, title, description, format, unit, totalLabel = "Total", hidden, defaultHidden = [],
  onHiddenChange, legend = true, locale = "en-US", label, className, style,
}: SplitBarProps) {
  const reduceMotion = !!useReducedMotion();
  const titleId = useId();
  const [ownHidden, setOwnHidden] = useState<string[]>(() => [...defaultHidden]);
  const hiddenIds = hidden ?? ownHidden;
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const setHidden = (next: string[]) => { if (!hidden) setOwnHidden(next); onHiddenChange?.(next); };
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0, ...format, numberingSystem: "latn" }), [format, locale]);
  const percent = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1, numberingSystem: "latn" }), [locale]);
  const barRef = useRef<HTMLDivElement>(null), probe = useRef<HTMLSpanElement>(null);
  const widthValue = useMotionValue(0);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const read = () => { widthValue.set(el.clientWidth); setWidth(el.clientWidth); };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [widthValue]);
  const measure = useTextMeasure(probe);
  const [hover, setHover] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [refused, setRefused] = useState<{ id: string; key: number } | null>(null);
  const colorOf = (s: SplitSegment, i: number) => s.color ?? PALETTE[i % PALETTE.length] ?? "var(--text-muted)";
  const visible = segments.filter((s) => !hiddenSet.has(s.id) && s.value > 0);
  const total = visible.reduce((n, s) => n + s.value, 0);
  const focus = hover && visible.some((s) => s.id === hover) ? hover : null;
  const shareOf = (s: SplitSegment) => (total > 0 && !hiddenSet.has(s.id) ? Math.max(0, s.value) / total : 0);
  const shares = new Map(segments.map((s) => [s.id, shareOf(s)]));
  const slices = layoutSlices(segments, shares, focus, width, measure, percent);
  const outside = layoutOutside(segments, slices, width, measure, percent);
  const toggle = (id: string) => {
    const seg = segments.find((s) => s.id === id);
    if (!seg) return;
    if (hiddenSet.has(id)) { setHidden(hiddenIds.filter((x) => x !== id)); setAnnouncement(`${seg.label} shown.`); return; }
    if (visible.length <= 1) {
      setRefused((r) => ({ id, key: (r?.key ?? 0) + 1 }));
      setAnnouncement(`${seg.label} is the only share shown, so it stays on.`);
      return;
    }
    setHidden([...hiddenIds, id]);
    setAnnouncement(`${seg.label} hidden.`);
  };
  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const at = (e.clientX - r.left) / r.width;
    const hit = slices.find((s) => s.on && at >= s.start && at < s.end);
    if (hit && hit.id !== hover) setHover(hit.id);
  };
  const focused = focus ? segments.find((s) => s.id === focus) : undefined;
  const focusedIndex = focused ? segments.indexOf(focused) : -1;
  const summary = visible.map((s) => `${s.label} ${percent.format(shareOf(s))}`).join(", ");
  const name = label ?? title ?? "Split bar";
  const blur = `blur(${T.blur.subtle}px)`;
  return (
    <figure className={[styles.figure, className].filter(Boolean).join(" ")} style={style} aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : name}>
      <span ref={probe} className={styles.probe} aria-hidden="true">0</span>
      <div className={styles.head}>
        {(title || description) && (
          <div className={styles.heading}>
            {title && <p id={titleId} className={styles.title}>{title}</p>}
            {description && <p className={styles.description}>{description}</p>}
          </div>
        )}
        <div className={styles.readout} aria-hidden="true">
          <AnimatePresence mode="popLayout" anchorX="right" initial={false}>
            <motion.div
              key={focused ? focused.id : "total"}
              className={styles.readoutLine}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, filter: blur }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, filter: blur, transition: { duration: T.duration.fast } }}
              transition={reduceMotion ? { duration: 0 } : { ...T.spring.snappy, opacity: { duration: T.duration.fast } }}
            >
              {focused ? (
                <>
                  <span className={styles.readoutSwatch} style={css({ "--seg": colorOf(focused, focusedIndex) })} />
                  <span className={styles.readoutName}>{focused.label}</span>
                  <span className={styles.readoutShare}><RollingNumber value={shareOf(focused)} formatter={percent} reduceMotion={reduceMotion} /></span>
                  <span className={styles.readoutValue}><RollingNumber value={focused.value} formatter={number} reduceMotion={reduceMotion} />{unit ? ` ${unit}` : ""}</span>
                </>
              ) : (
                <>
                  <span className={styles.readoutName}>{totalLabel}</span>
                  <span className={styles.readoutShare}><RollingNumber value={total} formatter={number} reduceMotion={reduceMotion} /></span>
                  {unit && <span className={styles.readoutValue}>{unit}</span>}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div
        ref={barRef}
        className={styles.bar}
        data-active={focus ? "" : undefined}
        tabIndex={0}
        role="group"
        aria-roledescription="split bar"
        aria-label={`${name}: ${summary}. Use the arrow keys to read each share.`}
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null); }}
        onKeyDown={(e) => {
          const ids = visible.map((s) => s.id);
          if (!ids.length) return;
          const at = focus ? ids.indexOf(focus) : -1;
          const moves: Record<string, number> = {
            ArrowRight: at + 1, ArrowDown: at + 1,
            ArrowLeft: at <= 0 ? ids.length - 1 : at - 1, ArrowUp: at <= 0 ? ids.length - 1 : at - 1,
            Home: 0, End: ids.length - 1,
          };
          if (e.key === "Escape") return void setHover(null);
          if (e.key === "Enter" || e.key === " ") { if (focus) { e.preventDefault(); toggle(focus); } return; }
          if (!(e.key in moves)) return;
          e.preventDefault();
          const next = ids[(moves[e.key] + ids.length) % ids.length];
          if (!next) return;
          setHover(next);
          const seg = segments.find((s) => s.id === next);
          if (seg) setAnnouncement(`${seg.label}, ${percent.format(shareOf(seg))}, ${number.format(seg.value)}${unit ? ` ${unit}` : ""}.`);
        }}
        onBlur={() => setHover(null)}
      >
        {segments.map((s, i) => {
          const slice = slices[i];
          return slice ? (
            <Segment
              key={s.id}
              slice={slice}
              color={colorOf(s, i)}
              width={widthValue}
              active={focus === s.id}
              dimmed={!!focus && focus !== s.id}
              text={{ name: s.label, share: slice.share, formatter: percent }}
              reduceMotion={reduceMotion}
            />
          ) : null;
        })}
      </div>
      <motion.div className={styles.lane} initial={false} animate={{ height: 40 * +!!outside.length }} transition={reduceMotion ? { duration: 0 } : T.spring.smooth} aria-hidden="true">
        <svg className={styles.leaders} width="100%" height={40}>
          <AnimatePresence initial={false}>
            {outside.map((l) => {
              const mid = l.x + l.width / 2;
              const d = `M${l.anchor.toFixed(1)} 0 C${l.anchor.toFixed(1)} 10 ${mid.toFixed(1)} 6 ${mid.toFixed(1)} 15`;
              return (
                <motion.path
                  key={l.id}
                  className={styles.leader}
                  data-dimmed={(focus && focus !== l.id) || undefined}
                  initial={{ opacity: 0, d }}
                  animate={{ opacity: 1, d }}
                  exit={{ opacity: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { d: T.spring.smooth, opacity: { duration: T.duration.fast } }}
                />
              );
            })}
          </AnimatePresence>
        </svg>
        <AnimatePresence initial={false}>
          {outside.map((l) => (
            <motion.span
              key={l.id}
              className={styles.outside}
              data-dimmed={(focus && focus !== l.id) || undefined}
              initial={{ opacity: 0, x: l.x, y: -4 }}
              animate={{ opacity: 1, x: l.x, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={reduceMotion ? { duration: 0 } : { ...T.spring.smooth, opacity: { duration: T.duration.fast } }}
            >
              {l.name && <span className={styles.outsideName}>{l.name}</span>}
              <RollingNumber value={slices.find((s) => s.id === l.id)?.share ?? 0} formatter={percent} reduceMotion={reduceMotion} />
            </motion.span>
          ))}
        </AnimatePresence>
      </motion.div>
      {legend && (
        <ul className={styles.legend} aria-label={`${name} segments`}>
          {segments.map((s, i) => {
            const on = !hiddenSet.has(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={styles.legendItem}
                  data-off={!on || undefined}
                  data-active={focus === s.id || undefined}
                  aria-pressed={on}
                  aria-label={`${s.label}, ${on ? percent.format(shareOf(s)) : "hidden"}`}
                  style={css({ "--seg": colorOf(s, i) })}
                  onClick={() => toggle(s.id)}
                  onPointerEnter={(e) => { if (e.pointerType === "mouse" && on) setHover(s.id); }}
                  onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null); }}
                >
                  <motion.span
                    key={refused?.id === s.id ? refused.key : 0}
                    className={styles.legendLabel}
                    initial={{ x: 0 }}
                    animate={refused?.id !== s.id || reduceMotion ? { x: 0 } : { x: [0, -3, 3, -2, 0] }}
                    transition={{ duration: 0.32, ease: T.ease.standard }}
                  >
                    <span className={styles.swatch} aria-hidden="true" />
                    <span className={styles.legendName}>{s.label}</span>
                  </motion.span>
                  <span className={styles.legendShare} aria-hidden="true">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {on ? (
                        <motion.span key="on" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : T.duration.fast }}>
                          <RollingNumber value={shareOf(s)} formatter={percent} reduceMotion={reduceMotion} />
                        </motion.span>
                      ) : (
                        <motion.span key="off" className={styles.legendOff} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : T.duration.fast }}>
                          Off
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    </figure>
  );
}
