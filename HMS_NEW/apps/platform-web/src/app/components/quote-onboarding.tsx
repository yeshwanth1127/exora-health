"use client";

import {trackWebsite} from "../../lib/website-analytics";
import { BRAND_NAME } from "../../lib/brand";
import { useCallback, useEffect, useRef, useState } from "react";
import { Stethoscope, Users, Hospital, ArrowRight, ChevronLeft, X, Check, Gift, MapPin, MessageCircle, Megaphone, Sparkles, Globe, Download, ChartNoAxesColumnIncreasing, Target, CircleHelp } from "lucide-react";
import BrandLogo from "./brand-logo";
import OnboardingMascot from "./onboarding-mascot";
import { intakeFromQuote, saveIntake } from "../../lib/capture-onboarding";
import QuoteCelebration from "./quote-celebration";
import QuoteWebsiteChooser from "./quote-website-chooser";
import QuoteFacilitySearch from "./quote-facility-search";
import {
  channelOptions, facilityOptions, initialWizardDraft, quoteSteps,
  targetOptions, volumeOptions, websiteDirection, wizardBrief, type WizardDraft,
} from "../../lib/quote-wizard";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  const icons: Record<string, typeof Stethoscope> = { stethoscope: Stethoscope, users: Users, hospital: Hospital, arrow: ArrowRight, back: ChevronLeft, close: X, check: Check, gift: Gift, pin: MapPin, message: MessageCircle, megaphone: Megaphone, sparkles: Sparkles, globe: Globe, download: Download, chart: ChartNoAxesColumnIncreasing, target: Target, help: CircleHelp };
  const Symbol = icons[name] || Sparkles;
  return <Symbol className={className} size={24} strokeWidth={1.8} aria-hidden="true" />;
}

function Choice({ name, value, title, detail, icon, tone = "violet", selected, multiple = false, onChange }: {
  name: string; value: string; title: string; detail?: string; icon?: string; tone?: string;
  selected: boolean; multiple?: boolean; onChange: () => void;
}) {
  return <label className={`quote-choice ${selected ? "is-selected" : ""}`}>
    <input type={multiple ? "checkbox" : "radio"} name={name} value={value} checked={selected} onChange={onChange} />
    <span className="quote-choice-body">
      <span className="quote-choice-top">{icon && <Icon name={icon} className={`quote-choice-icon tone-${tone}`} />}<span className={`quote-check ${multiple ? "is-square" : ""}`}>{selected && <Icon name="check" />}</span></span>
      <span className="quote-choice-title">{title}</span>
      {detail && <span className="quote-choice-detail">{detail}</span>}
    </span>
  </label>;
}

const questionCopy: Record<string, { title: string; detail: string }> = {
  facility: { title: "How big is your healthcare facility?", detail: "Choose the option that best describes your practice. We’ll tailor your Growth Suite around it." },
  volume: { title: "How many patient enquiries do you receive?", detail: "Think about a typical day across calls and WhatsApp. A rough idea is enough." },
  target: { title: "Where would you like that number to be?", detail: "Choose your target daily enquiry volume. We can help you find a realistic starting point." },
  marketing: { title: "How do patients find you today?", detail: "Choose all the channels you already use." },
  business: { title: "Let’s find your facility.", detail: "Start with a link or search your place. We’ll bring its details together for your plan." },
  website: { title: "Which website direction feels right?", detail: "Keep what works or plan a new website for your kind of facility." },
  contact: { title: "How can we reach you?", detail: "Choose your preferred channel. These details will be included in your saved plan." },
  offer: { title: "Your Growth Suite. On us for two months.", detail: "Start with the entire suite, then receive a personalised offer for your facility." },
};

function OfferReveal({ draft, onReady }: { draft: WizardDraft; onReady: (ready: boolean) => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  const [phase, setPhase] = useState<"preparing" | "counting" | "strike" | "free">("preparing");
  const [stage, setStage] = useState(0);
  const [amount, setAmount] = useState(0);
  const planValue = draft.facility === "hospital" ? 200000 : draft.facility === "clinic" ? 100000 : 50000;
  const facilityName = draft.business.trim() || "your facility";
  const statuses = [`Curating a plan for ${facilityName}…`, "Crafting your growth journey…", "Your two-month head start is ready."];
  const context = [
    { title: "Your facility", detail: [facilityOptions.find(option => option.id === draft.facility)?.title, draft.city].filter(Boolean).join(" · ") },
    { title: draft.channels.length ? "Your channels" : "Your Growth Suite focus", detail: draft.channels.length ? draft.channels.join(" · ") : "AI reception, appointments and patient engagement" },
    { title: "Your website direction", detail: websiteDirection(draft) },
  ];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    onReady(false);
    const finish = () => { setAmount(planValue); setPhase("free"); onReady(true); };
    const stopMotion = () => {
      if (!preference.matches) return;
      timers.forEach(clearTimeout); cancelAnimationFrame(frame); finish();
    };
    if (preference.matches) finish();
    else {
      setPhase("preparing"); setStage(0); setAmount(0);
      timers.push(setTimeout(() => setStage(1), 1500), setTimeout(() => setStage(2), 3000));
      timers.push(setTimeout(() => {
        setPhase("counting");
        const started = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - started) / 1600, 1);
          setAmount(Math.round(planValue * (1 - Math.pow(1 - progress, 3))));
          if (progress < 1) frame = requestAnimationFrame(tick);
          else {
            setPhase("strike");
            timers.push(setTimeout(finish, 850));
          }
        };
        frame = requestAnimationFrame(tick);
      }, 4500));
    }
    preference.addEventListener("change", stopMotion);
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(frame); preference.removeEventListener("change", stopMotion); };
  }, [planValue, onReady]);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, [phase === "preparing"]);

  return <div className="quote-offer-reveal" data-phase={phase}>
    {phase === "preparing" ? <div className="quote-curation" aria-busy="true">
      <div className="quote-curation-icon"><Icon name="sparkles" /></div>
      <h1 id="quote-title" ref={title} tabIndex={-1} className="quote-shimmer" aria-live="polite" aria-atomic="true">{statuses[stage]}</h1>
      <p className="quote-curation-context">Bringing your choices together into a personalised Growth Suite.</p>
      <ol>{context.map((item, index) => <li key={item.title} className={index < stage ? "is-complete" : index === stage ? "is-current" : ""}><span>{index < stage ? <Icon name="check" /> : index + 1}</span><div><strong>{item.title}</strong><p>{item.detail}</p></div></li>)}</ol>
    </div> : <>
      <h1 id="quote-title" ref={title} tabIndex={-1}>{draft.business ? `${draft.business}, meet your Growth Suite.` : "Your Growth Suite. On us."}</h1>
      <p className="quote-intro">The entire Growth Suite for {facilityName}. Your first two months are on us.</p>
      <div className="quote-reveal-price" aria-label={phase === "free" ? "Free for your first two months" : "Preparing your offer"}>
        <span className="quote-reveal-gift"><Icon name="gift" /></span>
        <span className="quote-reveal-kicker">Your two-month head start</span>
        <div className="quote-amount-wrap" aria-hidden="true"><span className="quote-amount">₹{amount.toLocaleString("en-IN")}</span></div>
        <strong className="quote-free" aria-hidden={phase !== "free"}><span className="quote-free-word">Free</span><span>for your first two months</span></strong>
        <span className="quote-amount-caption">Plan value · personalised offer after two months</span>
      </div>
      <div className={`quote-offer-details ${phase === "free" ? "is-visible" : ""}`} aria-hidden={phase !== "free"}>
        <p className="quote-afterward">A personalised offer afterward. Shaped around your facility.</p>
        <div className="quote-launch-times"><p><span>Onboard in</span><strong>5 <span>minutes</span></strong></p><p><span>Deploy in</span><strong>10 <span>minutes</span></strong></p></div>
        <ul>{["AI reception", "Website appointments", "WhatsApp automation", "Patient loyalty"].map(service => <li key={service}><Icon name="check" />{service}</li>)}</ul>
        <p className="quote-local-note">Start onboarding with these choices. We’ll bring your facility details into your account setup.</p>
      </div>
    </>}
    {phase === "free" && <QuoteCelebration />}
  </div>;
}

export default function QuoteOnboarding() {
  const [step, setStep] = useState(0);
  useEffect(()=>{const send=()=>trackWebsite('quote_step_viewed',{path:'/quote',stage:quoteSteps[step]?.id});send();window.addEventListener('website:analytics-ready',send);return()=>window.removeEventListener('website:analytics-ready',send);},[step]);
  const [draft, setDraft] = useState<WizardDraft>({ ...initialWizardDraft, channels: [] });
  const [skipped, setSkipped] = useState<string[]>([]);
  const [restored,setRestored]=useState(false);
  const [error, setError] = useState("");
  const [contactErrors, setContactErrors] = useState<Partial<Record<"name" | "contact" | "consent", string>>>({});
  const [downloaded, setDownloaded] = useState(false);
  const [offerReady, setOfferReady] = useState(false);
  const [businessBusy, setBusinessBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const contactInput = useRef<HTMLInputElement>(null);
  const consentInput = useRef<HTMLInputElement>(null);
  const current = quoteSteps[step];
  const copy = questionCopy[current.id];

  useEffect(()=>{try{const saved=JSON.parse(sessionStorage.getItem("capture.quote-draft.v1")||"null");if(saved?.expiresAt>Date.now()&&saved.expiresAt<Date.now()+31*60*1000&&Number.isInteger(saved.step)&&saved.step>=0&&saved.step<quoteSteps.length&&saved.draft){const d=saved.draft;const strings=["facility","volume","target","business","city","website","websiteApproach","websiteCategory","template","name","contactChannel","contact"];if(strings.every(k=>typeof d[k]==="string"&&d[k].length<=2000)&&Array.isArray(d.channels)&&d.channels.every((v:unknown)=>typeof v==="string")&&typeof d.consent==="boolean"){setDraft({...d,place:null});setStep(saved.step);setSkipped(Array.isArray(saved.skipped)?saved.skipped.filter((v:unknown)=>typeof v==="string"):[])}}}catch{}setRestored(true)},[]);
  useEffect(()=>{if(!restored)return;try{sessionStorage.setItem("capture.quote-draft.v1",JSON.stringify({version:1,expiresAt:Date.now()+30*60*1000,step,draft,skipped}))}catch{}},[restored,step,draft,skipped]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);
  const updateBusiness = useCallback((values: Partial<WizardDraft>) => {
    setDraft(previous => ({ ...previous, ...values })); setError(""); setDownloaded(false);
  }, []);

  function update<K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) {
    setDraft(previous => ({ ...previous, [key]: value }));
    setError("");
    if (key === "name" || key === "contact" || key === "consent") setContactErrors(previous => ({ ...previous, [key]: undefined }));
    setDownloaded(false);
  }
  function move(next: number) {
    setStep(next); setError(""); setContactErrors({}); setOfferReady(false); setBusinessBusy(false); setDownloaded(false); window.scrollTo({ top: 0, behavior: "instant" });
  }
  function next(skip = false) {
    if (skip && !current.optional) return;
    if (!skip && current.id === "contact") {
      const validContact = draft.contactChannel === "Email"
        ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contact.trim())
        : /^\+?[\d\s().-]+$/.test(draft.contact.trim()) && draft.contact.replace(/\D/g, "").length >= 7 && draft.contact.replace(/\D/g, "").length <= 15 && !/^(\d)\1+$/.test(draft.contact.replace(/\D/g, ""));
      if (!draft.name.trim() || !validContact || !draft.consent) {
        setContactErrors({
          name: !draft.name.trim() ? "Enter your name." : undefined,
          contact: !validContact ? (draft.contactChannel === "Email" ? "Enter a valid email address." : "Enter a valid phone number.") : undefined,
          consent: !draft.consent ? "Give permission to follow up, or skip this step." : undefined,
        });
        (!draft.name.trim() ? nameInput : !validContact ? contactInput : consentInput).current?.focus();
        return;
      }
    }
    if (!skip && current.id === "business" && draft.website.trim()) {
      try {
        const url = new URL(/^https?:\/\//i.test(draft.website) ? draft.website : `https://${draft.website}`);
        if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) throw new Error();
      } catch { setError("Enter a website or Maps address, or leave the link empty."); document.getElementById("quote-facility-link")?.focus(); return; }
    }
    setSkipped(previous => skip ? [...new Set([...previous, current.id])] : previous.filter(id => id !== current.id));
    if (skip) {
      const cleared: Partial<WizardDraft> = {
        volume: { volume: "" }, target: { target: "" }, marketing: { channels: [] },
        business: { place: null, business: "", city: "", website: "" }, website: { websiteApproach: "", websiteCategory: "", template: "" },
        contact: { name: "", contact: "", consent: false },
      }[current.id] || {};
      setDraft(previous => ({ ...previous, ...cleared }));
    }
    move(Math.min(step + 1, quoteSteps.length - 1));
  }
  const canContinue = current.id === "facility" ? Boolean(draft.facility)
    : current.id === "volume" ? Boolean(draft.volume)
    : current.id === "target" ? Boolean(draft.target)
    : current.id === "marketing" ? Boolean(draft.channels.length)
    : current.id === "website" ? Boolean(draft.websiteApproach && (draft.websiteApproach !== "choose" || draft.template))
    : current.id === "business" ? !businessBusy && Boolean(draft.business.trim() || draft.city.trim() || draft.website.trim())
    : true;

  function startOnboarding() {
    try { saveIntake(intakeFromQuote(draft)); window.location.assign("/onboarding"); }
    catch { setError("We couldn’t keep your details in this browser. Allow site storage and try again."); }
  }
  function downloadPlan() {
    const blob = new Blob([wizardBrief(draft, skipped)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "capture-growth-plan.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloaded(true);
  }
  function toggleChannel(value: string) {
    const values = draft.channels.includes(value) ? draft.channels.filter(channel => channel !== value)
      : value === "None yet" ? [value] : [...draft.channels.filter(channel => channel !== "None yet"), value];
    update("channels", values);
  }
  function numberChoices(values: string[], field: "volume" | "target") {
    return <fieldset className="quote-options quote-number-options"><legend className="quote-sr-only">{copy.title}</legend>{values.map(value =>
      <Choice key={value} name={field} value={value} title={value} icon={value === "Not sure" || value === "Help me choose" ? "help" : field === "target" ? "target" : "chart"} detail={value === "Not sure" || value === "Help me choose" ? "We’ll work it out together." : "Patient enquiries per day"} selected={draft[field] === value} onChange={() => update(field, value)} />
    )}</fieldset>;
  }

  return <div className="quote-page"><p className="flow-preview-banner">No account or service is activated during this setup. Offer subject to agreement.</p>
    <header className="quote-header">
      <div className="quote-header-inner"><a href="/" aria-label={(BRAND_NAME + " home")} className="quote-brand"><BrandLogo /></a><span className="quote-header-label">Your personalised growth plan</span><a href="/" className="quote-close" aria-label="Close quote flow"><Icon name="close" /></a></div>
    </header>
    <main id="main-content" className={`quote-main ${current.id === "offer" ? "quote-offer-main" : ""}`}>
      <OnboardingMascot stage={current.id} /><div className="quote-content">
      <div className="quote-step-meta"><div className="quote-progress" role="progressbar" aria-label="Quote progress" aria-valuemin={0} aria-valuemax={quoteSteps.length} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of ${quoteSteps.length}: ${current.label}`}><span style={{ transform: `scaleX(${(step + 1) / quoteSteps.length})` }} /></div><span>Step {step + 1} of {quoteSteps.length}</span></div>
      <form onSubmit={event => { event.preventDefault(); if (current.id !== "offer" && canContinue) next(); }} noValidate>
        <section className="quote-question" key={current.id} aria-labelledby="quote-title">
          {current.id !== "offer" && <><h1 id="quote-title" ref={heading} tabIndex={-1}>{copy.title}</h1><p className="quote-intro">{copy.detail}</p></>}

          {current.id === "facility" && <fieldset className="quote-options quote-facility-options"><legend className="quote-sr-only">Facility size</legend>{facilityOptions.map(option => <Choice key={option.id} name="facility" value={option.id} title={option.title} detail={option.detail} icon={option.icon} tone={option.tone} selected={draft.facility === option.id} onChange={() => update("facility", option.id)} />)}</fieldset>}
          {current.id === "volume" && numberChoices(volumeOptions, "volume")}
          {current.id === "target" && numberChoices(targetOptions, "target")}
          {current.id === "marketing" && <fieldset className="quote-options quote-channel-options"><legend className="quote-sr-only">Marketing channels</legend>{channelOptions.map(option => <Choice key={option.id} name="channels" value={option.id} title={option.id} icon={option.icon} selected={draft.channels.includes(option.id)} multiple onChange={() => toggleChannel(option.id)} />)}</fieldset>}
          {current.id === "business" && <QuoteFacilitySearch draft={draft} onChange={updateBusiness} onBusyChange={setBusinessBusy} linkInvalid={Boolean(error)} />}
          {current.id === "website" && <QuoteWebsiteChooser draft={draft} onChange={values => { setDraft(previous => ({ ...previous, ...values })); setError(""); setDownloaded(false); }} />}
          {current.id === "contact" && <div className="quote-fields">
            <label className="quote-wide-field">Your name<input ref={nameInput} required maxLength={100} aria-invalid={Boolean(contactErrors.name)} aria-describedby={contactErrors.name ? "quote-name-error" : undefined} autoComplete="name" value={draft.name} onChange={event => update("name", event.target.value)} placeholder="Full name" />{contactErrors.name && <span id="quote-name-error" className="quote-field-error">{contactErrors.name}</span>}</label>
            <fieldset className="quote-contact-channels quote-wide-field"><legend>Preferred contact</legend>{["WhatsApp", "Phone", "Email"].map(channel => <label key={channel} className={draft.contactChannel === channel ? "is-selected" : ""}><input type="radio" name="contact-channel" checked={draft.contactChannel === channel} onChange={() => { update("contactChannel", channel); update("contact", ""); }} />{channel}</label>)}</fieldset>
            <label className="quote-wide-field">{draft.contactChannel === "Email" ? "Email address" : `${draft.contactChannel} number`}<input ref={contactInput} required maxLength={draft.contactChannel === "Email" ? 254 : 30} aria-invalid={Boolean(contactErrors.contact)} aria-describedby={contactErrors.contact ? "quote-contact-error" : undefined} inputMode={draft.contactChannel === "Email" ? "email" : "tel"} type={draft.contactChannel === "Email" ? "email" : "tel"} autoComplete={draft.contactChannel === "Email" ? "email" : "tel"} value={draft.contact} onChange={event => update("contact", event.target.value)} placeholder={draft.contactChannel === "Email" ? "you@yourclinic.com" : "+91"} />{contactErrors.contact && <span id="quote-contact-error" className="quote-field-error">{contactErrors.contact}</span>}</label>
            <div className="quote-wide-field"><label className="quote-consent"><input ref={consentInput} required type="checkbox" aria-invalid={Boolean(contactErrors.consent)} aria-describedby={contactErrors.consent ? "quote-consent-error" : undefined} checked={draft.consent} onChange={event => update("consent", event.target.checked)} />You may contact me about this plan and my personalised offer.</label>{contactErrors.consent && <p id="quote-consent-error" className="quote-field-error">{contactErrors.consent}</p>}</div>
          </div>}
          {current.id === "offer" && <OfferReveal draft={draft} onReady={setOfferReady} />}
          {error && <p id="quote-form-error" className="quote-error" role="alert">{error}</p>}
        </section>
        <div className="quote-navigation">
          {step > 0 ? <button type="button" className="quote-back" onClick={() => move(step - 1)}><Icon name="back" />Back</button> : <span className="quote-navigation-hint">Choose one option</span>}
          <div className="quote-forward-actions">{current.optional && <button type="button" className="quote-skip" onClick={() => next(true)}>Skip for now</button>}{current.id === "offer" ? <button type="button" className="brand-button-primary quote-continue" disabled={!offerReady} onClick={startOnboarding}>Start onboarding<Icon name="arrow" /></button> : <button type="submit" className="brand-button-primary quote-continue" disabled={!canContinue}>Continue<Icon name="arrow" /></button>}</div>
        </div>
      </form>
      {current.id !== "offer" && <p className="quote-offer-note"><Icon name="gift" /><span>The entire Growth Suite is free for two months.<br /><span>A personalised offer afterward.</span></span></p>}
      {current.id === "offer" && offerReady && <button type="button" className="quote-skip" onClick={downloadPlan}>Download my plan instead</button>}
      {downloaded && <p className="quote-download-status" role="status">Your plan is ready to save. Nothing has been sent or activated.</p>}
      </div>
    </main>
  </div>;
}
