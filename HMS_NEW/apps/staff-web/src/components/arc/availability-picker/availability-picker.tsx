// Port of the local Arc Pro "availability-picker" reference (components/pro/availability-picker/src/Component.cjs).
// Markup, CSS, day/slot motion and the shared highlights follow the reconstructed source. Binding adaptations: the
// sample meeting, attendees and week become props; slot length is `durationMin`; status copy is a prop; `confirmed`
// may be controlled so the app shows "Confirmed" only after its own operation succeeds; `onSelect` reports a change of
// day or time; `disabled` blocks Confirm while the app cannot act.
// The slots heading carries the display font, tracking and 1.1 line height the demo page gives every h3.
// User-requested deviations (18 Oct 2026): day numbers use --text-lg (the demo's compact size) instead of --text-xl;
// the week strip holds 10 square days; the slot list is replaced by the Arc Pro Booking pill's time step
// (components/pro/booking-pill: `eu` time grid, `.slots`/`.highlight`/`.slot` CSS) - chips with a sliding highlight,
// taken times struck through and arrow-key movement - and the legend by the pill's "N free" count. Times read 12-hour,
// as the pill's default. The pill's panel-entry stagger is not used; the picker's own day slide carries the change.
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, type Variants } from "motion/react";
import { Check } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { motionTokens as T } from "../motion-tokens";
import styles from "./availability-picker.module.css";

export type PickerSlot = { time: string; busy?: string };
export type PickerDay = { id: string; short: string; date: string; full: string; slots: PickerSlot[] };
export type PickerPerson = { name: string; first: string; src?: string };
export type PickerCopy = {
  free: string;
  busy: (who: string) => string;
  conflict: (who: string) => string;
  done: string;
  confirm: string;
  confirmed: string;
  /** Day button label: "Monday, 21 September, 3 times everyone is free". */
  dayOpen: (open: number) => string;
};
const DEFAULT_COPY: PickerCopy = {
  free: "Everyone is free",
  busy: (who) => `${who} is busy`,
  conflict: (who) => `${who} will be asked to move a conflict`,
  done: "Invites sent",
  confirm: "Confirm time",
  confirmed: "Confirmed",
  dayOpen: (n) => `${n} times everyone is free`,
};
export interface AvailabilityPickerProps {
  title: string;
  subtitle: string;
  attendees: PickerPerson[];
  days: PickerDay[];
  weekLabel: string;
  durationMin?: number;
  copy?: PickerCopy;
  confirmed?: boolean;
  disabled?: boolean;
  onSelect?: (selection: { day: string; time: string }) => void;
  onConfirm?: (selection: { day: string; time: string; date: string }) => void;
}

const end = (time: string, minutes: number) => {
  const [h, m] = time.split(":").map(Number),
    total = 60 * h! + m! + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
/** Booking pill `J`: "17:30" -> "5:30 PM". */
const clock = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return `${h! % 12 || 12}:${String(m ?? 0).padStart(2, "0")} ${h! < 12 ? "AM" : "PM"}`;
};
/** Booking pill time step (`eu`): free times are radios, taken ones are struck through; one highlight slides between them. */
function TimeGrid({ slots, value, label, reduced, freeLabel, busyLabel, durationMin, onChange }: {
  slots: PickerSlot[]; value: string; label: string; reduced: boolean; durationMin: number;
  freeLabel: string; busyLabel: (who: string) => string; onChange: (time: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0), y = useMotionValue(0), width = useMotionValue(0), height = useMotionValue(0);
  const placed = useRef(false);
  const index = slots.findIndex((s) => s.time === value && !s.busy),
    first = slots.findIndex((s) => !s.busy);
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid || index < 0) return;
    const place = (jump: boolean) => {
      const el = grid.querySelector<HTMLElement>(`[data-slot="${index}"]`);
      if (!el) return;
      const box = [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight];
      [x, y, width, height].forEach((v, n) => (jump ? v.jump(box[n]!) : animate(v, box[n]!, T.spring.morph)));
    };
    place(!placed.current || reduced);
    placed.current = true;
    let seen = grid.offsetWidth;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (grid.offsetWidth !== seen) { seen = grid.offsetWidth; place(true); }
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [index, reduced, x, y, width, height]);
  const move = (event: KeyboardEvent, from: number) => {
    // The pill steps a row with ArrowUp/Down; the row length is read from the grid, which reflows by width.
    const columns = ref.current ? getComputedStyle(ref.current).gridTemplateColumns.split(" ").length : 4;
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
    let to = -1;
    if (event.key in step) {
      for (let n = from + step[event.key]!; n >= 0 && n < slots.length; n += step[event.key]!) if (!slots[n]!.busy) { to = n; break; }
    } else if (event.key === "Home") to = first;
    else if (event.key === "End") { for (let n = slots.length - 1; n >= 0; n--) if (!slots[n]!.busy) { to = n; break; } }
    else return;
    event.preventDefault();
    if (to < 0) return;
    onChange(slots[to]!.time);
    ref.current?.querySelector<HTMLElement>(`[data-slot="${to}"]`)?.focus();
  };
  return (
    <div ref={ref} className={styles.slots} role="radiogroup" aria-label={label}>
      <motion.span className={styles.highlight} aria-hidden="true" data-hidden={index < 0 || undefined} style={{ x, y, width, height }} />
      {slots.map((s, n) => {
        const checked = n === index;
        return (
          <motion.button
            key={s.time}
            type="button"
            role="radio"
            className={styles.slot}
            data-slot={n}
            aria-checked={checked}
            aria-disabled={s.busy ? true : undefined}
            aria-label={`${clock(s.time)} to ${clock(end(s.time, durationMin))}, ${s.busy ? busyLabel(s.busy) : freeLabel}`}
            tabIndex={checked || (index < 0 && n === first) ? 0 : -1}
            whileTap={s.busy ? undefined : { scale: 0.94 }}
            transition={reduced ? { duration: 0 } : T.spring.snappy}
            onClick={() => { if (!s.busy) onChange(s.time); }}
            onKeyDown={(event) => move(event, n)}
          >
            {clock(s.time)}
          </motion.button>
        );
      })}
    </div>
  );
}
const slide: Variants = {
  enter: (d: number) => ({ opacity: 0, x: 16 * d }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: -16 * d, transition: { duration: T.duration.fast, ease: [...T.ease.standard] } }),
};
const fade: Variants = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0 } } };

export function AvailabilityPicker({ title, subtitle, attendees, days, weekLabel, durationMin = 30, copy = DEFAULT_COPY, confirmed, disabled, onSelect, onConfirm }: AvailabilityPickerProps) {
  const reduce = !!useReducedMotion();
  const id = useId();
  const [dayId, setDayId] = useState(days[0]?.id ?? "");
  const [direction, setDirection] = useState(1);
  const [time, setTime] = useState(() => (days[0]?.slots.find((s) => !s.busy) ?? days[0]?.slots[0])?.time ?? "");
  const [ownConfirmed, setOwnConfirmed] = useState(false);
  const done = confirmed ?? ownConfirmed;
  const day = days.find((d) => d.id === dayId) ?? days[0];
  if (!day) return null;
  const slot = day.slots.find((s) => s.time === time && !s.busy) ?? day.slots.find((s) => !s.busy);
  const value = slot ? `${day.full}, ${clock(slot.time)} to ${clock(end(slot.time, durationMin))}` : day.full;
  const label = done ? copy.done : slot?.busy ? copy.conflict(slot.busy) : copy.free;
  const swap = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 4, filter: `blur(${T.blur.subtle}px)` }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, exit: { opacity: 0, y: -4, filter: `blur(${T.blur.subtle}px)` } };
  const swapT = { duration: reduce ? T.duration.instant : T.duration.fast, ease: [...T.ease.standard] as const };

  return (
    <section className={styles.root} aria-labelledby={`${id}-title`}>
      <div className={styles.picker}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <h2 id={`${id}-title`}>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <div className={styles.attendees} aria-label={`Attendees: ${attendees.map((a) => a.name).join(", ")}`}>
            {attendees.map((a) => <Avatar key={a.name} name={a.name} src={a.src} size="sm" />)}
          </div>
        </header>
        <div className={styles.days} role="group" aria-label={weekLabel}>
          {days.map((d, n) => {
            const selected = d.id === day.id,
              open = d.slots.filter((s) => !s.busy).length;
            return (
              <button
                key={d.id}
                type="button"
                className={styles.day}
                data-selected={selected || undefined}
                aria-pressed={selected}
                aria-label={`${d.full}, ${copy.dayOpen(open)}`}
                onClick={() => {
                  if (d.id === day.id) return;
                  const next = (d.slots.find((s) => !s.busy) ?? d.slots[0])?.time ?? "";
                  setDirection(n > days.findIndex((x) => x.id === day.id) ? 1 : -1);
                  setDayId(d.id);
                  setTime(next);
                  setOwnConfirmed(false);
                  onSelect?.({ day: d.id, time: next });
                }}
              >
                {selected && <motion.span layoutId={`${id}-day`} className={styles.dayHighlight} transition={reduce ? { duration: 0 } : T.spring.snappy} />}
                <span className={styles.dayName}>{d.short}</span>
                <span className={styles.dayDate}>{d.date}</span>
                <span className={styles.dayOpen}>{open} open</span>
              </button>
            );
          })}
        </div>
        <div className={styles.slotsHead}>
          <h3 className={styles.slotsTitle}>
            <span className={styles.swap}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={day.id} {...swap} transition={swapT}>{day.full}</motion.span>
              </AnimatePresence>
            </span>
          </h3>
          <span className={styles.legend}>{day.slots.filter((s) => !s.busy).length} free</span>
        </div>
        <div className={styles.slotsStage}>
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={day.id}
              custom={direction}
              variants={reduce ? fade : slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={reduce ? { duration: T.duration.instant } : { x: T.spring.smooth, opacity: { duration: T.duration.fast } }}
            >
              <TimeGrid
                slots={day.slots}
                value={slot?.time ?? ""}
                label={`Times on ${day.full}`}
                reduced={reduce}
                durationMin={durationMin}
                freeLabel={copy.free}
                busyLabel={copy.busy}
                onChange={(next) => {
                  setTime(next);
                  setOwnConfirmed(false);
                  if (next !== slot?.time) onSelect?.({ day: day.id, time: next });
                }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
        <footer className={styles.footer}>
          <div className={styles.selection}>
            <span className={styles.swap}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={label} className={styles.selectionLabel} {...swap} transition={swapT}>{label}</motion.span>
              </AnimatePresence>
            </span>
            <span className={styles.swap}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.strong key={value} className={styles.selectionValue} {...swap} transition={swapT}>{value}</motion.strong>
              </AnimatePresence>
            </span>
          </div>
          <Button
            variant={done ? "secondary" : "primary"}
            onClick={done || disabled || !slot ? undefined : () => { setOwnConfirmed(true); onConfirm?.({ day: day.id, time: slot.time, date: day.full }); }}
            aria-disabled={done || disabled || !slot || undefined}
            className={styles.confirmButton}
          >
            <span className={styles.swap}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={done ? "done" : "idle"} className={styles.buttonLabel} {...swap} transition={swapT}>
                  {done ? <><Check size={16} aria-hidden="true" />{copy.confirmed}</> : copy.confirm}
                </motion.span>
              </AnimatePresence>
            </span>
          </Button>
          <p className={styles.srOnly} aria-live="polite">{done ? `${copy.confirmed} ${value}.` : ""}</p>
        </footer>
      </div>
    </section>
  );
}

export default AvailabilityPicker;
