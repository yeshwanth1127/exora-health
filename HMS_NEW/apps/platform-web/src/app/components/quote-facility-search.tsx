"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  createFacilitySession, findFacilityFromLink, getFacilityDetails, suggestFacilities,
  type FacilitySuggestion,
} from "../../lib/google-facility-places";
import type { WizardDraft } from "../../lib/quote-wizard";
import FacilityMap from "./quote-facility-map";
import QuotePlaceDetails from "./quote-place-details";

function Pin() {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}

export default function QuoteFacilitySearch({ draft, onChange, onBusyChange, linkInvalid = false }: {
  draft: WizardDraft; linkInvalid?: boolean; onChange: (values: Partial<WizardDraft>) => void; onBusyChange: (busy: boolean) => void;
}) {
  const [primary, setPrimary] = useState(draft.website);
  const [source, setSource] = useState<"primary" | "name" | null>(null);
  const [phase, setPhase] = useState<"form" | "matching" | "curating" | "ready">(draft.place ? "ready" : "form");
  const [suggestions, setSuggestions] = useState<FacilitySuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [detailStage, setDetailStage] = useState(0);
  const session = useRef<string | undefined>(undefined);
  const selection = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const primaryInput = useRef<HTMLInputElement>(null);
  const selectedCard = useRef<HTMLDivElement>(null);
  const detailsRequest = useRef<AbortController | null>(null);
  const query = source === "primary" ? primary.trim() : source === "name" ? [draft.business.trim(), draft.city.trim()].filter(Boolean).join(" ") : "";
  const isLink = /^[a-z][a-z0-9+.-]*:|^www\.|^[^\s]+\.[a-z]{2,}(\/|$)/i.test(query);

  useEffect(() => {
    return () => { selection.current++; detailsRequest.current?.abort(); timers.current.forEach(clearTimeout); onBusyChange(false); };
  }, [onBusyChange]);

  useEffect(() => {
    if (phase === "ready") selectedCard.current?.querySelector<HTMLHeadingElement>("h2")?.focus({ preventScroll: true });
  }, [phase]);
  useEffect(() => {
    if (active >= 0) document.getElementById(`quote-place-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useEffect(() => {
    setSuggestions([]); setActive(-1); setSearched(false);
    if (phase !== "form" || !source || query.length < 2) { setSearching(false); return; }
    setError("");
    let cancelled = false;
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        let results: FacilitySuggestion[];
        if (isLink) results = (await findFacilityFromLink(query, controller.signal)).map(place => ({ id: place.id, name: place.name, address: place.address, resolved: place }));
        else {
          if (!session.current) session.current = await createFacilitySession();
          results = await suggestFacilities(query, session.current, controller.signal);
        }
        if (!cancelled) { setSuggestions(results); setSearched(true); }
      } catch (cause) {
        if (!cancelled) { setError(cause instanceof Error ? cause.message : "Place search is unavailable right now. Try again or enter your details below."); setSearched(true); }
      } finally { if (!cancelled) setSearching(false); }
    }, 300);
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [query, source, phase, isLink]);

  async function select(suggestion: FacilitySuggestion) {
    const version = ++selection.current;
    detailsRequest.current?.abort();
    const controller = new AbortController();
    detailsRequest.current = controller;
    timers.current.forEach(clearTimeout);
    setPhase("matching"); setDetailStage(0); setPendingName(suggestion.name); setError(""); setSuggestions([]); onBusyChange(true);
    timers.current.push(setTimeout(() => setDetailStage(1), 300));
    try {
      const place = await getFacilityDetails(suggestion, controller.signal);
      if (version !== selection.current) return;
      session.current = undefined;
      onChange({ place, business: place.name, city: place.city, website: place.website || place.mapsUrl });
      setPhase("curating");
      const finish = () => { if (version === selection.current) { setPhase("ready"); onBusyChange(false); } };
      timers.current.push(setTimeout(finish, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 550));
    } catch {
      if (version === selection.current) { timers.current.forEach(clearTimeout); setPhase("form"); setSource(null); setError("We couldn’t get that place’s details. Try another result or enter your details below."); onBusyChange(false); requestAnimationFrame(() => primaryInput.current?.focus()); }
    }
  }
  function changeFacility() {
    selection.current++; detailsRequest.current?.abort(); timers.current.forEach(clearTimeout); session.current = undefined;
    setPhase("form"); setSource(null); setPrimary(""); setSuggestions([]); setError(""); onChange({ place: null, business: "", city: "", website: "" }); onBusyChange(false);
    requestAnimationFrame(() => primaryInput.current?.focus());
  }
  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && suggestions.length) { event.preventDefault(); setActive(index => (index + 1) % suggestions.length); }
    else if (event.key === "ArrowUp" && suggestions.length) { event.preventDefault(); setActive(index => (index < 1 ? suggestions.length - 1 : index - 1)); }
    else if (event.key === "Enter" && (active >= 0 || searching || suggestions.length)) {
      event.preventDefault(); if (active >= 0) void select(suggestions[active]);
    } else if (event.key === "Escape") { event.preventDefault(); setSource(null); setSuggestions([]); }
  }
  function results(forSource: "primary" | "name") {
    if (source !== forSource || phase !== "form" || query.length < 2) return null;
    return <>
      {suggestions.length > 0 && <div className="quote-place-dropdown"><ul id="quote-place-suggestions" role="listbox" aria-label="Facility suggestions">{suggestions.map((suggestion, index) => <li key={suggestion.id} id={`quote-place-option-${index}`} role="option" aria-selected={active === index} className={active === index ? "is-active" : ""} onMouseDown={event => event.preventDefault()} onClick={() => void select(suggestion)}><Pin /><div><strong>{suggestion.name}</strong><span>{suggestion.address}</span></div></li>)}</ul><span className="quote-place-attribution" translate="no">{suggestions.every(item => item.resolved?.source === "sample") ? "Example facility" : "Google Maps"}</span></div>}
      {searching && <p className="quote-place-search-status quote-shimmer" role="status">Looking for your facility…</p>}
      {!searching && suggestions.length > 0 && <span className="quote-sr-only" role="status">{suggestions.length} suggestions. Use the up and down arrow keys to choose, then Enter to select.</span>}
      {!searching && searched && !suggestions.length && !error && <p className="quote-place-search-status">No matches yet. Try adding the city or enter your details below.</p>}
    </>;
  }
  function combobox(forSource: "primary" | "name") {
    const open = source === forSource && suggestions.length > 0;
    return { role: "combobox", "aria-autocomplete": "list" as const, "aria-controls": open ? "quote-place-suggestions" : undefined, "aria-expanded": open, "aria-activedescendant": open && active >= 0 ? `quote-place-option-${active}` : undefined, onKeyDown: keyboard, autoComplete: "off" };
  }

  return <div className="quote-facility-search" data-phase={phase} data-mode="google">
    {phase === "form" ? <>
      <div className="quote-place-input-wrap quote-fields">
        <label className="quote-wide-field">Website or Google Maps link<input id="quote-facility-link" aria-invalid={linkInvalid} aria-describedby={linkInvalid ? "quote-form-error" : undefined} maxLength={250} {...combobox("primary")} ref={primaryInput} value={primary} onFocus={() => setSource("primary")} onChange={event => { setPrimary(event.target.value); setSource("primary"); onChange({ website: /^[a-z][a-z0-9+.-]*:|^www\.|^[^\s]+\.[a-z]{2,}(\/|$)/i.test(event.target.value) ? event.target.value : "", place: null }); }} placeholder="Paste a link or search your facility" /></label>
        {results("primary")}
      </div>
      <div className="quote-place-divider"><span>or</span></div>
      <div className="quote-fields">
        <div className="quote-place-input-wrap"><label>Facility name<input maxLength={150} {...combobox("name")} value={draft.business} onFocus={() => setSource("name")} onChange={event => { setSource("name"); onChange({ business: event.target.value, place: null }); }} placeholder="Search your clinic or hospital" /></label>{results("name")}</div>
        <label>City or area<input maxLength={80} autoComplete="address-level2" value={draft.city} onChange={event => onChange({ city: event.target.value, place: null })} placeholder="Where are you based?" /></label>
      </div>
    </> : <>
      <div className="quote-facility-card-heading"><span>Your facility</span><button type="button" onClick={changeFacility}>Change facility</button></div>
      {phase === "matching" ? <div className="quote-facility-card quote-facility-card-skeleton" aria-busy="true"><div className="quote-facility-map-skeleton"><Pin /></div><div className="quote-facility-card-copy"><h2>{pendingName}</h2><p className="quote-shimmer" role="status">{detailStage === 0 ? "Looking through the location…" : "Getting your facility details…"}</p><span className="quote-place-detail-line" /><span className="quote-place-detail-line" /></div></div>
      : draft.place && <div ref={selectedCard} className="quote-facility-card" aria-busy={phase === "curating"}>
        <FacilityMap place={draft.place} />
        <QuotePlaceDetails place={draft.place} curating={phase === "curating"} />
      </div>}
      {draft.place && phase !== "matching" && <div className="quote-facility-value"><h3>A starting point for your Growth Suite</h3><div>
        <p><span>Website appointments</span>{draft.place.website ? "Build an appointment path around your existing website." : "Create a clear place for patients to enquire and book."}</p>
        <p><span>Reception & WhatsApp</span>{draft.place.phone ? "Use your listed phone as a starting point for enquiry routing." : "Choose the right enquiry number during onboarding."}</p>
        <p><span>Local discovery</span>{draft.place.source === "google" ? "Use the listing you selected to keep your facility details consistent." : "Connect your real listing when setting up your plan."}</p>
      </div></div>}
    </>}
    {error && <p className="quote-place-error" role="alert">{error}</p>}
    {process.env.NODE_ENV === "development" && <a className="quote-maps-comparison-link" href="/quote/maps" target="_blank" rel="noreferrer">Compare Google, Apple and Mapbox map styles ↗</a>}
  </div>;
}
