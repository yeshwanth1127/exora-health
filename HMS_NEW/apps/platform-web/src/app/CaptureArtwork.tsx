"use client";
import { BRAND_NAME } from "../lib/brand";
import { useEffect, useState } from "react";

const base = "/assets/capture-home-product/";
/** Each part is an independently generated PNG. The page composes the scene. */
export default function CaptureArtwork({ people, objects, className = "", label = (BRAND_NAME + " illustration") }: { people: string[]; objects?: string[]; className?: string; label?: string }) {
  const [mode, setMode] = useState("people");
  useEffect(() => { setMode(new URLSearchParams(window.location.search).get("art") === "objects" ? "objects" : "people"); }, []);
  const parts = mode === "objects" && objects ? objects : people;
  return <span className={`capture-art ${className}`} role="img" aria-label={label} data-capture-art-mode={mode}>
    {parts.map((part, index) => <img key={`${part}-${index}`} src={`${base}${part}.webp`} alt="" width="1254" height="1254" data-capture-art-part={part} />)}
  </span>;
}
