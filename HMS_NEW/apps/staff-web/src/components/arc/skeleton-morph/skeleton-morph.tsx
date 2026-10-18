// Port of the local Arc Pro "skeleton-morph" reference (components/pro/skeleton-morph/src/SkeletonMorphDemo.cjs).
// SkeletonMorph and MorphBlock follow the reconstructed source; the demo's sample profile/payout cards are not ported.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { motionTokens as T } from "../motion-tokens";
import styles from "./skeleton-morph.module.css";

type Ctx = {
  loading: boolean;
  reduced: boolean;
  stagger: number;
  register: (el: HTMLElement) => () => void;
  order: (el: HTMLElement | null) => number;
};
const MorphContext = createContext<Ctx | null>(null);
const noopSubscribe = () => () => {};
const spring = T.spring.smooth;
const ease = [...T.ease.standard] as [number, number, number, number];
const px = (v: number | string | undefined) => (typeof v === "number" ? `${v}px` : v);

export type SkeletonMorphProps = {
  loading: boolean;
  children: ReactNode;
  stagger?: number;
  loadingLabel?: string;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
};

export function SkeletonMorph({ loading, children, stagger = 0.04, loadingLabel = "Loading", as: Root = "div", className, style }: SkeletonMorphProps) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const reduced = !!useReducedMotion() && hydrated;
  const blocks = useRef(new Set<HTMLElement>());
  const register = useCallback((el: HTMLElement) => {
    blocks.current.add(el);
    return () => { blocks.current.delete(el); };
  }, []);
  const order = useCallback((el: HTMLElement | null) => {
    if (!el) return 0;
    let n = 0;
    for (const other of blocks.current)
      if (other !== el && other.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) n += 1;
    return n;
  }, []);
  const ctx = useMemo(() => ({ loading, reduced, stagger, register, order }), [loading, order, reduced, register, stagger]);
  const inner = useRef<HTMLDivElement>(null), shell = useRef<HTMLDivElement>(null);
  const height = useMotionValue(-1);
  const heightStyle = useTransform(height, (h) => (h < 0 ? "auto" : `${h}px`));
  useLayoutEffect(() => {
    const el = inner.current, sh = shell.current;
    if (!el || !sh) return;
    let last = el.offsetHeight;
    let run: ReturnType<typeof animate> | null = null;
    const settle = () => { height.jump(-1); delete sh.dataset.easing; };
    const ro = new ResizeObserver(() => {
      const next = el.offsetHeight;
      if (next === last) return;
      const from = height.get() < 0 ? last : height.get();
      last = next;
      run?.stop();
      if (reduced || Math.abs(next - from) < 1) return settle();
      height.jump(from);
      sh.dataset.easing = "";
      run = animate(height, next, { ...T.spring.smooth, onComplete: settle });
    });
    ro.observe(el);
    return () => { ro.disconnect(); run?.stop(); };
  }, [reduced, height]);
  return (
    <Root className={[styles.root, className].filter(Boolean).join(" ")} style={style} aria-busy={loading || undefined}>
      <span className={styles.srOnly} role="status">{loading ? loadingLabel : ""}</span>
      <motion.div ref={shell} className={styles.shell} style={{ height: heightStyle }}>
        <div ref={inner} className={styles.inner}>
          <MorphContext.Provider value={ctx}>{children}</MorphContext.Provider>
        </div>
      </motion.div>
    </Root>
  );
}

export type MorphBlockProps = {
  children?: ReactNode;
  width?: number | string;
  height?: number | string;
  radius?: number | string | "circle";
  lines?: number;
  lineHeight?: number;
  as?: "div" | "span" | "p" | "li" | "section" | "article" | "header" | "footer" | "h2" | "h3" | "h4";
  className?: string;
  style?: CSSProperties;
};

export function MorphBlock({ children, width = "100%", height, radius = 6, lines, lineHeight = 20, as: Tag = "div", className, style }: MorphBlockProps) {
  const ctx = useContext(MorphContext);
  if (!ctx) throw Error("MorphBlock must be used inside SkeletonMorph");
  const { loading, reduced, stagger, register, order } = ctx;
  const block = useRef<HTMLElement>(null), placeholder = useRef<HTMLSpanElement>(null);
  useEffect(() => (block.current ? register(block.current) : undefined), [register]);
  const [resolved, setResolved] = useState(!loading);
  if (loading && resolved) setResolved(false);
  const showContent = resolved && !loading;
  useEffect(() => {
    if (loading) return;
    const delay = reduced ? 0 : order(block.current) * stagger * 1000;
    const t = window.setTimeout(() => setResolved(true), delay);
    return () => window.clearTimeout(t);
  }, [loading, order, reduced, stagger]);
  const circle = radius === "circle";
  const lineCount = lines ?? 0;
  const w = px(width) ?? "100%";
  const h = px(height) ?? (lineCount ? `${lineCount * lineHeight}px` : "12px");
  const size = useRef({ width: w, height: h });
  useLayoutEffect(() => { size.current = { width: w, height: h }; });
  useLayoutEffect(() => {
    const el = block.current, ph = placeholder.current;
    if (!el || !ph) return;
    if (!showContent) {
      const run = animate(ph, { width: "100%", height: "100%", x: 0, y: 0, opacity: 1 }, { duration: 0 });
      return () => run.stop();
    }
    if (reduced) {
      const run = animate(ph, { opacity: [1, 0] }, { duration: T.duration.instant });
      return () => run.stop();
    }
    const content = el.getBoundingClientRect();
    const { width: ow, height: oh } = el.style;
    el.dataset.state = "skeleton";
    el.style.width = size.current.width;
    el.style.height = size.current.height;
    const skeleton = el.getBoundingClientRect();
    el.dataset.state = "content";
    el.style.width = ow;
    el.style.height = oh;
    const run = animate(
      ph,
      {
        width: [skeleton.width, content.width],
        height: [skeleton.height, content.height],
        x: [skeleton.left - content.left, 0],
        y: [skeleton.top - content.top, 0],
        opacity: [1, 0],
      },
      { width: spring, height: spring, x: spring, y: spring, opacity: { duration: 0.38, ease, delay: 0.06 } },
    );
    return () => run.stop();
  }, [reduced, showContent]);
  const sizing = showContent ? {} : { width: w, height: h };
  const shape = { borderRadius: circle ? 9999 : lineCount ? 0 : px(radius), "--line": `${lineHeight}px` } as CSSProperties;
  const Block = Tag as ElementType;
  return (
    <Block ref={block} className={[styles.block, className].filter(Boolean).join(" ")} data-state={showContent ? "content" : "skeleton"} style={{ ...style, ...sizing }}>
      {showContent && (
        <motion.div
          className={styles.content}
          initial={reduced ? { opacity: 0 } : { opacity: 0, filter: `blur(${T.blur.soft}px)` }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: reduced ? T.duration.instant : 0.34, ease }}
        >
          {children}
        </motion.div>
      )}
      <span ref={placeholder} className={styles.placeholder} aria-hidden="true" data-lines={lineCount || undefined} style={shape}>
        {lineCount > 0 && Array.from({ length: lineCount }, (_, i) => <span key={i} className={styles.line} data-last={(i === lineCount - 1 && lineCount > 1) || undefined} />)}
      </span>
    </Block>
  );
}
