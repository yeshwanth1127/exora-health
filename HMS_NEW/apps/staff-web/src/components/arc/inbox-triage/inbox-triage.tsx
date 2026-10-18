// Port of the local Arc Pro "inbox-triage" reference (components/pro/inbox-triage/src/Component.cjs). Markup, CSS,
// keyboard (arrows, Enter/Space, E/S/U), focus hand-off, undo and motion follow the reconstructed source. Binding
// adaptations: the six sample messages become `messages` (re-synced when the app's list changes), the hard-coded
// heading, folder names and copy become props, moves and reads call `onMove` / `onRead`, and `detailAction` renders an
// app action after the move buttons (deviation, listed in the manifest).
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Archive, Clock3, RotateCcw } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { motionTokens as T } from "../motion-tokens";
import styles from "./inbox-triage.module.css";

export type TriageFolder = "inbox" | "snoozed" | "archive";
export type TriageMessage = {
  id: string;
  name: string;
  photo?: string;
  subject: string;
  preview: string;
  body: string;
  time: string;
  folder: TriageFolder;
  unread: boolean;
};
type Empty = { title: string; body: string; action: string };
export type TriageCopy = {
  folders: Record<TriageFolder, string>;
  /** Footer status after a move, by destination. */
  moved: Record<TriageFolder, string>;
  actions: { snooze: string; archive: string; restore: string };
  empty: { unread: Empty; inbox: Empty; snoozed: Empty; archive: Empty };
  /** Footer hint on narrow containers. */
  narrowHint: { inbox: string; other: string };
};
const DEFAULT_COPY: TriageCopy = {
  folders: { inbox: "Inbox", snoozed: "Snoozed", archive: "Archive" },
  moved: { inbox: "Moved to Inbox", snoozed: "Snoozed", archive: "Archived" },
  actions: { snooze: "Snooze", archive: "Archive", restore: "Move to Inbox" },
  empty: {
    unread: { title: "Nothing unread", body: "You are caught up.", action: "Show all" },
    inbox: { title: "Inbox zero", body: "Archived messages stay searchable.", action: "View archive" },
    snoozed: { title: "Nothing snoozed", body: "Snoozed messages wait here until you bring them back.", action: "Back to inbox" },
    archive: { title: "Archive is empty", body: "Messages you archive land here.", action: "Back to inbox" },
  },
  narrowHint: { inbox: "Open a message to snooze or archive it", other: "Open a message to move it" },
};
const FOLDERS: TriageFolder[] = ["inbox", "snoozed", "archive"];

export interface InboxTriageProps {
  title?: string;
  messages: TriageMessage[];
  copy?: TriageCopy;
  onMove?: (message: TriageMessage, to: TriageFolder) => void;
  onRead?: (message: TriageMessage) => void;
  detailAction?: (message: TriageMessage) => ReactNode;
}

export function InboxTriage({ title = "Messages", messages, copy = DEFAULT_COPY, onMove, onRead, detailAction }: InboxTriageProps) {
  const id = useId();
  const reduce = !!useReducedMotion();
  const [items, setItems] = useState(messages);
  const [synced, setSynced] = useState(messages);
  if (messages !== synced) { setSynced(messages); setItems(messages); }
  const [folder, setFolder] = useState<TriageFolder>("inbox");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [last, setLast] = useState<{ id: string; subject: string; from: TriageFolder; to: TriageFolder; unread: boolean } | null>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const heading = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef<string | null>(null);
  const shown = items.filter((m) => m.folder === folder && (folder !== "inbox" || !unreadOnly || m.unread));
  const unread = items.filter((m) => m.folder === "inbox" && m.unread).length;
  const spring = reduce ? { duration: 0 } : T.spring.smooth;

  function move(m: TriageMessage, to: TriageFolder) {
    const index = shown.findIndex((x) => x.id === m.id),
      next = shown[index + 1] ?? shown[index - 1];
    setItems((all) => all.map((x) => (x.id === m.id ? { ...x, folder: to, unread: to === "inbox" && x.unread } : x)));
    setLast({ id: m.id, subject: m.subject, from: m.folder, to, unread: m.unread });
    setOpenId(null);
    focusNext.current = next ? next.id : "title";
    onMove?.(m, to);
  }
  function show(f: TriageFolder) {
    setFolder(f);
    setOpenId(null);
  }
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    if (target === "title") heading.current?.focus();
    else rows.current.get(target)?.focus();
  });
  const archive = { key: "archive", label: copy.actions.archive, shortcut: "E", icon: Archive, to: "archive" as const };
  const actions =
    folder === "inbox"
      ? [{ key: "snooze", label: copy.actions.snooze, shortcut: "S", icon: Clock3, to: "snoozed" as const }, archive]
      : [{ key: "restore", label: copy.actions.restore, shortcut: "U", icon: RotateCcw, to: "inbox" as const }, ...(folder === "snoozed" ? [archive] : [])];
  const empty = folder === "inbox" && unreadOnly ? copy.empty.unread : copy.empty[folder];

  return (
    <section className={styles.triage} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{title}</h2>
          <span className={styles.unreadCount}>{unread} unread</span>
          <button type="button" className={styles.filter} aria-pressed={unreadOnly} disabled={folder !== "inbox"} onClick={() => { setUnreadOnly((v) => !v); setOpenId(null); }}>
            <span className={styles.filterDot} aria-hidden="true" />
            Unread only
          </button>
        </div>
        <div
          className={styles.tabs}
          role="tablist"
          aria-label="Folders"
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const at = FOLDERS.indexOf(folder),
              next = FOLDERS[(at + (e.key === "ArrowRight" ? 1 : FOLDERS.length - 1)) % FOLDERS.length]!;
            show(next);
            e.currentTarget.querySelector<HTMLElement>(`[data-folder="${next}"]`)?.focus();
          }}
        >
          {FOLDERS.map((f) => {
            const selected = f === folder;
            return (
              <button key={f} type="button" role="tab" data-folder={f} aria-selected={selected} aria-controls={`${id}-list`} tabIndex={selected ? 0 : -1} className={styles.tab} onClick={() => show(f)}>
                {copy.folders[f]}
                <span className={styles.tabCount}>{items.filter((m) => m.folder === f).length}</span>
                {selected && <motion.span layoutId={`${id}-tab`} className={styles.tabIndicator} transition={reduce ? { duration: 0 } : T.spring.snappy} />}
              </button>
            );
          })}
        </div>
      </header>
      <div id={`${id}-list`} className={styles.list} role="tabpanel" aria-label={`${copy.folders[folder]} messages`}>
        <motion.div key={folder} className={styles.panel} initial={!reduce && { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : T.duration.fast }}>
          <AnimatePresence initial={false}>
            {shown.map((m) => {
              const open = openId === m.id;
              return (
                <motion.article
                  key={m.id}
                  className={`${styles.message} ${m.unread ? styles.unread : ""} ${open ? styles.open : ""}`}
                  initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                  transition={spring}
                >
                  <div className={styles.row}>
                    <button
                      ref={(node) => { if (node) rows.current.set(m.id, node); else rows.current.delete(m.id); }}
                      className={styles.trigger}
                      type="button"
                      aria-expanded={open}
                      aria-controls={open ? `${id}-${m.id}-detail` : undefined}
                      aria-keyshortcuts={folder === "inbox" ? "E S" : folder === "snoozed" ? "U E" : "U"}
                      onClick={() => {
                        if (openId === m.id) return setOpenId(null);
                        setOpenId(m.id);
                        if (m.unread) {
                          setItems((all) => all.map((x) => (x.id === m.id ? { ...x, unread: false } : x)));
                          onRead?.(m);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.metaKey || e.ctrlKey || e.altKey) return;
                        const key = e.key.toLowerCase();
                        if (key === "arrowdown" || key === "arrowup") {
                          e.preventDefault();
                          const next = shown[shown.findIndex((x) => x.id === m.id) + (key === "arrowdown" ? 1 : -1)];
                          if (next) rows.current.get(next.id)?.focus();
                        } else if (key === "e" && folder !== "archive") { e.preventDefault(); move(m, "archive"); }
                        else if (key === "s" && folder === "inbox") { e.preventDefault(); move(m, "snoozed"); }
                        else if (key === "u" && folder !== "inbox") { e.preventDefault(); move(m, "inbox"); }
                      }}
                    >
                      <span className={styles.dot} aria-hidden="true" />
                      <Avatar name={m.name} src={m.photo} size="sm" className={styles.avatar} />
                      <span className={styles.sender}>
                        {m.name}
                        {m.unread && <span className={styles.srOnly}>, unread</span>}
                      </span>
                      <span className={styles.summary}>
                        <span className={styles.subject}>{m.subject}</span>
                        <span className={styles.preview}>{m.preview}</span>
                      </span>
                      <time className={styles.time}>{m.time}</time>
                    </button>
                    <span className={styles.quick}>
                      {actions.map((a) => (
                        <button key={a.key} type="button" className={styles.quickButton} aria-label={`${a.label}: ${m.subject}`} title={`${a.label} (${a.shortcut})`} tabIndex={-1} onClick={() => move(m, a.to)}>
                          <a.icon size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      ))}
                    </span>
                  </div>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        id={`${id}-${m.id}-detail`}
                        className={styles.detail}
                        initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                        transition={spring}
                      >
                        <div className={styles.detailInner}>
                          <p>{m.body}</p>
                          <div className={styles.detailActions}>
                            {actions.map((a, n) => (
                              <Button key={a.key} type="button" variant={n === 0 ? "secondary" : "ghost"} size="sm" onClick={() => move(m, a.to)}>
                                <a.icon size={15} strokeWidth={1.75} aria-hidden="true" />
                                {a.label}
                                <kbd className={styles.kbd}>{a.shortcut}</kbd>
                              </Button>
                            ))}
                            {detailAction?.(m)}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {shown.length === 0 && (
              <motion.div
                key="empty"
                className={styles.empty}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: reduce ? 0 : T.duration.exit } }}
                transition={{ duration: reduce ? 0 : T.duration.standard, ease: T.ease.standard }}
              >
                <p>{empty.title}</p>
                <span>{empty.body}</span>
                <Button type="button" variant="secondary" size="sm" onClick={() => (folder === "inbox" && unreadOnly ? setUnreadOnly(false) : show(folder === "inbox" ? "archive" : "inbox"))}>
                  {empty.action}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <footer className={styles.footer}>
        <p role="status" aria-live="polite" className={styles.status}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={last ? `${last.id}-${last.to}` : "idle"}
              className={styles.statusText}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6, transition: { duration: T.duration.fast } }}
              transition={reduce ? { duration: 0 } : T.spring.snappy}
            >
              {last ? (
                <>
                  {copy.moved[last.to]} <span className={styles.statusSubject}>{last.subject}</span>
                </>
              ) : (
                <>
                  <span className={styles.hint}>
                    {actions.map((a) => (
                      <span key={a.key}>
                        <kbd className={styles.kbd}>{a.shortcut}</kbd>
                        {a.label.toLowerCase()}
                      </span>
                    ))}
                  </span>
                  <span className={styles.hintNarrow}>{folder === "inbox" ? copy.narrowHint.inbox : copy.narrowHint.other}</span>
                </>
              )}
            </motion.span>
          </AnimatePresence>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={styles.undo}
          onClick={() => {
            if (!last) return;
            const m = items.find((x) => x.id === last.id);
            setItems((all) => all.map((x) => (x.id === last.id ? { ...x, folder: last.from, unread: last.unread } : x)));
            if (last.from !== folder) setFolder(last.from);
            setLast(null);
            focusNext.current = last.id;
            if (m) onMove?.({ ...m, folder: last.to }, last.from);
          }}
          disabled={!last}
          aria-hidden={!last}
          tabIndex={last ? 0 : -1}
        >
          <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
          Undo
        </Button>
      </footer>
    </section>
  );
}

export default InboxTriage;
