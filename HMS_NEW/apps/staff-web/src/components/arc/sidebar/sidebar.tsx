import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactElement,
  type ReactNode,
  type SVGProps,
} from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Transition,
} from "motion/react";
import { Dialog } from "@base-ui/react/dialog";
import { Tooltip } from "@base-ui/react/tooltip";
import { ChevronRight, X } from "lucide-react";
import { motionTokens as T } from "../motion-tokens";
import styles from "./sidebar.module.css";

export type SidebarEntry = {
  id: string;
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  count?: number;
  children?: SidebarEntry[];
};
export type SidebarSection = {
  id: string;
  heading?: string;
  items: SidebarEntry[];
};
type Props = {
  sections: SidebarSection[];
  footer: SidebarEntry[];
  active: string;
  brand: { name: string; detail: string; icon: ReactNode };
  person: { name: string; role: string };
  /** Call accepted only when routing/leave guards have accepted the action. */
  onNavigate: (id: string, accepted: () => void) => void;
  renderHeader: (toggle: ReactNode) => ReactNode;
  children: ReactNode;
};

const instant = { duration: 0 };
function labelTransition(collapsed: boolean, reduce: boolean): Transition {
  return reduce
    ? instant
    : collapsed
      ? { duration: 0.14, ease: T.ease.standard }
      : { duration: 0.24, delay: 0.1, ease: T.ease.enter };
}
function detailTransition(collapsed: boolean, reduce: boolean): Transition {
  return reduce
    ? instant
    : collapsed
      ? { duration: 0.2, delay: 0.16, ease: T.ease.enter }
      : { duration: 0.1, ease: T.ease.standard };
}

function Tip({
  enabled = true,
  label,
  note,
  side = "right",
  children,
}: {
  enabled?: boolean;
  label: ReactNode;
  note?: string;
  side?: "right" | "bottom";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!enabled && open) setOpen(false);
  return (
    <Tooltip.Root
      open={enabled && open}
      onOpenChange={(next) => setOpen(next && enabled)}
    >
      <Tooltip.Trigger render={children as ReactElement} />
      <Tooltip.Portal>
        <Tooltip.Positioner
          side={side}
          sideOffset={side === "right" ? 14 : 6}
          collisionPadding={8}
          className={styles.tooltipPositioner}
        >
          <Tooltip.Popup className={`${styles.skin} ${styles.tip}`}>
            {label}
            {note && <span className={styles.tipNote}>{note}</span>}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function NavItem({
  entry,
  nested,
  current,
  lit,
  expanded,
  turned,
  controls,
  collapsed,
  tips,
  layoutId,
  reduce,
  onClick,
}: {
  entry: SidebarEntry;
  nested?: boolean;
  current?: boolean;
  lit?: boolean;
  expanded?: boolean;
  turned?: boolean;
  controls?: string;
  collapsed: boolean;
  tips: boolean;
  layoutId: string;
  reduce: boolean;
  onClick: () => void;
}) {
  const Icon = entry.icon;
  const label = labelTransition(collapsed, reduce);
  return (
    <Tip
      enabled={tips}
      label={entry.label}
      note={entry.count ? `${entry.count} unread` : undefined}
    >
      <button
        type="button"
        className={[
          styles.item,
          nested ? styles.nested : "",
          lit ? styles.lit : "",
        ].join(" ")}
        aria-current={current ? "page" : undefined}
        aria-expanded={expanded}
        aria-controls={controls}
        onClick={onClick}
      >
        {lit && (
          <motion.span
            layoutId={layoutId}
            className={styles.highlight}
            style={{ borderRadius: 8 }}
            transition={reduce ? instant : T.spring.morph}
          />
        )}
        {Icon && <Icon className={styles.icon} aria-hidden="true" />}
        <motion.span
          className={styles.label}
          initial={false}
          animate={{ opacity: +!collapsed, x: collapsed ? -6 : 0 }}
          transition={label}
        >
          {entry.label}
          {entry.count ? (
            <span className={styles.srOnly}>, {entry.count} unread</span>
          ) : null}
        </motion.span>
        {entry.count ? (
          <>
            <motion.span
              className={styles.count}
              aria-hidden="true"
              initial={false}
              animate={{ opacity: +!collapsed }}
              transition={label}
            >
              {entry.count}
            </motion.span>
            <motion.span
              className={styles.dot}
              aria-hidden="true"
              initial={false}
              animate={{ opacity: +collapsed, scale: collapsed ? 1 : 0.3 }}
              transition={
                collapsed && !reduce
                  ? { ...T.spring.snappy, delay: 0.16 }
                  : detailTransition(collapsed, reduce)
              }
            />
          </>
        ) : null}
        {turned !== undefined && (
          <motion.span
            className={styles.chevron}
            aria-hidden="true"
            initial={false}
            animate={{ opacity: +!collapsed, rotate: 90 * +turned }}
            transition={{
              opacity: label,
              rotate: reduce ? instant : T.spring.snappy,
            }}
          >
            <ChevronRight size={14} strokeWidth={1.75} />
          </motion.span>
        )}
      </button>
    </Tip>
  );
}

function Navigation({
  sections,
  footer,
  name,
  variant,
  baseId,
  collapsed,
  active,
  open,
  reduce,
  onSelect,
  onGroup,
}: {
  sections: SidebarSection[];
  footer: SidebarEntry[];
  name: string;
  variant: "side" | "sheet";
  baseId: string;
  collapsed: boolean;
  active: string;
  open: Record<string, boolean>;
  reduce: boolean;
  onSelect: (id: string) => void;
  onGroup: (id: string) => void;
}) {
  const shared = {
    collapsed,
    tips: variant === "side" && collapsed,
    layoutId: `${baseId}-${variant}-active`,
    reduce,
  };
  const smooth = reduce ? instant : T.spring.smooth;
  return (
    <motion.nav className={styles.nav} aria-label={name} layoutScroll>
      {sections.map((section) => {
        const id = `${baseId}-${variant}-${section.id}`;
        return (
          <div
            key={section.id}
            className={styles.section}
            role={section.heading ? "group" : undefined}
            aria-labelledby={section.heading ? id : undefined}
          >
            {section.heading && (
              <motion.div
                className={styles.heading}
                initial={false}
                animate={{ height: collapsed ? 17 : 32 }}
                transition={smooth}
              >
                <motion.span
                  id={id}
                  className={styles.headingText}
                  initial={false}
                  animate={{ opacity: +!collapsed, x: collapsed ? -6 : 0 }}
                  transition={labelTransition(collapsed, reduce)}
                >
                  {section.heading}
                </motion.span>
                <motion.span
                  className={styles.divider}
                  aria-hidden="true"
                  initial={false}
                  animate={{ opacity: +collapsed, scaleX: collapsed ? 1 : 0.3 }}
                  transition={detailTransition(collapsed, reduce)}
                />
              </motion.div>
            )}
            <ul className={styles.list} role="list">
              {section.items.map((entry) => {
                if (!entry.children)
                  return (
                    <li key={entry.id}>
                      <NavItem
                        entry={entry}
                        current={active === entry.id}
                        lit={active === entry.id}
                        onClick={() => onSelect(entry.id)}
                        {...shared}
                      />
                    </li>
                  );
                const childId = `${id}-${entry.id}-list`;
                const expanded = !!open[entry.id] && !collapsed;
                const containsActive = entry.children.some(
                  (child) => child.id === active,
                );
                return (
                  <li key={entry.id}>
                    <NavItem
                      entry={entry}
                      lit={containsActive && !expanded}
                      expanded={expanded}
                      turned={!!open[entry.id]}
                      controls={childId}
                      onClick={() => onGroup(entry.id)}
                      {...shared}
                    />
                    <motion.ul
                      id={childId}
                      className={styles.children}
                      role="list"
                      inert={!expanded}
                      initial={false}
                      animate={
                        expanded
                          ? {
                              height: "auto",
                              opacity: 1,
                              transitionEnd: { overflow: "visible" },
                            }
                          : { height: 0, opacity: 0, overflow: "hidden" }
                      }
                      transition={{
                        height: smooth,
                        opacity: reduce
                          ? instant
                          : {
                              duration: expanded ? 0.24 : 0.14,
                              delay: expanded ? 0.06 : 0,
                              ease: T.ease.standard,
                            },
                      }}
                    >
                      {entry.children.map((child) => (
                        <li key={child.id}>
                          <NavItem
                            entry={child}
                            nested
                            current={active === child.id}
                            lit={expanded && active === child.id}
                            onClick={() => onSelect(child.id)}
                            {...shared}
                          />
                        </li>
                      ))}
                    </motion.ul>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <ul className={`${styles.list} ${styles.footerList}`} role="list">
        {footer.map((entry) => (
          <li key={entry.id}>
            <NavItem
              entry={entry}
              current={active === entry.id}
              lit={active === entry.id}
              onClick={() => onSelect(entry.id)}
              {...shared}
            />
          </li>
        ))}
      </ul>
    </motion.nav>
  );
}

function Brand({
  brand,
  collapsed,
  reduce,
}: {
  brand: Props["brand"];
  collapsed: boolean;
  reduce: boolean;
}) {
  return (
    <div className={styles.brand}>
      <span className={styles.mark} data-logo="" aria-hidden="true">
        {brand.icon}
      </span>
      <motion.span
        className={styles.stack}
        initial={false}
        animate={{ opacity: +!collapsed, x: collapsed ? -6 : 0 }}
        transition={labelTransition(collapsed, reduce)}
      >
        <strong>{brand.name}</strong>
        <span>{brand.detail}</span>
      </motion.span>
    </div>
  );
}
function Profile({
  person,
  collapsed,
  reduce,
}: {
  person: Props["person"];
  collapsed: boolean;
  reduce: boolean;
}) {
  return (
    <div className={styles.profile}>
      <span className={styles.avatar} role="img" aria-label={person.name}>
        {person.name
          .split(" ")
          .map((word) => word[0])
          .slice(0, 2)
          .join("")}
      </span>
      <motion.span
        className={styles.stack}
        initial={false}
        animate={{ opacity: +!collapsed, x: collapsed ? -6 : 0 }}
        transition={labelTransition(collapsed, reduce)}
      >
        <strong>{person.name}</strong>
        <span>{person.role}</span>
      </motion.span>
    </div>
  );
}
function ToggleIcon({
  collapsed,
  reduce,
}: {
  collapsed: boolean;
  reduce: boolean;
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="3.5" />
      <motion.path
        d="M8.25 4.25v11.5"
        initial={false}
        animate={{ x: collapsed ? -2.5 : 0 }}
        transition={reduce ? instant : T.spring.smooth}
      />
    </svg>
  );
}

/** Typed application adapter for the local Arc App rail demo; sample content is supplied by the host. */
export function ArcSidebarLayout({
  sections,
  footer,
  active,
  brand,
  person,
  onNavigate,
  renderHeader,
  children,
}: Props) {
  const id = useId();
  const prefersReduced = !!useReducedMotion();
  const [hydrating, setHydrating] = useState(true);
  const reduce = prefersReduced || hydrating;
  const [shell, setShell] = useState<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [groups, setGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.flatMap((section) =>
        section.items
          .filter((entry) => entry.children)
          .map((entry) => [entry.id, true]),
      ),
    ),
  );
  const [announcement, setAnnouncement] = useState("");
  const sheet = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const dragTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const wide = useRef<boolean | null>(null);
  const floating = compact && !collapsed;
  const sidebarId = `${id}-sidebar`;

  useLayoutEffect(() => {
    if (!shell) return;
    function resize() {
      const width = shell!.clientWidth;
      if (width >= 480) setMobileOpen(false);
      const compact = width >= 480 && width < 640;
      setCompact(compact);
      const nextWide = width >= 760;
      if (wide.current !== nextWide) {
        wide.current = nextWide;
        setCollapsed(!nextWide);
      } else if (compact) setCollapsed(true);
    }
    resize();
    const frame = requestAnimationFrame(() => setHydrating(false));
    const observer = new ResizeObserver(resize);
    observer.observe(shell);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [shell]);
  useEffect(
    () => () => {
      clearTimeout(closeTimer.current);
      clearTimeout(dragTimer.current);
    },
    [],
  );

  function toggle() {
    setCollapsed(!collapsed);
    setAnnouncement(collapsed ? "Sidebar expanded" : "Sidebar collapsed");
  }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        event.key !== "[" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.defaultPrevented ||
        !shell
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.closest(
            '[role="dialog"], [role="menu"], [role="listbox"], [role="combobox"]',
          ))
      )
        return;
      const box = shell.getBoundingClientRect();
      if (!box.width || box.bottom < 0 || box.top > innerHeight) return;
      event.preventDefault();
      if (shell.clientWidth < 480) setMobileOpen(!mobileOpen);
      else toggle();
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  function collapse() {
    setCollapsed(true);
    setAnnouncement("Sidebar collapsed");
  }
  function select(target: string, mobile = false) {
    if (mobile && dragging.current) return;
    onNavigate(target, () => {
      const entry = [
        ...sections.flatMap((section) =>
          section.items.flatMap((entry) => [entry, ...(entry.children ?? [])]),
        ),
        ...footer,
      ].find((entry) => entry.id === target);
      setAnnouncement(`${entry?.label ?? target} opened`);
      if (mobile || floating) {
        clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(
          () => (mobile ? setMobileOpen(false) : setCollapsed(true)),
          reduce ? 0 : 200,
        );
      }
    });
  }
  function group(target: string, mobile = false) {
    if (mobile && dragging.current) return;
    if (collapsed && !mobile) {
      setCollapsed(false);
      setGroups((current) => ({ ...current, [target]: true }));
      setAnnouncement("Sidebar expanded");
    } else setGroups((current) => ({ ...current, [target]: !current[target] }));
  }
  const x = useMotionValue<number | string>("-100%");
  const opacity = useTransform(x, (value) => {
    const width = sheet.current?.offsetWidth || 288;
    const ratio =
      typeof value === "number"
        ? value / width
        : value.endsWith("%")
          ? parseFloat(value) / 100
          : parseFloat(value) / width;
    return Math.min(1, Math.max(0, 1 + (Number.isFinite(ratio) ? ratio : -1)));
  });
  const nav = {
    sections,
    footer,
    name: brand.name,
    baseId: id,
    active,
    open: groups,
    reduce,
  };
  const toggleButton = (
    <div className={styles.skin}>
      <Tip
        side="bottom"
        label={
          <span className={styles.shortcut}>
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            <kbd>[</kbd>
          </span>
        }
      >
        <button
          type="button"
          className={`${styles.iconButton} ${styles.railToggle}`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls={sidebarId}
          aria-keyshortcuts="["
          onClick={toggle}
        >
          <ToggleIcon collapsed={collapsed} reduce={reduce} />
        </button>
      </Tip>
      <button
        ref={menu}
        type="button"
        className={`${styles.iconButton} ${styles.menuButton}`}
        aria-label="Open navigation"
        aria-haspopup="dialog"
        aria-expanded={mobileOpen}
        aria-keyshortcuts="["
        onClick={() => setMobileOpen(true)}
      >
        <ToggleIcon collapsed={false} reduce={reduce} />
      </button>
    </div>
  );
  return (
    <LayoutGroup id={id}>
    <Tooltip.Provider delay={250} closeDelay={0} timeout={300}>
        <section
          ref={setShell}
          className={styles.shell}
          aria-label={`${brand.name} workspace`}
          onKeyDown={(event) => {
            if (event.key === "Escape" && floating && !event.defaultPrevented) {
              event.preventDefault();
              collapse();
            }
          }}
        >
          <motion.div
            className={styles.slot}
            initial={false}
            animate={{ width: compact || collapsed ? 64 : 240 }}
            transition={reduce ? instant : T.spring.smooth}
          >
            <motion.div
              id={sidebarId}
              className={`${styles.skin} ${styles.sidebar}`}
              initial={false}
              animate={{ width: collapsed ? 64 : 240 }}
              transition={reduce ? instant : T.spring.smooth}
              data-collapsed={collapsed || undefined}
              data-floating={floating || undefined}
            >
              <Brand brand={brand} collapsed={collapsed} reduce={reduce} />
              <Navigation
                {...nav}
                variant="side"
                collapsed={collapsed}
                onSelect={(target) => select(target)}
                onGroup={(target) => group(target)}
              />
              <Profile person={person} collapsed={collapsed} reduce={reduce} />
            </motion.div>
          </motion.div>
          <AnimatePresence>
            {floating && (
              <motion.div
                className={`${styles.scrim} ${styles.floatScrim}`}
                aria-hidden="true"
                onClick={collapse}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={
                  reduce ? instant : { duration: 0.24, ease: T.ease.standard }
                }
              />
            )}
          </AnimatePresence>
          <main className={styles.main}>
            {renderHeader(toggleButton)}
            <div className={styles.page}>{children}</div>
          </main>
          <p className={styles.srOnly} role="status" aria-live="polite">
            {announcement}
          </p>
          <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <AnimatePresence>
              {mobileOpen && shell && (
                <Dialog.Portal container={shell} keepMounted>
                  <Dialog.Backdrop
                    render={
                      <motion.div
                        className={styles.scrim}
                        style={{ opacity }}
                      />
                    }
                  />
                  <Dialog.Popup
                    ref={sheet}
                    initialFocus={() =>
                      sheet.current?.querySelector<HTMLElement>(
                        '[aria-current="page"]:not([inert] *)',
                      ) ?? true
                    }
                    finalFocus={menu}
                    aria-describedby={undefined}
                    render={
                      <motion.div
                        className={`${styles.skin} ${styles.sheet}`}
                        style={{ x }}
                        initial={{ x: "-100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "-100%" }}
                        transition={reduce ? instant : T.spring.smooth}
                        drag={!prefersReduced && "x"}
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={{ left: 0.9, right: 0.04 }}
                        dragMomentum={false}
                        onDragStart={() => {
                          dragging.current = true;
                          sheet.current?.setAttribute("data-dragging", "");
                        }}
                        onDragEnd={(_, info) => {
                          sheet.current?.removeAttribute("data-dragging");
                          dragTimer.current = setTimeout(() => {
                            dragging.current = false;
                          }, 0);
                          if (info.offset.x < -72 || info.velocity.x < -480)
                            setMobileOpen(false);
                        }}
                      />
                    }
                  >
                    <Dialog.Title className={styles.srOnly}>
                      Navigation
                    </Dialog.Title>
                    <div className={styles.sheetHead}>
                      <Brand brand={brand} collapsed={false} reduce={reduce} />
                      <Dialog.Close
                        className={styles.iconButton}
                        aria-label="Close navigation"
                      >
                        <X size={18} strokeWidth={1.75} aria-hidden="true" />
                      </Dialog.Close>
                    </div>
                    <Navigation
                      {...nav}
                      variant="sheet"
                      collapsed={false}
                      onSelect={(target) => select(target, true)}
                      onGroup={(target) => group(target, true)}
                    />
                    <Profile
                      person={person}
                      collapsed={false}
                      reduce={reduce}
                    />
                  </Dialog.Popup>
                </Dialog.Portal>
              )}
            </AnimatePresence>
          </Dialog.Root>
        </section>
      </Tooltip.Provider>
    </LayoutGroup>
  );
}
