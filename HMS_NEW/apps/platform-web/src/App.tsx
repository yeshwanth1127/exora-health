import {
  ArrowRight,
  Bot,
  Building2,
  CalendarCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Copy,
  Globe2,
  HeartPulse,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Plan = "launch" | "connect" | "scale";
type FormState = {
  organisation: string;
  slug: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  timezone: string;
  facilityName: string;
  facilityType: string;
  plan: Plan;
  voice: boolean;
  whatsapp: boolean;
};
type ProvisioningState = {
  onboardingId: string;
  accessToken?: string;
  status: "queued" | "provisioning" | "ready" | "failed";
  public_url?: string;
  staff_url?: string;
  error?: string;
  admin_username?: string;
  temporary_password?: string;
  credential_expires_at?: string;
};
type ApiError = {
  message?: string;
  issues?: { path?: string; message?: string }[];
};

const emptyForm: FormState = {
  organisation: "",
  slug: "",
  ownerName: "",
  email: "",
  phone: "",
  city: "",
  timezone: "Asia/Kolkata",
  facilityName: "",
  facilityType: "clinic",
  plan: "connect",
  voice: true,
  whatsapp: false,
};

const steps = [
  { label: "Your account", hint: "Who will own this workspace?" },
  { label: "Organisation", hint: "Set the identity patients will see." },
  { label: "First facility", hint: "Add the first place you operate." },
  { label: "Plan & channels", hint: "Choose what goes live first." },
  { label: "Review", hint: "Confirm your launch workspace." },
];

const features = [
  {
    icon: Globe2,
    title: "A website that is ready to book",
    text: "Your brand, services, doctors and live appointment availability in one patient-friendly experience.",
  },
  {
    icon: LayoutDashboard,
    title: "One operational workspace",
    text: "Appointments, patients, schedules, consultations and communication stay in the same clinic context.",
  },
  {
    icon: Bot,
    title: "A voice front desk for every clinic",
    text: "Each organisation receives its own agent, hospital knowledge, booking permissions and call history.",
  },
  {
    icon: ShieldCheck,
    title: "Isolated by design",
    text: "A dedicated deployment, database, credentials and audit boundary are created for every customer.",
  },
];

const plans: { id: Plan; name: string; eyebrow: string; items: string[] }[] = [
  {
    id: "launch",
    name: "Launch",
    eyebrow: "Start online",
    items: ["Branded clinic website", "Online appointments", "Staff workspace", "One facility"],
  },
  {
    id: "connect",
    name: "Connect",
    eyebrow: "Run the front desk",
    items: ["Everything in Launch", "Voice agent", "Patient communications", "Multiple staff roles"],
  },
  {
    id: "scale",
    name: "Scale",
    eyebrow: "Operate a network",
    items: ["Everything in Connect", "Multiple facilities", "Growth analytics", "Advanced administration"],
  },
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="Exora Health home">
      <span className="brand-mark"><HeartPulse size={20} /></span>
      <span>Exora Health</span>
    </a>
  );
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function Onboarding({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => {
    try {
      return { ...emptyForm, ...JSON.parse(localStorage.getItem("exora-onboarding") || "{}") };
    } catch {
      return emptyForm;
    }
  });
  const [submitted, setSubmitted] = useState<ProvisioningState | null>(() => {
    try { return JSON.parse(localStorage.getItem("exora-onboarding-active") || "null"); }
    catch { return null; }
  });
  const [copied, setCopied] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  useEffect(() => localStorage.setItem("exora-onboarding", JSON.stringify(form)), [form]);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const valid = useMemo(() => {
    if (step === 0) return form.ownerName.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    if (step === 1) return form.organisation.trim().length > 1 && form.slug.length > 1;
    if (step === 2) return form.facilityName.trim().length > 1 && form.city.trim().length > 1;
    return true;
  }, [form, step]);

  useEffect(() => {
    if (!submitted?.accessToken) return;
    const refresh = async () => {
      const response = await fetch(`/control/v1/onboarding/${submitted.onboardingId}`, { headers: { authorization: `Bearer ${submitted.accessToken}` } });
      if (!response.ok) return;
      const next = await response.json() as ProvisioningState;
      setSubmitted((current) => {
        if (!current) return current;
        const merged = { ...current, ...next };
        const { temporary_password: _password, ...restorable } = merged;
        localStorage.setItem("exora-onboarding-active", JSON.stringify(restorable));
        return merged;
      });
    };
    void refresh();
    if (!["queued", "provisioning"].includes(submitted.status)) return;
    const poll = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(poll);
  }, [submitted?.accessToken, submitted?.onboardingId, submitted?.status]);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const requestPayload = { ...form, email: form.email.trim(), termsAccepted: true as const };
      const serializedPayload = JSON.stringify(requestPayload);
      let requestKey = localStorage.getItem("exora-onboarding-key");
      let accessKey = localStorage.getItem("exora-onboarding-access");
      const previousPayload = localStorage.getItem("exora-onboarding-request-payload");
      if (!requestKey || !accessKey || previousPayload !== serializedPayload) {
        requestKey = crypto.randomUUID();
        accessKey = `${crypto.randomUUID()}${crypto.randomUUID()}`;
        localStorage.setItem("exora-onboarding-key", requestKey);
        localStorage.setItem("exora-onboarding-access", accessKey);
        localStorage.setItem("exora-onboarding-request-payload", serializedPayload);
      }
      const response = await fetch("/control/v1/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": requestKey, "x-onboarding-access": accessKey },
        body: serializedPayload,
      });
      const body = await response.json() as ProvisioningState & ApiError;
      if (!response.ok) {
        const validationMessage = body.issues
          ?.map((issue) => [issue.path, issue.message].filter(Boolean).join(": "))
          .filter(Boolean)
          .join(" · ");
        throw new Error(body.message || validationMessage || "We could not create the workspace request.");
      }
      setSubmitted(body as ProvisioningState);
      if (body.accessToken) {
        localStorage.setItem(`exora-onboarding-token:${body.onboardingId}`, body.accessToken);
        localStorage.setItem("exora-onboarding-active", JSON.stringify(body));
      }
    } catch (reason) {
      setSubmitError((reason as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    const ready = submitted.status === "ready";
    return (
      <div className="onboarding-shell success-panel">
        <button className="icon-button close-button" onClick={onClose} aria-label="Close"><X /></button>
        <span className="success-icon">{ready ? <CircleCheck /> : <Sparkles />}</span>
        <p className="eyebrow">{ready ? "Workspace ready" : `Provisioning · ${submitted.status}`}</p>
        <h2>{ready ? `${form.organisation} is ready.` : `We’re building ${form.organisation}.`}</h2>
        <p>{ready ? "Your isolated website, staff workspace and database are online." : "Exora has accepted the launch configuration. This screen updates as the isolated deployment is created."}</p>
        <div className="launch-links">
          <div><span>Patient website</span><strong>{submitted.public_url || `${form.slug}.exora.health · preparing`}</strong></div>
          <div><span>Staff workspace</span><strong>{submitted.staff_url || `staff.${form.slug}.exora.health · preparing`}</strong></div>
        </div>
        {ready && submitted.admin_username && submitted.temporary_password && <section className="admin-credentials" aria-label="Administrator sign-in details">
          <div className="credential-heading"><ShieldCheck /><div><strong>Administrator sign-in</strong><span>Save these details now. The temporary password is available here for 24 hours.</span></div></div>
          <dl>
            <div><dt>Email</dt><dd>{submitted.admin_username}</dd></div>
            <div><dt>Temporary password</dt><dd><code>{submitted.temporary_password}</code><button className="copy-credential" onClick={() => { void navigator.clipboard.writeText(submitted.temporary_password!); setCopied(true); }}><Copy size={15} /> {copied ? "Copied" : "Copy"}</button></dd></div>
          </dl>
          <p>You’ll be required to replace this password when you first sign in. Afterward, use <strong>Workspace settings → My account → Manage password</strong>.</p>
        </section>}
        {submitted.error && <p className="submit-error">{submitted.error}</p>}
        <div className="success-actions">{ready && <a className="button primary" href={submitted.staff_url}>Open staff workspace</a>}{ready && <a className="button outline" href={submitted.public_url}>Open patient website</a>}<button className="button outline" onClick={onClose}>Return to Exora Health</button></div>
      </div>
    );
  }

  return (
    <div className="onboarding-shell">
      <aside className="step-rail">
        <Brand />
        <div className="step-heading">
          <p className="eyebrow">Workspace setup</p>
          <h2>A clear path from clinic to launch.</h2>
          <p>Your progress is saved on this device while you complete the setup.</p>
        </div>
        <ol>
          {steps.map((item, index) => (
            <li key={item.label} className={index === step ? "active" : index < step ? "done" : ""}>
              <span>{index < step ? <Check size={16} /> : index + 1}</span>
              <div><strong>{item.label}</strong><small>{item.hint}</small></div>
            </li>
          ))}
        </ol>
        <div className="security-note"><ShieldCheck size={18} /> A dedicated deployment and database are created for every organisation.</div>
      </aside>
      <section className="step-content">
        <button className="icon-button close-button" onClick={onClose} aria-label="Close"><X /></button>
        <div className="mobile-progress"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <p className="eyebrow">Step {step + 1} of {steps.length}</p>
        {step === 0 && <>
          <h2>Let’s start with the workspace owner.</h2>
          <p className="form-intro">This person receives the first administrator activation link.</p>
          <div className="form-grid">
            <Field label="Full name" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="Dr Asha Rao" autoFocus />
            <Field label="Work email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="asha@clinic.com" type="email" />
            <Field label="Phone number" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" />
          </div>
        </>}
        {step === 1 && <>
          <h2>Name your Exora workspace.</h2>
          <p className="form-intro">The workspace name and address become the starting point for your patient and staff links.</p>
          <div className="form-grid">
            <Field label="Organisation name" value={form.organisation} onChange={(e) => { set("organisation", e.target.value); if (!form.slug || form.slug === slugify(form.organisation)) set("slug", slugify(e.target.value)); }} placeholder="Northstar Health" autoFocus />
            <Field label="Workspace address" value={form.slug} onChange={(e) => set("slug", slugify(e.target.value))} placeholder="northstar-health" />
            <div className="url-preview">{form.slug || "your-clinic"}.exora.health</div>
          </div>
        </>}
        {step === 2 && <>
          <h2>Add your first facility.</h2>
          <p className="form-intro">You can add more branches later. This facility anchors schedules, services and access.</p>
          <div className="form-grid two-column">
            <Field label="Facility name" value={form.facilityName} onChange={(e) => set("facilityName", e.target.value)} placeholder="Indiranagar Clinic" autoFocus />
            <label className="field"><span>Facility type</span><select value={form.facilityType} onChange={(e) => set("facilityType", e.target.value)}><option value="clinic">Clinic</option><option value="hospital">Hospital</option><option value="diagnostic_centre">Diagnostic centre</option><option value="virtual">Virtual clinic</option></select></label>
            <Field label="City" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Bengaluru" />
            <label className="field"><span>Timezone</span><select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}><option>Asia/Kolkata</option><option>Asia/Dubai</option><option>Europe/London</option><option>America/New_York</option></select></label>
          </div>
        </>}
        {step === 3 && <>
          <h2>Choose how you want to launch.</h2>
          <p className="form-intro">Plans control server-side entitlements. You can change them without rebuilding your workspace.</p>
          <div className="plan-picker">
            {plans.map((plan) => <button key={plan.id} className={form.plan === plan.id ? "selected" : ""} onClick={() => { set("plan", plan.id); if (plan.id === "launch") set("voice", false); }}><small>{plan.eyebrow}</small><strong>{plan.name}</strong><span>{plan.items.slice(0, 2).join(" · ")}</span>{form.plan === plan.id && <CircleCheck size={19} />}</button>)}
          </div>
          <div className="channel-row">
            <label><input type="checkbox" checked={form.voice} disabled={form.plan === "launch"} onChange={(e) => set("voice", e.target.checked)} /><span><Bot /><strong>Voice agent</strong><small>{form.plan === "launch" ? "Available on Connect and Scale." : "A tenant-specific agent and booking connection."}</small></span></label>
            <label><input type="checkbox" checked={form.whatsapp} onChange={(e) => set("whatsapp", e.target.checked)} /><span><Users /><strong>WhatsApp workspace</strong><small>Reception, templates and patient notifications.</small></span></label>
          </div>
        </>}
        {step === 4 && <>
          <h2>Review your launch workspace.</h2>
          <p className="form-intro">Provisioning uses this exact configuration and can be retried without creating duplicates.</p>
          <div className="review-card">
            <div><span>Organisation</span><strong>{form.organisation}</strong></div>
            <div><span>Owner</span><strong>{form.ownerName} · {form.email}</strong></div>
            <div><span>First facility</span><strong>{form.facilityName}, {form.city}</strong></div>
            <div><span>Plan</span><strong>{plans.find((p) => p.id === form.plan)?.name}</strong></div>
            <div><span>Channels</span><strong>{[form.voice && "Voice", form.whatsapp && "WhatsApp"].filter(Boolean).join(", ") || "Web only"}</strong></div>
            <div><span>Patient URL</span><strong>{form.slug}.exora.health</strong></div>
          </div>
          <label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>I confirm these details and understand that clinical data will stay inside this organisation’s isolated deployment.</span></label>
          {submitError && <p className="submit-error">{submitError}</p>}
        </>}
        <div className="form-actions">
          <button className="button quiet" onClick={() => step === 0 ? onClose() : setStep(step - 1)}><ChevronLeft size={17} /> {step === 0 ? "Back to site" : "Previous"}</button>
          <button className="button primary" disabled={!valid || submitting || (step === steps.length - 1 && !consent)} onClick={() => step === steps.length - 1 ? void submit() : setStep(step + 1)}>{step === steps.length - 1 ? (submitting ? "Creating request…" : "Request workspace") : "Continue"} <ChevronRight size={17} /></button>
        </div>
      </section>
    </div>
  );
}

export function App() {
  const [menu, setMenu] = useState(false);
  const [onboarding, setOnboarding] = useState(location.hash === "#onboarding");
  const openOnboarding = () => { setOnboarding(true); location.hash = "onboarding"; };
  const closeOnboarding = () => { setOnboarding(false); history.replaceState(null, "", location.pathname); };
  useEffect(() => {
    const listener = () => setOnboarding(location.hash === "#onboarding");
    addEventListener("hashchange", listener);
    return () => removeEventListener("hashchange", listener);
  }, []);
  if (onboarding) return <Onboarding onClose={closeOnboarding} />;

  return <main id="top">
    <header className="site-header">
      <Brand />
      <nav className={menu ? "open" : ""}>
        <a href="#platform" onClick={() => setMenu(false)}>Platform</a>
        <a href="#how" onClick={() => setMenu(false)}>How it works</a>
        <a href="#plans" onClick={() => setMenu(false)}>Plans</a>
        <button className="button small primary" onClick={openOnboarding}>Create workspace <ArrowRight size={15} /></button>
      </nav>
      <button className="icon-button menu-button" onClick={() => setMenu(!menu)} aria-label="Open menu"><Menu /></button>
    </header>

    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow"><Sparkles size={15} /> The operating system for modern clinics</p>
        <h1>Your clinic.<br /><em>Connected end to end.</em></h1>
        <p className="hero-lede">Launch a patient-ready website, appointment system, staff workspace and voice front desk—configured for your organisation and isolated from every other clinic.</p>
        <div className="hero-actions"><button className="button primary large" onClick={openOnboarding}>Build your workspace <ArrowRight size={18} /></button><a className="button outline large" href="#how">See the launch path</a></div>
        <div className="trust-row"><span><Check /> Dedicated deployment</span><span><Check /> Your own data boundary</span><span><Check /> Guided onboarding</span></div>
      </div>
      <div className="product-scene" aria-label="Exora Health product overview">
        <div className="scene-glow" />
        <div className="dashboard-card">
          <div className="dash-top"><Brand /><span>Indiranagar Clinic⌄</span></div>
          <div className="dash-layout">
            <div className="dash-nav"><i /><i /><i /><i /><i /></div>
            <div className="dash-main"><span className="dash-label">TODAY</span><h3>Good morning, Dr Asha</h3><div className="stat-row"><div><b>18</b><small>Appointments</small></div><div><b>6</b><small>Waiting</small></div><div><b>11</b><small>Completed</small></div></div><div className="schedule-lines"><i /><i /><i /></div></div>
          </div>
        </div>
        <div className="floating-card booking"><CalendarCheck2 /><div><small>BOOKING CONFIRMED</small><strong>Tuesday · 10:30 AM</strong><span>Dr Asha Rao · General Medicine</span></div></div>
        <div className="floating-card voice"><span className="pulse"><Bot /></span><div><small>EXORA VOICE</small><strong>Front desk is answering</strong><span>Booking securely in your workspace</span></div></div>
      </div>
    </section>

    <section className="proof-strip"><span>One platform for</span><strong>Independent clinics</strong><i /><strong>Multi-speciality hospitals</strong><i /><strong>Growing care networks</strong></section>

    <section className="section" id="platform">
      <div className="section-heading"><p className="eyebrow">One connected platform</p><h2>The patient experience and clinic operations finally share the same source of truth.</h2><p>Exora turns four disconnected projects into one repeatable system—without making every clinic look or operate the same.</p></div>
      <div className="feature-grid">{features.map(({ icon: Icon, title, text }, index) => <article key={title}><span className={`feature-icon tone-${index}`}><Icon /></span><p>0{index + 1}</p><h3>{title}</h3><span>{text}</span></article>)}</div>
    </section>

    <section className="dark-section" id="how">
      <div className="section-heading light"><p className="eyebrow">From signup to operating system</p><h2>A guided launch, not another empty dashboard.</h2><p>Each step creates part of the workspace your patients and staff will actually use.</p></div>
      <div className="journey">
        <article><span>01</span><Building2 /><h3>Tell us how you operate</h3><p>Brand, branches, services, doctors, hours and the channels you want to launch.</p></article>
        <div className="journey-line" />
        <article><span>02</span><Sparkles /><h3>Exora configures your system</h3><p>A dedicated deployment, database, website, staff workspace and secure service identities.</p></article>
        <div className="journey-line" />
        <article><span>03</span><HeartPulse /><h3>Invite your team and go live</h3><p>Review the patient journey, activate staff identities and publish when you are ready.</p></article>
      </div>
      <button className="button inverse large" onClick={openOnboarding}>Start the guided setup <ArrowRight size={18} /></button>
    </section>

    <section className="section plans-section" id="plans">
      <div className="section-heading"><p className="eyebrow">Grow without changing systems</p><h2>Start with the workflow you need. Add channels when the team is ready.</h2></div>
      <div className="plans-grid">{plans.map((plan, index) => <article key={plan.id} className={index === 1 ? "featured" : ""}>{index === 1 && <span className="popular">Recommended</span>}<p>{plan.eyebrow}</p><h3>{plan.name}</h3><ul>{plan.items.map((item) => <li key={item}><Check />{item}</li>)}</ul><button className={`button ${index === 1 ? "primary" : "outline"}`} onClick={openOnboarding}>Choose {plan.name}</button></article>)}</div>
    </section>

    <section className="final-cta"><div><p className="eyebrow">Your next clinic system</p><h2>Built around your care, ready to evolve with it.</h2><p>Complete the guided setup now. Your progress is saved as you go.</p></div><button className="button inverse large" onClick={openOnboarding}>Create your Exora workspace <ArrowRight /></button></section>

    <footer><Brand /><p>Connected clinic operations, patient experiences and communication.</p><span>© 2026 Exora Health</span></footer>
  </main>;
}
