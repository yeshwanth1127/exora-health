"use client";
import { useEffect } from "react";

export type RTMenu = { trigger: string; hoverOpen: boolean; gap: number; align: "left" | "right"; html: string };

/** Captured panels with shared trigger ownership and viewport-aware placement. */
export default function DropdownMenu({ menus }: { menus: RTMenu[] }) {
  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;
    const triggers = new Set<HTMLElement>();
    const closers: Array<() => void> = [];
    for (const m of menus) {
      const anchor = m.trigger.startsWith('label:') ? Array.from(document.querySelectorAll<HTMLElement>('nav button')).find(b => b.textContent?.trim() === m.trigger.slice(6)) : document.querySelector<HTMLElement>('[data-ditto-id="' + m.trigger + '"]');
      const trig = anchor?.closest<HTMLElement>('button, [role="button"]') ?? anchor;
      if (!trig || triggers.has(trig)) continue;
      triggers.add(trig);
      trig.setAttribute('aria-expanded', 'false');
      let panel: HTMLElement | null = null;
      const isNav = Boolean(trig.closest('nav'));
      const place = () => {
        if (!panel) return;
        const r = trig.getBoundingClientRect();
        panel.style.position = 'fixed';
        panel.style.maxWidth = 'calc(100vw - 32px)';
        const width = panel.getBoundingClientRect().width;
        const left = isNav ? (innerWidth - width) / 2 : m.align === 'right' ? r.right - width : r.left;
        panel.style.left = Math.max(16, Math.min(left, innerWidth - width - 16)) + 'px';
        panel.style.right = 'auto';
        panel.style.top = r.bottom + m.gap + 'px';
        if (panel.dataset.productShowcase) panel.style.maxHeight = Math.max(180, innerHeight - r.bottom - m.gap - 16) + 'px';
        panel.style.zIndex = '9999';
      };
      const close = () => {
        panel?.remove();
        panel = null;
        trig.setAttribute('aria-expanded', 'false');
      };
      closers.push(close);
      const open = () => {
        if (panel) return;
        closers.forEach(closeOther => closeOther());
        const wrap = document.createElement('div');
        wrap.innerHTML = m.html;
        panel = wrap.firstElementChild as HTMLElement | null;
        if (!panel) return;
        panel.dataset.captureMenu = 'true';
        if (panel.id) trig.setAttribute('aria-controls', panel.id);
        panel.addEventListener('click', event => {
          if ((event.target as Element).closest('a[href]')) close();
        }, { signal });
        document.body.appendChild(panel);
        place();
        trig.setAttribute('aria-expanded', 'true');
      };
      trig.addEventListener('click', e => { e.preventDefault(); panel ? close() : open(); }, { signal });
      trig.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') {
          e.preventDefault(); open(); panel?.querySelector<HTMLElement>('a[href],button')?.focus();
        }
      }, { signal });
      if (m.hoverOpen) {
        trig.addEventListener('mouseenter', open, { signal });
        document.addEventListener('pointermove', e => {
          const t = e.target as Node;
          if (panel && !trig.contains(t) && !panel.contains(t)) close();
        }, { signal });
      }
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && panel) { close(); trig.focus(); }
      }, { signal });
      document.addEventListener('click', e => {
        const t = e.target as Node;
        if (panel && !trig.contains(t) && !panel.contains(t)) close();
      }, { signal });
      document.addEventListener('focusin', e => {
        const t = e.target as Node;
        if (panel && !trig.contains(t) && !panel.contains(t)) close();
      }, { signal });
      window.addEventListener('resize', place, { signal });
      window.addEventListener('scroll', place, { passive: true, signal });
    }
    return () => { ac.abort(); closers.forEach(close => close()); };
  }, [menus]);
  return null;
}
