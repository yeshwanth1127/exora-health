"use client";
import { useEffect } from 'react';
import DropdownMenu, { type RTMenu } from './ditto/DropdownMenu';
import { brandContent } from "../lib/brand";
import referenceMenus from './reference-menus.json';

/** Local media controls and truthful, disconnected reference forms. */
export default function ReferenceInteractions() {
  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;
    for (const video of document.querySelectorAll('video')) {
      const button = video.parentElement?.querySelector('button');
      const update = () => {
        if (!button) return;
        button.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
        button.setAttribute('aria-pressed', String(!video.paused));
      };
      video.addEventListener('play', update, { signal });
      video.addEventListener('pause', update, { signal });
      if (button) button.addEventListener('click', () => {
        if (video.paused) void video.play().catch(update); else video.pause();
      }, { signal });
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) video.pause();
      update();
    }
    for (const carousel of document.querySelectorAll('[aria-roledescription="carousel"]')) {
      const slides = Array.from(carousel.querySelectorAll<HTMLElement>('[aria-roledescription="slide"]'));
      if (slides.length < 2) continue;
      let index = Math.max(0, slides.findIndex(s => s.getAttribute('aria-hidden') === 'false'));
      const select = (next: number) => {
        index = (next + slides.length) % slides.length;
        slides.forEach((slide, i) => { slide.style.opacity = i === index ? '1' : '0'; slide.style.pointerEvents = i === index ? 'auto' : 'none'; slide.setAttribute('aria-hidden',String(i !== index)); });
      };
      carousel.querySelector('[aria-label="next"]')?.addEventListener('click', () => select(index+1), { signal });
      carousel.querySelector('[aria-label="previous"]')?.addEventListener('click', () => select(index-1), { signal });
    }
    const billing = document.querySelectorAll<HTMLInputElement>('input[name="billingInterval"]');
    if (billing.length) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const prices: Array<{ node: Node; year: string }> = [];
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent?.trim();
        if (text === '$10' || text === '$20') prices.push({ node: walker.currentNode, year: text });
      }
      billing.forEach(input => input.addEventListener('change', () => {
        const monthly = input.value === 'month';
        for (const price of prices) price.node.textContent = monthly ? price.year === '$10' ? '$12' : '$24' : price.year;
      }, { signal }));
    }
    for (const form of document.querySelectorAll('form')) {
      if(form.closest('.quote-page,.capture-account-page')) continue;
      form.addEventListener('submit', event => {
        event.preventDefault();
        let status = form.querySelector('[data-reference-form-status]');
        if (!status) {
          status = document.createElement('p');
          status.setAttribute('data-reference-form-status','true');
          status.setAttribute('role','status');
          form.appendChild(status);
        }
        status.textContent = 'Your request has not been sent. Online demo requests are not connected yet.';
      }, { signal });
    }
    return () => ac.abort();
  }, []);
  return <DropdownMenu menus={brandContent(referenceMenus) as RTMenu[]} />;
}
