// Port of the local Arc Pro "release-readiness" reference (components/pro/release-readiness/src/Component.cjs).
// Layout, progress, message and motion follow the reconstructed source. User-approved binding adaptations
// (18 Oct 2026): checks come from `tasks` and are read-only because the server decides them; each task may carry
// an app action; the final action is supplied by the host and is not gated on completion; the notify switch and
// owner avatars are omitted when no app meaning exists; `headerAction`/`toolbar`/`collapsed` host existing guide controls.
import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Checkbox } from "../checkbox/checkbox";
import { Button } from "../button/button";
import { motionTokens as T } from "../motion-tokens";
import styles from "./release-readiness.module.css";

export type ReadinessTask = { id: string; label: string; detail: string; done: boolean; action?: ReactNode };

export type ReleaseReadinessProps = {
  title: string;
  subtitle?: ReactNode;
  tasks: ReadinessTask[];
  tasksLabel?: string;
  readyLabel?: string;
  actionLabel: ReactNode;
  /** Awaited; a thrown error shows the inline alert. The resolved string is shown as the success message. */
  onAction: () => Promise<string>;
  errorMessage?: string;
  headerAction?: ReactNode;
  toolbar?: ReactNode;
  collapsed?: boolean;
};

export function ReleaseReadiness({
  title, subtitle, tasks, tasksLabel = "Before you ship", readyLabel = "Ready to ship", actionLabel, onAction,
  errorMessage = "The release could not be started. Try again.", headerAction, toolbar, collapsed = false,
}: ReleaseReadinessProps) {
  const id = useId();
  const reduce = !!useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const done = tasks.filter((t) => t.done).length;
  const left = tasks.length - done;
  async function run() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      setSuccess(await onAction());
    } catch {
      setError(errorMessage);
    } finally {
      setBusy(false);
    }
  }
  const message = error || success;
  return (
    <section className={styles.release} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h2 id={`${id}-title`}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {headerAction && <div className={styles.owners}>{headerAction}</div>}
      </header>
      <div className={styles.progress}>
        <div className={styles.progressMeta}>
          <span aria-live="polite">{left ? `${left} ${left === 1 ? "check" : "checks"} left` : readyLabel}</span>
          <span className={styles.count}>{done} of {tasks.length}</span>
        </div>
        <div className={styles.track} role="progressbar" aria-label="Readiness" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={done}>
          <span
            className={styles.fill}
            data-complete={(tasks.length > 0 && done === tasks.length) || undefined}
            style={{ transform: `translateX(${((tasks.length ? done / tasks.length : 0) - 1) * 100}%)` }}
          />
        </div>
      </div>
      {!collapsed && (
        <>
          {toolbar && <div className={styles.toolbar}>{toolbar}</div>}
          <ul className={styles.tasks} aria-label={tasksLabel}>
            {tasks.map((t) => (
              <li key={t.id} className={styles.task} data-done={t.done || undefined} data-has-action={!!t.action || undefined}>
                <Checkbox
                  id={`${id}-${t.id}`}
                  checked={t.done}
                  onCheckedChange={() => {}}
                  aria-readonly="true"
                  aria-label={t.label}
                  aria-describedby={`${id}-${t.id}-detail`}
                />
                <label htmlFor={`${id}-${t.id}`} className={styles.taskCopy}>
                  <span className={styles.taskLabel}>{t.label}</span>
                  <span id={`${id}-${t.id}-detail`} className={styles.taskDetail}>{t.detail}</span>
                </label>
                {t.action && <div className={styles.taskAction}>{t.action}</div>}
              </li>
            ))}
          </ul>
          <footer className={styles.footer}>
            <div className={styles.footerActions}>
              <Button size="sm" loading={busy} onClick={() => void run()}>{actionLabel}</Button>
            </div>
          </footer>
          <AnimatePresence initial={false}>
            {message && (
              <motion.div
                key="message"
                className={styles.message}
                initial={!reduce && { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                transition={reduce ? { duration: 0 } : { height: T.spring.smooth, opacity: { duration: T.duration.fast, ease: [...T.ease.standard] } }}
              >
                <p className={error ? styles.error : styles.success} role={error ? "alert" : "status"}>{message}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </section>
  );
}
