"use client";

import confetti from "canvas-confetti";
import { useEffect, useRef, useState } from "react";

// One celebration per offer reveal, with its own canvas and unmount cleanup.
export default function QuoteCelebration() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || !canvas.current) { setActive(false); return; }
    const fire = confetti.create(canvas.current, { resize: true });
    let cancelled = false;
    const stop = () => { cancelled = true; fire.reset(); setActive(false); };
    const changed = () => { if (preference.matches) stop(); };
    const timer = setTimeout(() => {
      const options = {
        particleCount: 65, spread: 65, startVelocity: 42, gravity: .85,
        decay: .94, ticks: 180, scalar: .85, disableForReducedMotion: true,
        colors: ["#7860d3", "#b7a0ec", "#db9fb8", "#dcad69"],
      };
      Promise.all([
        fire({ ...options, angle: 65, origin: { x: .18, y: .55 } }),
        fire({ ...options, angle: 115, origin: { x: .82, y: .55 } }),
      ]).then(() => { if (!cancelled) setActive(false); });
    }, 180);
    preference.addEventListener("change", changed);
    return () => {
      cancelled = true; clearTimeout(timer); fire.reset();
      preference.removeEventListener("change", changed);
    };
  }, []);

  return active ? <canvas ref={canvas} className="quote-confetti" aria-hidden="true" /> : null;
}
