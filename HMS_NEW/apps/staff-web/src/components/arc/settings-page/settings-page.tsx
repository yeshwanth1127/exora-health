// Arc Pro SettingsPage.cjs: section navigation and scoped save-bar presentation.
// The application supplies authorised sections, guarded routing, and an individual form's save action.
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  LayoutGroup,
  motion,
  useMotionValue,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { AnimatedCounter } from "../animated-counter/animated-counter";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { motionTokens as T } from "../motion-tokens";
import styles from "./settings-page.module.css";
type PaneMotion = { direction: number; axis: "x" | "y"; reduce: boolean };
const pane: Variants = {
  enter: ({ direction, axis, reduce }: PaneMotion) =>
    reduce
      ? { opacity: 0 }
      : {
          opacity: 0,
          ...(axis === "x" ? { x: 16 * direction } : { y: 14 * direction }),
          filter: `blur(${T.blur.subtle}px)`,
        },
  center: ({ reduce }: PaneMotion) => ({
    opacity: 1,
    x: 0,
    y: 0,
    filter: "blur(0px)",
    transition: reduce
      ? { duration: T.duration.instant }
      : {
          x: T.spring.smooth,
          y: T.spring.smooth,
          opacity: { duration: T.duration.standard, ease: [...T.ease.enter] },
          filter: { duration: T.duration.standard, ease: [...T.ease.enter] },
        },
  }),
  exit: ({ direction, axis, reduce }: PaneMotion) =>
    reduce
      ? { opacity: 0, transition: { duration: T.duration.instant } }
      : {
          opacity: 0,
          ...(axis === "x" ? { x: -10 * direction } : { y: -8 * direction }),
          filter: `blur(${T.blur.subtle}px)`,
          transition: { duration: T.duration.fast, ease: [...T.ease.standard] },
        },
};
export type SettingsItem = {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
};
export function SettingsPage({
  sections,
  current,
  onChange,
  account,
  children,
}: {
  sections: SettingsItem[];
  current: string;
  onChange: (id: string) => void;
  account: { name: string; detail: string };
  children: ReactNode;
}) {
  const id = useId(),
    reduced = useReducedMotion() ?? false,
    buttons = useRef<(HTMLButtonElement | null)[]>([]),
    scroller = useRef<HTMLDivElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    previous = useRef(current);
  const selected = sections.find((item) => item.id === current);
  const nav = useRef<HTMLUListElement>(null);
  const [motionState, setMotionState] = useState({ current, direction: 1 });
  const [axis, setAxis] = useState<"x" | "y">("y");
  if (current !== motionState.current)
    setMotionState({
      current,
      direction:
        sections.findIndex((item) => item.id === current) >
        sections.findIndex((item) => item.id === motionState.current)
          ? 1
          : -1,
    });
  const movement: PaneMotion = {
    direction: motionState.direction,
    axis,
    reduce: reduced,
  };
  const select = (next: string) => {
    setAxis(
      nav.current && getComputedStyle(nav.current).flexDirection === "row"
        ? "x"
        : "y",
    );
    onChange(next);
  };
  useLayoutEffect(() => {
    if (previous.current !== current) {
      scroller.current?.scrollTo({ top: 0 });
      heading.current?.focus();
    }
    previous.current = current;
  }, [current]);
  return (
    <section
      className={`arc-demo-scope ${styles.root}`}
      aria-labelledby={`${id}-title`}
    >
      <div className={styles.settings}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHead}>
            <h2 id={`${id}-title`}>Settings</h2>
            <span className={styles.headAvatar}>
              <Avatar name={account.name} size="sm" />
            </span>
          </div>
          <LayoutGroup id={id}>
            <nav aria-label="Settings sections">
              <motion.ul ref={nav} className={styles.navList} layoutScroll>
                {sections.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      ref={(node) => {
                        buttons.current[index] = node;
                      }}
                      className={styles.navItem}
                      aria-current={current === item.id ? "page" : undefined}
                      onClick={() => select(item.id)}
                      onKeyDown={(event) => {
                        const offsets: Record<string, number> = {
                          ArrowDown: 1,
                          ArrowRight: 1,
                          ArrowUp: -1,
                          ArrowLeft: -1,
                        };
                        const to =
                          event.key in offsets
                            ? (index + offsets[event.key] + sections.length) %
                              sections.length
                            : event.key === "Home"
                              ? 0
                              : event.key === "End"
                                ? sections.length - 1
                                : -1;
                        if (to < 0) return;
                        event.preventDefault();
                        buttons.current[to]?.focus();
                        select(sections[to].id);
                      }}
                    >
                      {current === item.id && (
                        <motion.span
                          layoutId="settings-section"
                          layoutDependency={current}
                          className={styles.highlight}
                          transition={
                            reduced ? { duration: 0 } : T.spring.morph
                          }
                          aria-hidden="true"
                        />
                      )}
                      {item.icon}
                      <span className={styles.navLabel}>{item.label}</span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            </nav>
          </LayoutGroup>
          <div className={styles.account}>
            <Avatar name={account.name} size="md" />
            <span>
              <strong>{account.name}</strong>
              <small>{account.detail}</small>
            </span>
          </div>
        </aside>
        <div className={styles.main}>
          <div
            ref={scroller}
            className={styles.scroller}
            role="region"
            aria-labelledby={`${id}-heading`}
          >
            <AnimatePresence
              mode="wait"
              initial={false}
              custom={movement}
              onExitComplete={() => {
                scroller.current?.scrollTo({ top: 0 });
                requestAnimationFrame(() => heading.current?.focus());
              }}
            >
              <motion.div
                key={current}
                className={styles.pane}
                custom={movement}
                variants={pane}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <header className={styles.paneHead}>
                  <h3 id={`${id}-heading`} ref={heading} tabIndex={-1}>
                    {selected?.label}
                  </h3>
                  <p>{selected?.description}</p>
                </header>
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
/** Only the enclosing form's dirty fields and existing guarded command belong here. */
export function SettingsSaveBar({
  count,
  busy,
  onDiscard,
  children,
}: {
  count: number;
  busy: boolean;
  onDiscard: () => void;
  children: ReactNode;
}) {
  return (
    <div className="arc-demo-scope relative h-20">
      <div className={styles.dock}>
        <AnimatePresence initial={false}>
          {count > 0 && (
            <SaveBar
              key="dirty"
              count={count}
              busy={busy}
              onDiscard={onDiscard}
            >
              {children}
            </SaveBar>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
function SaveBar({
  count,
  busy,
  onDiscard,
  children,
}: {
  count: number;
  busy: boolean;
  onDiscard: () => void;
  children: ReactNode;
}) {
  const reduced = useReducedMotion() ?? false,
    content = useRef<HTMLDivElement>(null),
    width = useMotionValue(52),
    height = useMotionValue(52);
  useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = () => {
      const size = [node.offsetWidth + 2, node.offsetHeight + 2];
      if (reduced) {
        width.jump(size[0]);
        height.jump(size[1]);
      } else {
        animate(width, size[0], T.spring.morph);
        animate(height, size[1], T.spring.morph);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced, width, height]);
  return (
    <motion.div
      className={styles.bar}
      role="group"
      aria-label="Unsaved name and phone changes"
      style={{ width, height }}
      initial={
        reduced
          ? { opacity: 0 }
          : { opacity: 0, y: 28, filter: `blur(${T.blur.soft}px)` }
      }
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={
        reduced
          ? { opacity: 0 }
          : {
              opacity: 0,
              y: 20,
              width: 52,
              height: 52,
              filter: `blur(${T.blur.soft}px)`,
            }
      }
      transition={
        reduced
          ? { duration: 0 }
          : {
              y: T.spring.smooth,
              opacity: { duration: T.duration.fast },
              filter: { duration: T.duration.standard },
            }
      }
    >
      <div ref={content} className={styles.barContent}>
        <div className={styles.barEdit}>
          <span className={styles.barCount} role="status">
            <span className={styles.inherit}>
              <AnimatedCounter value={count} />
            </span>
            <span className={styles.unsaved}>&nbsp;unsaved</span>&nbsp;
            {count === 1 ? "change" : "changes"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onDiscard}
          >
            Discard
          </Button>
          {children}
        </div>
      </div>
    </motion.div>
  );
}
