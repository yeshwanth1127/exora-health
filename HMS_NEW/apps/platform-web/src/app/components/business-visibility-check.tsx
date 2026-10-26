"use client";
import SiteImage from "./site-image";


import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Clock3, Globe, MapPin, Navigation, Phone, Search } from "lucide-react";
import { Combobox, type ComboboxOption } from "./arc-business/combobox";
import { businessLookup } from "../../lib/business-lookup";
import "./arc-business/scope.css";
import "./business-visibility-check.css";

function ClinicPhoneMockup() {
  return <figure className="business-phone" role="img" aria-label="iPhone 15 Pro showing an illustrative Google clinic listing">
    <div className="business-phone-shell" aria-hidden="true">
      <div className="business-phone-screen">
        <div className="business-phone-status"><SiteImage sizes="300px" src="/assets/business-visibility/ios-status-bar-black.png" alt="" /></div>
        <div className="business-phone-google-search"><ArrowLeft size={13} /><span className="business-phone-google-g">G</span><span>clinics near me</span><Search size={13} /></div>
        <div className="business-phone-photo">
          <svg viewBox="0 0 240 128" fill="none">
            <rect width="240" height="128" fill="#eaf0f5" />
            <path d="M0 89h240v39H0z" fill="#e7e2d9" />
            <path d="M38 38h158v75H38z" fill="#f9f6ef" />
            <path d="M32 31h170v12H32z" fill="#d8cdbb" />
            <path d="M48 50h138v26H48z" fill="#e5eaf0" />
            <path d="M58 56h10v14H58zM168 56h10v14h-10z" fill="#a5b7c7" />
            <path d="M43 76h147v8H43z" fill="#bbc7d0" />
            <path d="M54 84h34v29H54zM100 84h36v29h-36zM148 84h29v29h-29z" fill="#94aab9" />
            <path d="M58 88h26v25H58zM104 88h28v25h-28zM152 88h21v25h-21z" fill="#c7d8df" />
            <path d="M118 88v25M166 88v25" stroke="#f9f6ef" strokeWidth="2" />
            <rect x="101" y="47" width="32" height="26" rx="4" fill="#fff" />
            <path d="M114 53h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill="#7c9eb8" />
            <path d="M32 113h174v5H32z" fill="#c9c2b5" />
            <path d="M14 110h15l-2 15H16zM204 110h17l-2 15h-13z" fill="#b6aa95" />
            <path d="M22 110V87M213 110V85" stroke="#a2947e" strokeWidth="3" />
            <ellipse cx="22" cy="81" rx="13" ry="20" fill="#aeb6a5" />
            <ellipse cx="213" cy="79" rx="15" ry="22" fill="#b3bcac" />
            <path d="M0 126h240" stroke="#d6cfc2" strokeWidth="4" />
          </svg>
          <span>Photos</span>
        </div>
        <div className="business-phone-profile">
          <div className="business-phone-profile-title"><strong>Your clinic</strong><span>Example listing</span></div>
          <p>Medical clinic</p>
          <div className="business-phone-tabs"><span>Overview</span><span>Reviews</span><span>Photos</span></div>
          <div className="business-phone-actions"><span><i><Navigation size={13} /></i>Directions</span><span><i><Phone size={13} /></i>Call</span><span><i><Globe size={13} /></i>Website</span></div>
          <div className="business-phone-detail"><MapPin size={13} /><span>Your neighbourhood</span></div>
          <div className="business-phone-detail"><Clock3 size={13} /><span>Opening hours</span><ArrowUpRight size={11} /></div>
        </div>
        <span className="business-phone-home" />
      </div>
      <SiteImage sizes="(max-width: 640px) 280px, 340px" className="business-phone-frame" src="/assets/business-visibility/iphone-15-pro-natural-titanium.png" width="1419" height="2796" alt="" />
    </div>
  </figure>;
}

export default function BusinessVisibilityCheck() {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("Start typing to find your business.");
  const session = useRef("");
  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    if (value.trim().length >= 2) {
      setOptions([]);
      setMessage("Searching…");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (query.trim().length < 2) {
      setMessage("Start typing to find your business.");
      return;
    }
    if (!session.current) session.current = crypto.randomUUID();
    const timer = setTimeout(async () => {
      try {
        const data = await businessLookup({ mode: "autocomplete", q: query.trim(), session: session.current }, controller.signal);
        if (controller.signal.aborted) return;
        setOptions((data.predictions || []).map(place => ({ value: place.id, label: place.label })));
        setMessage("No places found. Try adding your city.");
      } catch (error) {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Search is unavailable. Try again.");
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  function choose(id: string) {
    setSelected(id);
    if (!id) { setOptions([]); return; }
    const params = new URLSearchParams({ place: id, session: session.current });
    // Open during the selection gesture, before any asynchronous detail request.
    window.open(`/business-report?${params}`, "_blank", "noopener,noreferrer");
    session.current = "";
  }

  return <section id="business-visibility" className="business-bar" aria-labelledby="business-bar-question">
    <div className="business-bar-inner">
      <div className="business-phone-stage"><ClinicPhoneMockup /></div>
      <div className="business-bar-copy">
        <h2 id="business-bar-question">Can customers find you?</h2>
        <p>Your next patient could be searching right now. See how your clinic shows up on Google.</p>
      </div>
      <div className="business-bar-search business-arc-scope" role="search" aria-label="Find your business">
        <Combobox className="business-bar-control" label="Find your business" hideLabel placeholder="Search your business" options={options} value={selected} onValueChange={choose} onQueryChange={updateQuery} filterOptions={false} emptyMessage={message} maxLength={220} autoComplete="off" footer={<div className="business-bar-google" translate="no">Google Maps</div>} />
      </div>
    </div>
  </section>;
}
