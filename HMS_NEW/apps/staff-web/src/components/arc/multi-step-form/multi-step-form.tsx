// Port of Arc Pro multi-step-form/dependencies/44818.cjs. The application owns each saved stage;
// the root is a section so stage contents can have independent, recoverable forms (never nested forms).
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { motionTokens as T } from "../motion-tokens";
import styles from "./multi-step-form.module.css";
const fade = {
  duration: T.duration.instant,
  ease: [...T.ease.standard] as [number, number, number, number],
};
const textTransition = {
  duration: T.duration.standard,
  ease: [...T.ease.enter] as [number, number, number, number],
};
const slide: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: 20 * direction }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({
    opacity: 0,
    x: -20 * direction,
    transition: { x: T.spring.smooth, opacity: fade },
  }),
};
const swap: Variants = {
  enter: (direction = 1) => ({
    opacity: 0,
    y: `${0.3 * direction}em`,
    filter: `blur(${T.blur.soft}px)`,
  }),
  center: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: (direction = 1) => ({
    opacity: 0,
    y: `${-0.3 * direction}em`,
    filter: `blur(${T.blur.subtle}px)`,
    transition: fade,
  }),
};
function Swap({
  value,
  direction = 1,
  reduced,
}: {
  value: string | number;
  direction?: number;
  reduced: boolean;
}) {
  return (
    <span className={styles.swap} aria-hidden="true">
      <AnimatePresence initial={false} custom={direction}>
        <motion.span
          key={String(value)}
          custom={direction}
          variants={swap}
          initial={!reduced && "enter"}
          animate="center"
          exit={reduced ? undefined : "exit"}
          transition={reduced ? { duration: 0 } : textTransition}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
function Label({ label, reduced }: { label: string; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null),
    previous = useRef(0),
    width = useMotionValue<number | string>("auto");
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      previous.current = node.offsetWidth;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const current = width.get(),
      next = ref.current?.offsetWidth ?? 0,
      before = typeof current === "number" ? current : previous.current;
    previous.current = next;
    if (reduced || !before || !next || Math.abs(before - next) < 1) {
      width.jump("auto");
      return;
    }
    width.jump(before);
    const animation = animate(width, next, {
      ...T.spring.morph,
      onComplete: () => width.jump("auto"),
    });
    return () => animation.stop();
  }, [label, reduced, width]);
  return (
    <span className={styles.morph}>
      <span ref={ref} className={styles.sizer} aria-hidden="true">
        {label}
      </span>
      <motion.span className={styles.morphBox} style={{ width }}>
        <Swap value={label} reduced={reduced} />
      </motion.span>
      <span className={styles.srOnly}>{label}</span>
    </span>
  );
}
export type FormStage = {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
};
export function MultiStepForm({
  steps,
  current,
  onBack,
  onNext,
  nextForm,
  nextLabel = "Continue",
  nextDisabled,
  backDisabled,
  busy,
  footer,
}: {
  steps: FormStage[];
  current: number;
  onBack?: () => void;
  onNext?: () => void;
  nextForm?: string;
  nextLabel?: string;
  nextDisabled?: boolean;
  backDisabled?: boolean;
  busy?: boolean;
  footer?: ReactNode;
}) {
  const reduced = useReducedMotion() ?? false,
    id = useId(),
    heading = useRef<HTMLLegendElement>(null),
    viewport = useRef<HTMLDivElement>(null);
  const previous = useRef(current);
  const [motionState, setMotionState] = useState({ current, direction: 1 });
  if (current !== motionState.current)
    setMotionState({
      current,
      direction: current > motionState.current ? 1 : -1,
    });
  const direction = motionState.direction,
    stageId = steps[current]?.id;
  const [height, setHeight] = useState<number | "auto">("auto"),
    content = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (previous.current !== current) heading.current?.focus();
    previous.current = current;
  }, [current]);
  useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = () => setHeight(node.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [current, stageId]);
  const stage = steps[current];
  if (!stage) return null;
  return (
    <section
      className={`arc-demo-scope ${styles.form}`}
      aria-label="Doctor setup"
      aria-busy={busy || undefined}
    >
      <nav
        className={styles.progress}
        aria-label={`Progress: step ${current + 1} of ${steps.length}`}
      >
        <ol className={styles.progressList}>
          {steps.map((step, index) => (
            <li
              key={step.id}
              className={`${styles.progressItem} ${index < current ? styles.complete : ""} ${index === current ? styles.current : ""}`}
              aria-current={index === current ? "step" : undefined}
            >
              <span className={styles.progressMarker} aria-hidden="true">
                <AnimatePresence initial={false}>
                  {index < current ? (
                    <motion.svg
                      key="done"
                      className={styles.markerGlyph}
                      viewBox="0 0 24 24"
                      width={11}
                      height={11}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={!reduced && { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={
                        reduced
                          ? undefined
                          : { opacity: 0, scale: 0.6, transition: fade }
                      }
                      transition={reduced ? { duration: 0 } : T.spring.snappy}
                    >
                      <motion.path
                        d="M4 12.5 9 17.5 20 6.5"
                        initial={!reduced && { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={
                          reduced
                            ? { duration: 0 }
                            : {
                                duration: 0.32,
                                ease: [...T.ease.enter],
                                delay: 0.04,
                              }
                        }
                      />
                    </motion.svg>
                  ) : (
                    <motion.span
                      key="number"
                      className={styles.markerGlyph}
                      initial={
                        !reduced && {
                          opacity: 0,
                          scale: 0.6,
                          filter: `blur(${T.blur.subtle}px)`,
                        }
                      }
                      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                      exit={
                        reduced
                          ? undefined
                          : { opacity: 0, scale: 0.6, transition: fade }
                      }
                      transition={reduced ? { duration: 0 } : T.spring.snappy}
                    >
                      {index + 1}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className={styles.progressLabel} data-label={step.title}>
                {step.title}
              </span>
            </li>
          ))}
        </ol>
        <span className={styles.progressCount} aria-hidden="true">
          Step{" "}
          <span className={styles.countValue}>
            <Swap value={current + 1} direction={direction} reduced={reduced} />
          </span>{" "}
          of {steps.length}
        </span>
        <span className={styles.srOnly} aria-live="polite">
          Step {current + 1} of {steps.length}
        </span>
      </nav>
      <motion.div
        ref={viewport}
        className={styles.viewport}
        initial={false}
        animate={{ height }}
        transition={reduced ? { duration: 0 } : T.spring.smooth}
        onAnimationStart={() => {
          if (viewport.current) viewport.current.dataset.resizing = "true";
        }}
        onAnimationComplete={() => {
          if (viewport.current) viewport.current.dataset.resizing = "false";
        }}
      >
        <AnimatePresence initial={false} custom={direction}>
          <motion.fieldset
            key={stage.id}
            ref={content}
            className={styles.step}
            custom={direction}
            variants={slide}
            initial={!reduced && "enter"}
            animate="center"
            exit={reduced ? undefined : "exit"}
            transition={
              reduced
                ? { duration: 0 }
                : { x: T.spring.smooth, opacity: textTransition }
            }
          >
            <legend id={id} ref={heading} tabIndex={-1}>
              {stage.title}
            </legend>
            {stage.description && (
              <p className={styles.description}>{stage.description}</p>
            )}
            <div className={styles.content}>{stage.content}</div>
          </motion.fieldset>
        </AnimatePresence>
      </motion.div>
      <div className={styles.actionsShell}>
        <div className={styles.actions}>
          {footer ?? (
            <>
              <button
                className={styles.back}
                type="button"
                disabled={busy || backDisabled || !onBack}
                onClick={onBack}
              >
                <ArrowLeft aria-hidden="true" width={16} height={16} /> Back
              </button>
              <button
                className={styles.next}
                type={nextForm ? "submit" : "button"}
                form={nextForm}
                onClick={nextForm ? undefined : onNext}
                disabled={busy || nextDisabled}
              >
                <Label label={nextLabel} reduced={reduced} />
                <ArrowRight aria-hidden="true" width={16} height={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
