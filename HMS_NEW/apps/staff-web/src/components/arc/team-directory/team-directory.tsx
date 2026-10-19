// Port of the local Arc Pro "team-directory" reference (components/pro/team-directory/src/Component.cjs).
// Markup, filtering, copy feedback and motion follow the reconstructed source. Binding adaptations: the demo's
// six sample people become the `people` prop, its fixed Working on / Location rows become `facts`, team filters are
// derived from the people given, and `actions` renders existing app actions under the profile.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { Check, Copy, Search, X } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { motionTokens as T } from "../motion-tokens";
import styles from "./team-directory.module.css";

export type DirectoryPerson = {
  id: string;
  name: string;
  role: string;
  team: string;
  available: boolean;
  /** Status text beside the dot; the demo's Available / Away. */
  statusLabel?: string;
  about?: string;
  facts?: { label: string; value: ReactNode }[];
  email?: string | null;
  photo?: string;
  /** Extra text matched by search, beyond name, role and team. */
  keywords?: string;
};

export type TeamDirectoryProps = {
  people: DirectoryPerson[];
  title?: string;
  searchPlaceholder?: string;
  filterLabel?: string;
  onPersonSelect?: (person: { id: string; name: string; team: string }) => void;
  actions?: (person: DirectoryPerson) => ReactNode;
};

type CopyState = "idle" | "copied" | "error";

export function TeamDirectory({
  people,
  title = "People",
  searchPlaceholder = "Search name, role, city",
  filterLabel = "Filter by team",
  onPersonSelect,
  actions,
}: TeamDirectoryProps) {
  const id = useId();
  const reduce = useReducedMotion();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("All");
  const [selected, setSelected] = useState(people[0]?.id ?? "");
  const [copy, setCopy] = useState<CopyState>("idle");
  const teams = ["All", ...new Set(people.map((p) => p.team))];
  const activeTeam = teams.includes(team) ? team : "All";
  const q = query.trim().toLowerCase();
  const shown = people.filter((p) => {
    const inTeam = activeTeam === "All" || p.team === activeTeam;
    const text = `${p.name} ${p.role} ${p.team} ${p.keywords ?? ""}`.toLowerCase();
    return inTeam && text.includes(q);
  });
  const person = shown.find((p) => p.id === selected) ?? shown[0];

  async function copyEmail() {
    if (!person?.email) return;
    try {
      await navigator.clipboard.writeText(person.email);
      setCopy("copied");
    } catch {
      setCopy("error");
    }
  }
  useEffect(() => {
    if (copy === "idle") return;
    const t = window.setTimeout(() => setCopy("idle"), 1800);
    return () => window.clearTimeout(t);
  }, [copy]);
  const layout = reduce ? { duration: 0 } : T.spring.smooth;

  return (
    <section className={styles.directory} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <h2 id={`${id}-title`}>
          {title} <span className={styles.count}>{people.length}</span>
        </h2>
        <label className={styles.search}>
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.srOnly}>Search people</span>
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCopy("idle"); }}
            onKeyDown={(e) => { if (e.key === "Escape" && query) { e.preventDefault(); setQuery(""); } }}
            placeholder={searchPlaceholder}
          />
          <span className={styles.clearSlot}>
            {query && (
              <button type="button" onClick={() => { setQuery(""); input.current?.focus(); }} aria-label="Clear search">
                <X size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            )}
          </span>
        </label>
      </header>
      <div className={styles.filters} role="group" aria-label={filterLabel}>
        {teams.map((t) => {
          const count = t === "All" ? people.length : people.filter((p) => p.team === t).length;
          return (
            <button key={t} type="button" aria-pressed={activeTeam === t} onClick={() => { setTeam(t); setCopy("idle"); }}>
              {activeTeam === t && (
                <motion.span layoutId={`${id}-filter`} className={styles.filterHighlight} transition={reduce ? { duration: 0 } : T.spring.morph} aria-hidden="true" />
              )}
              <span className={styles.filterLabel}>
                {t}
                <span className={styles.filterCount}>{count}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.body}>
        <div className={styles.listPane}>
          <ul className={styles.peopleList} aria-label="Team members">
            <AnimatePresence mode="popLayout" initial={false}>
              {shown.map((p) => {
                const current = person?.id === p.id;
                return (
                  <motion.li
                    key={p.id}
                    layout={!reduce && "position"}
                    initial={!reduce && { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: reduce ? 0 : T.duration.exit } }}
                    transition={{ layout, opacity: { duration: reduce ? 0 : T.duration.fast } }}
                  >
                    <button
                      type="button"
                      className={styles.personRow}
                      aria-pressed={current}
                      onClick={() => {
                        setSelected(p.id);
                        setCopy("idle");
                        onPersonSelect?.({ id: p.id, name: p.name, team: p.team });
                      }}
                    >
                      {current && <RowHighlight layoutId={`${id}-row-${activeTeam}-${q}`} reduce={!!reduce} />}
                      <Avatar name={p.name} src={p.photo} status={p.available ? "online" : "offline"} />
                      <span className={styles.personText}>
                        <span className={styles.personName}>{p.name}</span>
                        <span className={styles.personRole}>{p.role}</span>
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          {shown.length === 0 && (
            <div className={styles.empty}>
              <p>No one matches{q ? ` “${query.trim()}”` : ""}</p>
              <button type="button" onClick={() => { setQuery(""); setTeam("All"); setCopy("idle"); input.current?.focus(); }}>
                Clear filters
              </button>
            </div>
          )}
        </div>
        <motion.div className={styles.detailPane} layout={!reduce && "position"} transition={{ layout }} aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            {person ? (
              <motion.article
                key={person.id}
                className={styles.profile}
                initial={!reduce && { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: reduce ? 0 : T.duration.exit, ease: [...T.ease.standard] } }}
                transition={{ duration: reduce ? 0 : T.duration.standard, ease: [...T.ease.enter] }}
                aria-label={`${person.name}, ${person.role}`}
              >
                <div className={styles.profileTop}>
                  <Avatar name={person.name} src={person.photo} size="lg" />
                  <div className={styles.profileIdentity}>
                    <h3>{person.name}</h3>
                    <p>{person.role}</p>
                  </div>
                </div>
                {person.about && <p className={styles.about}>{person.about}</p>}
                <dl className={styles.facts}>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <span className={styles.dot} data-available={person.available || undefined} aria-hidden="true" />
                      {person.statusLabel ?? (person.available ? "Available" : "Away")}
                    </dd>
                  </div>
                  <div>
                    <dt>Team</dt>
                    <dd>{person.team}</dd>
                  </div>
                  {person.facts?.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                  {person.email && (
                    <div className={styles.contactRow}>
                      <dt>Email</dt>
                      <dd>
                        <a href={`mailto:${person.email}`}>{person.email}</a>
                        <button
                          type="button"
                          className={styles.copy}
                          data-state={copy}
                          onClick={() => void copyEmail()}
                          aria-label={copy === "copied" ? "Email copied" : "Copy email address"}
                        >
                          <span className={styles.copyIcon} aria-hidden="true">
                            <Copy size={14} strokeWidth={1.75} data-on={copy !== "copied" || undefined} />
                            <Check size={14} strokeWidth={2} data-on={copy === "copied" || undefined} />
                          </span>
                          <span className={styles.copyLabel}>{copy === "copied" ? "Copied" : copy === "error" ? "Retry" : "Copy"}</span>
                        </button>
                      </dd>
                    </div>
                  )}
                </dl>
                {actions?.(person)}
                <span className={styles.srOnly} role="status">
                  {copy === "copied" ? "Email address copied" : copy === "error" ? "Copy failed. Try again." : ""}
                </span>
              </motion.article>
            ) : (
              <motion.div
                key="none"
                className={styles.noProfile}
                initial={!reduce && { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: reduce ? 0 : T.duration.exit } }}
                transition={{ duration: reduce ? 0 : T.duration.standard, ease: [...T.ease.standard] }}
              >
                <p>Nobody selected</p>
                <span>Clear your search to see the team.</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

function RowHighlight({ layoutId, reduce }: { layoutId: string; reduce: boolean }) {
  return useIsPresent() ? (
    <motion.span layoutId={layoutId} className={styles.rowHighlight} transition={reduce ? { duration: 0 } : T.spring.morph} aria-hidden="true" />
  ) : null;
}
