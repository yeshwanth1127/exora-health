// Port of the local recreated Arc Pro SupportConversation. Real messages and guarded application
// actions replace its seeded thread, simulated replies, typing and local attachment success.
import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, RotateCcw, Send } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { motionTokens as T } from "../motion-tokens";
import styles from "./support-conversation.module.css";
export type SupportMessage = {
  id: string;
  sender: string;
  outgoing: boolean;
  text: string;
  time: string;
  day: string;
  delivery?: ReactNode;
};
export function SupportConversation({
  title,
  subtitle,
  messages,
  actions,
  resolved,
  onResolve,
  composer,
  notice,
  className = "",
}: {
  title: string;
  subtitle: string;
  messages: SupportMessage[];
  actions?: ReactNode;
  resolved: boolean;
  onResolve?: () => void;
  composer: ReactNode;
  notice?: string;
  className?: string;
}) {
  const reduced = useReducedMotion() ?? false,
    thread = useRef<HTMLDivElement>(null),
    last = messages.at(-1)?.id,
    previous = useRef<string | undefined>(undefined);
  useEffect(() => {
    const node = thread.current;
    if (node && last !== previous.current)
      node.scrollTo({
        top: node.scrollHeight,
        behavior: previous.current && !reduced ? "smooth" : "instant",
      });
    previous.current = last;
  }, [last, reduced]);
  return (
    <section
      className={`arc-demo-scope ${styles.surface} ${styles.whatsapp} ${className}`}
      aria-label={`WhatsApp conversation with ${title}`}
    >
      <header className={styles.header}>
        <Avatar name={title} size="sm" />
        <div className={styles.headerText}>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
        <div className={styles.headerActions}>
          {actions}
          {onResolve && (
            <button
              className={`${styles.resolve} ${resolved ? styles.resolved : ""}`}
              type="button"
              onClick={onResolve}
            >
              {resolved ? (
                <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Check size={14} strokeWidth={1.75} aria-hidden="true" />
              )}
              {resolved ? "Reopen" : "Resolve"}
            </button>
          )}
        </div>
      </header>
      <div
        className={styles.thread}
        ref={thread}
        tabIndex={0}
        aria-label="Conversation messages"
      >
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={!reduced && { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={reduced ? { duration: 0 } : T.spring.gentle}
            >
              {(index === 0 || messages[index - 1].day !== message.day) && (
                <div className={styles.dateDivider}>
                  <span>{message.day}</span>
                </div>
              )}
              <div
                className={`${styles.messageRow} ${message.outgoing ? styles.yours : ""}`}
              >
                <div className={styles.messageBody}>
                  <div className={styles.messageMeta}>
                    <strong>{message.sender}</strong>
                    <span>{message.time}</span>
                  </div>
                  <p>{message.text}</p>
                  {message.delivery && (
                    <span className={styles.delivery}>{message.delivery}</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!messages.length && (
          <p className={styles.dateDivider}>
            No messages in this conversation.
          </p>
        )}
        {notice && <p className={styles.dateDivider}>{notice}</p>}
      </div>
      <AutoHeight>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={resolved ? "closed" : "compose"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduced ? 0 : T.duration.standard,
              ease: [...T.ease.enter],
            }}
          >
            {composer}
          </motion.div>
        </AnimatePresence>
      </AutoHeight>
      <span className={styles.srOnly} role="status" aria-live="polite">
        {messages.at(-1)?.sender}
        {last ? ": " : ""}
        {messages.at(-1)?.text}
      </span>
    </section>
  );
}
function AutoHeight({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null),
    reduced = useReducedMotion() ?? false;
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setHeight(entry.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <motion.div
      className={styles.autoHeight}
      initial={false}
      animate={{ height }}
      transition={reduced ? { duration: 0 } : T.spring.smooth}
    >
      <div ref={ref} className={styles.composeArea}>
        {children}
      </div>
    </motion.div>
  );
}
/** Source composer/suggestion structure, with the existing WhatsApp multiline and length bindings. */
export function ConversationComposer({
  value,
  onChange,
  onSend,
  suggestions,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  suggestions: string[];
  placeholder: string;
  disabled?: boolean;
}) {
  const id = useId(),
    field = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const node = field.current;
    if (node) {
      node.style.height = "auto";
      node.style.height = `${Math.min(node.scrollHeight, 144)}px`;
    }
  }, [value]);
  return (
    <>
      <div className={styles.suggestions}>
        {suggestions.filter(Boolean).map((reply) => (
          <button
            key={reply}
            type="button"
            disabled={disabled}
            onClick={() => onChange(reply)}
          >
            {reply}
          </button>
        ))}
      </div>
      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && value.trim()) onSend();
        }}
      >
        <label className={styles.srOnly} htmlFor={id}>
          Reply
        </label>
        <textarea
          ref={field}
          id={id}
          rows={1}
          maxLength={4096}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (!disabled && value.trim()) onSend();
            }
          }}
        />
        <button
          type="submit"
          className={styles.send}
          disabled={disabled || !value.trim()}
          aria-label="Queue message in preview"
        >
          <Send size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </form>
    </>
  );
}
