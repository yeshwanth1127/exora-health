"use client";
import { useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./progress-donut.module.css";

/** User-requested single-value companion to the local Arc donut chart. */
export function ProgressDonut({ value, label, detail }: { value: number | null; label: string; detail: string }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: .5 });
  const reduced = useReducedMotion();
  const count = useMotionValue(0);
  const progress = useTransform(count, number => Math.min(1, Math.max(0, number / 100)));
  const digits = useTransform(count, number => String(Math.round(number)));
  const safe = value === null ? null : Math.min(100, Math.max(0, value));
  useEffect(() => {
    if (safe === null || !inView) return;
    if (reduced) { count.jump(safe); return; }
    const animation = animate(count, safe, { ...motionTokens.spring.smooth, visualDuration: motionTokens.duration.considered * 1.6 });
    return () => animation.stop();
  }, [count, inView, reduced, safe]);
  const tone = safe === null ? "unknown" : safe < 50 ? "danger" : safe < 80 ? "warning" : "success";
  return <figure ref={ref} className={[styles.figure, styles[tone]].join(" ")}>
    <div className={styles.visual} role={safe === null ? "img" : "meter"} aria-label={safe === null ? `${label}: not assessed` : label} aria-valuenow={safe ?? undefined} aria-valuemin={safe === null ? undefined : 0} aria-valuemax={safe === null ? undefined : 100} aria-valuetext={safe === null ? undefined : `${safe} out of 100`}>
      <svg viewBox="0 0 96 96" aria-hidden="true"><circle className={styles.track} cx="48" cy="48" r="40" />{safe !== null && <motion.circle className={styles.arc} cx="48" cy="48" r="40" style={{ pathLength: progress }} />}</svg>
      <span className={styles.number} aria-hidden="true">{safe === null ? "—" : <motion.span>{digits}</motion.span>}</span>
    </div>
    <figcaption><strong>{label}</strong><span>{detail}</span></figcaption>
  </figure>;
}
