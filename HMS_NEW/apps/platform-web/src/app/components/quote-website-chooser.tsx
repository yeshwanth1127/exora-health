"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { websiteApproaches, websiteOptions, websiteTemplates, type WizardDraft } from "../../lib/quote-wizard";

const palettes = [
  ["#eeecf6", "#7c6ca5", "#d6cdea"], ["#f0f2e5", "#7f8c55", "#d5dcba"],
  ["#e9f1f6", "#5b819f", "#c7dbe8"], ["#f4f2ee", "#918979", "#dfd9ce"],
  ["#f7edf3", "#a66a8d", "#e8cadd"], ["#eaf0f0", "#57797b", "#cad6d7"],
  ["#f2eee5", "#77866b", "#d9d3bd"], ["#ebf2ed", "#3e6859", "#c4d9cd"],
  ["#f8ece7", "#a46754", "#e8cbbf"],
];

function Preview({ index, category }: { index: number; category: string }) {
  const offset = category === "hospital" ? 2 : category === "specialist" ? 1 : 0;
  const [background, ink, soft] = palettes[(index + offset) % palettes.length];
  return <span className={`quote-template-preview layout-${index % 3}`} style={{ "--preview-background": background, "--preview-ink": ink, "--preview-soft": soft } as CSSProperties} aria-hidden="true">
    <span className="quote-preview-nav"><i /><span /><span /><span /></span>
    <span className="quote-preview-bento"><span className="quote-preview-hero"><i /><i /><i /><b /></span><span className="quote-preview-feature"><i /></span><span className="quote-preview-block" /><span className="quote-preview-block" /><span className="quote-preview-block" /></span>
  </span>;
}

export default function QuoteWebsiteChooser({ draft, onChange }: {
  draft: WizardDraft; onChange: (values: Partial<WizardDraft>) => void;
}) {
  const category = draft.websiteCategory || (draft.facility === "practice" ? "specialist" : draft.facility) || "specialist";
  const expanded = Boolean(draft.websiteApproach);
  const loadKey = `${draft.websiteApproach}-${category}`;
  const [loadedKey, setLoadedKey] = useState("");
  const loading = expanded && loadedKey !== loadKey;
  useEffect(() => {
    if (!expanded) { setLoadedKey(""); return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setLoadedKey(loadKey); return; }
    const timer = setTimeout(() => setLoadedKey(loadKey), 650);
    return () => clearTimeout(timer);
  }, [expanded, loadKey]);
  return <div className="quote-website-chooser">
    <fieldset className="quote-options quote-website-approaches">
      <legend className="quote-sr-only">Website direction</legend>
      {websiteApproaches.map(option => <label className={`quote-choice ${draft.websiteApproach === option.id ? "is-selected" : ""}`} key={option.id}>
        <input type="radio" name="website-approach" value={option.id} checked={draft.websiteApproach === option.id} onChange={() => onChange({ websiteApproach: option.id, websiteCategory: category, template: "" })} />
        <span className="quote-choice-body"><span className="quote-choice-top"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--action)" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M6 6.5h1m2 0h1" />{option.id === "keep-improve" ? <path d="M12 12v5m-2.5-2.5h5" /> : <><path d="M7 12h4v5H7zM14 12h3m-3 3h3" /></>}</svg><span className="quote-check">{draft.websiteApproach === option.id && <span className="quote-tiny-check">✓</span>}</span></span><span className="quote-choice-title">{option.title}</span><span className="quote-choice-detail">{option.detail}</span></span>
      </label>)}
    </fieldset>
    <div className={`quote-template-expander ${expanded ? "is-expanded" : ""}`}>
      <div className="quote-template-overflow">{expanded && <>
        <fieldset className="quote-template-categories">
          <legend>Browse by facility</legend>
          {websiteOptions.map(option => <label className={category === option.id ? "is-selected" : ""} key={option.id}>
            <input type="radio" name="website-category" value={option.id} checked={category === option.id} onChange={() => onChange({ websiteCategory: option.id, template: "" })} /><span>{option.title}</span>
          </label>)}
        </fieldset>
        <div className="quote-template-heading"><h2>{websiteOptions.find(option => option.id === category)?.title} templates</h2><p>{websiteTemplates(category).length} available website templates</p></div>
        <div className="quote-template-results" data-loading={loading} data-category={category} aria-busy={loading}>
          {loading ? <><span className="quote-sr-only" role="status">Loading template previews…</span><div className="quote-template-grid" aria-hidden="true">{Array.from({ length: websiteTemplates(category).length }, (_, index) => <div className="quote-template-skeleton" key={index}><div className="quote-skeleton-preview"><span /><span /><span /></div><div className="quote-skeleton-caption"><span /><span /></div></div>)}</div></> : <fieldset className="quote-template-grid quote-template-loaded" key={loadKey}>
            <legend className="quote-sr-only">Choose a website template</legend>
            {websiteTemplates(category).map(template => <label className={`quote-template-choice ${draft.template === template.id ? "is-selected" : ""}`} key={template.id}>
              <input type="radio" name="website-template" value={template.id} checked={draft.template === template.id} onChange={() => onChange({ template: template.id, websiteCategory: category })} />
              <span className="quote-template-card"><Preview index={template.index} category={category} /><span className="quote-template-caption"><span><strong>{template.name}</strong><span>{template.id === "standard" ? "Clinic & appointment pages" : "Hospital & department pages"}</span></span><span className="quote-check">{draft.template === template.id && <span className="quote-tiny-check">✓</span>}</span></span></span>
            </label>)}
          </fieldset>}
        </div>
        <p className="quote-template-footnote">Choose a starting point. Confirm the template during workspace setup.</p>
      </>}</div>
    </div>
  </div>;
}
