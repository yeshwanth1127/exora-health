"use client";
import { useState } from "react";
import { ArrowUpRight, Building2, Check, Clock3, Copy, Globe, MapPin, Navigation, Phone, Star } from "lucide-react";
import type { PublicBusiness } from "../../lib/business-lookup";

export function ClinicWidget({ profile, preview }: { profile: PublicBusiness; preview: boolean }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copyAddress() {
    try { await navigator.clipboard.writeText(profile.address); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  const accessibility = Object.entries(profile.accessibility || {}).filter(([,value]) => value !== null);
  return <aside className="reach-clinic-widget" aria-labelledby="reach-clinic-name">
    <div className="reach-clinic-cover"><Building2 size={32} strokeWidth={1.3} aria-hidden="true" /><span>{profile.category || "Your business"}</span><MapPin className="reach-clinic-pin" size={24} strokeWidth={1.4} aria-hidden="true" /></div>
    <div className="reach-clinic-body"><div className="reach-clinic-title"><h2 id="reach-clinic-name">{profile.name}</h2>{profile.businessStatus && <span className={`reach-clinic-status ${profile.businessStatus === "OPERATIONAL" ? "" : "is-closed"}`}>{profile.businessStatus === "OPERATIONAL" ? "Operational" : profile.businessStatus.replaceAll("_", " ").toLowerCase()}</span>}</div>
      {profile.rating != null && <p className="reach-clinic-rating"><Star size={14} fill="currentColor" aria-hidden="true" /><strong>{profile.rating.toFixed(1)}</strong><span>{profile.reviewCount?.toLocaleString() ?? "—"} Google reviews</span></p>}
      <p className="reach-clinic-row"><MapPin size={16} aria-hidden="true" /><span>{profile.address || "Address not returned"}</span></p>
      {profile.phone && <p className="reach-clinic-row"><Phone size={15} aria-hidden="true" />{preview ? <span>{profile.phone}</span> : <a href={`tel:${profile.phone.replace(/[^+\d]/g, "")}`}>{profile.phone}</a>}</p>}
      {profile.website && !preview && <p className="reach-clinic-row"><Globe size={15} aria-hidden="true" /><a href={profile.website} target="_blank" rel="noreferrer">{new URL(profile.website).hostname.replace(/^www\./, "")}<ArrowUpRight size={12} aria-hidden="true" /></a></p>}
      {profile.openNow != null && <p className={`reach-clinic-open ${profile.openNow ? "is-open" : ""}`}>{profile.openNow ? "Open now" : "Closed now"}<span>At the time of this check</span></p>}
      {Boolean(profile.hours.length) && <details className="reach-clinic-hours"><summary><Clock3 size={15} aria-hidden="true" />Opening hours</summary><ul>{profile.hours.map(day => <li key={day}>{day}</li>)}</ul></details>}
      {accessibility.length > 0 && <details className="reach-clinic-access"><summary>Accessibility information</summary><ul>{accessibility.map(([key,value]) => <li key={key}>{key.replace(/wheelchairAccessible/, "Wheelchair accessible ").replace(/([a-z])([A-Z])/g,"$1 $2")}<span>{value ? "Listed" : "Not available"}</span></li>)}</ul></details>}
      <div className="reach-clinic-actions">{profile.mapsUrl && !preview && <a href={profile.mapsUrl} target="_blank" rel="noreferrer"><Navigation size={14} aria-hidden="true" />View location<ArrowUpRight size={12} aria-hidden="true" /></a>}<button type="button" onClick={() => void copyAddress()} disabled={!profile.address}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? "Copied" : "Copy address"}</button></div>
      <span className="reach-copy-status" role="status">{copyError ? "Could not copy the address. Try again." : ""}</span>
      {!preview && <footer className="reach-attribution"><span translate="no">Google Maps</span>{profile.attributions.map((item,index) => <span key={index}>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.name}</a> : item.name}</span>)}</footer>}
    </div>
  </aside>;
}
