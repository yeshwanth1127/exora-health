"use client";

import { useEffect, useState } from "react";
import { type FacilityPlace } from "../../lib/google-facility-places";

function DetailIcon({ type }: { type: "pin" | "phone" | "clock" | "copy" | "directions" }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === "pin" && <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>}
    {type === "phone" && <path d="m8 3 2 5-3 2c1.4 3.2 3.8 5.6 7 7l2-3 5 2v3a2 2 0 0 1-2 2C9.6 21 3 14.4 3 5a2 2 0 0 1 2-2Z" />}
    {type === "clock" && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
    {type === "copy" && <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></>}
    {type === "directions" && <><path d="m12 2 10 10-10 10L2 12Z" /><path d="M8 15v-4h8m-3-3 3 3-3 3" /></>}
  </svg>;
}

export default function QuotePlaceDetails({ place: selection, curating }: { place: FacilityPlace; curating: boolean }) {
  const place = selection;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => { setPhotoFailed(false); setCopyState("idle"); }, [place.id]);
  useEffect(() => {
    if (copyState === "idle") return;
    const timer = setTimeout(() => setCopyState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copyState]);
  async function copyAddress() {
    try { await navigator.clipboard.writeText(place.address); setCopyState("copied"); }
    catch { setCopyState("failed"); }
  }
  return <div className="quote-facility-card-copy quote-place-profile">
    {place.photo && !photoFailed && <div className="quote-place-photo"><img src={place.photo.src} alt={place.photo.alt} width="800" height="533" onError={() => setPhotoFailed(true)} /><span>{place.source === "sample" ? "Sample place · demo preview" : "Facility photo"}</span></div>}
    <div className="quote-place-profile-body">
      {(!place.photo || photoFailed) && <span className="quote-place-source">{place.source === "sample" ? "Sample place · demo preview" : "Google Maps"}</span>}
      <h2 tabIndex={-1}>{place.name}</h2>
      {place.category && <p className="quote-place-category">{place.category}</p>}
      {place.rating !== undefined && <p className="quote-place-rating"><span aria-hidden="true">★</span><strong>{place.rating.toFixed(1)}</strong><span>{place.reviewCount?.toLocaleString("en-IN") || "0"} Google reviews</span></p>}
      <div className="quote-place-detail-rows">
        <p className="quote-place-address"><DetailIcon type="pin" /><span>{place.address}</span></p>
        {place.phone && <p className="quote-place-phone"><DetailIcon type="phone" /><a href={`tel:${place.phone.replace(/[^+\d]/g, "")}`}>{place.phone}</a></p>}
        {place.hoursSummary && <p className="quote-place-schedule"><DetailIcon type="clock" /><span>{place.hoursSummary}</span></p>}
        {Boolean(place.hours?.length) && <details className="quote-place-hours"><summary><DetailIcon type="clock" />Opening hours</summary><ul>{place.hours!.map(day => <li key={day}>{day}</li>)}</ul></details>}
      </div>
      {place.businessStatus && place.businessStatus !== "OPERATIONAL" && <p className="quote-place-business-status">{place.businessStatus.replaceAll("_", " ").toLowerCase()}</p>}
      <div className="quote-place-actions">
        <a href={place.mapsUrl} target="_blank" rel="noreferrer"><DetailIcon type="directions" />Directions<span aria-hidden="true">↗</span></a>
        <button type="button" onClick={() => void copyAddress()}><DetailIcon type="copy" />{copyState === "copied" ? "Copied" : copyState === "failed" ? "Try again" : "Copy address"}</button>
      </div>
      {place.website && <a className="quote-place-website" href={place.website} target="_blank" rel="noreferrer">Visit website ↗</a>}
      {curating ? <p className="quote-shimmer quote-place-curating" role="status">Curating your facility profile…</p> : <p className="quote-place-ready" role="status"><span aria-hidden="true">✓</span>Facility details ready</p>}
      {copyState !== "idle" && <span className="quote-sr-only" role="status">{copyState === "copied" ? "Address copied" : "Could not copy the address. Try again."}</span>}
      {place.attributions.map(item => <span className="quote-place-attribution" key={item.provider}>{item.uri ? <a href={item.uri} target="_blank" rel="noreferrer">{item.provider}</a> : item.provider}</span>)}
    </div>
  </div>;
}
