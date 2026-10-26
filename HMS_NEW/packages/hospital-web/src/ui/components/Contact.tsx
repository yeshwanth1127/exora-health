import {
  ArrowRight,
  CalendarDays,
  Check,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button as ArcButton } from "../../vendor/arc/button/button";
import { Input as ArcInput } from "../../vendor/arc/input/input";
import { Select as ArcSelect } from "../../vendor/arc/select/select";
import { Textarea as ArcTextarea } from "../../vendor/arc/textarea/textarea";
import { useWebsite } from "../Runtime";
import { Intro } from "./Intro";
import { Link } from "./Link";

export function Contact({ params }: { params: URLSearchParams }) {
  const { hospital, plans, treatments, scans, demoEnabled, profile, api } =
    useWebsite();

  const [sent, setSent] = useState(false),
    [sending, setSending] = useState(false),
    [failure, setFailure] = useState("");
  const requestKey = useRef<{ body: string; key: string } | null>(null);
  const [message, setMessage] = useState("");
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [topic, setTopic] = useState(
      params.has("plan")
        ? "Health check enquiry"
        : params.has("insurer")
          ? "Insurance enquiry"
          : "General enquiry",
    );
  const plan = plans.find((p) => p.id === params.get("plan"));
  const care = [...treatments, ...scans].find(
    (i) => i.id === (params.get("treatment") || params.get("scan")),
  );
  return (
    <>
      <Intro eyebrow="Contact us" title="How can we help?">
        <p>
          {demoEnabled
            ? "Prepare a sample enquiry, or find the right next step for your visit."
            : "Send a general enquiry, or use our appointment assistant to book a visit."}
        </p>
      </Intro>
      <section className="section container contact-layout">
        <aside>
          <h2>{hospital.name}</h2>
          <p>{hospital.area}</p>
          <p>
            {demoEnabled
              ? "Exact address, contact numbers and operating hours are awaiting verification."
              : profile?.address}
          </p>
          {!demoEnabled && profile?.phone && (
            <p>
              <a href={"tel:" + profile.phone}>{profile.phone}</a>
            </p>
          )}
          <div className="contact-links">
            <Link to="/visit">
              <MapPin size={18} /> Location & visiting
            </Link>
            <Link to="/insurance">
              <ShieldCheck size={18} /> Insurance & payment
            </Link>
            <Link to="/book">
              <CalendarDays size={18} /> Book an appointment
            </Link>
          </div>
        </aside>
        <div>
          {sent ? (
            <div className="completion" role="status">
              <Check size={36} />
              <h2>
                {demoEnabled ? "Enquiry preview complete" : "Enquiry received"}
              </h2>
              <p>
                {demoEnabled
                  ? `Thank you, ${name}. This demonstrates the completed form state. Nothing was sent and no data was saved.`
                  : `Thank you, ${name}. Your enquiry was saved in the hospital’s inbox for review. This does not book an appointment.`}
              </p>
              <ArcButton onClick={() => setSent(false)}>Edit enquiry</ArcButton>
            </div>
          ) : (
            <form
              className="contact-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (sending) return;
                if (demoEnabled) {
                  setSent(true);
                  return;
                }
                if (!api) {
                  setFailure("The hospital enquiry connection is unavailable.");
                  return;
                }
                setSending(true);
                setFailure("");
                const body = JSON.stringify({
                  name,
                  email,
                  topic,
                  message,
                  context:
                    care?.name ||
                    plan?.name ||
                    params.get("insurer") ||
                    undefined,
                });
                if (requestKey.current?.body !== body)
                  requestKey.current = { body, key: crypto.randomUUID() };
                try {
                  const r = await fetch(
                    "/public/v1/booking/" +
                      encodeURIComponent(api.site) +
                      "/enquiries",
                    {
                      method: "POST",
                      credentials: "omit",
                      headers: {
                        "Content-Type": "application/json",
                        "Idempotency-Key": requestKey.current!.key,
                      },
                      body,
                      signal: AbortSignal.timeout(20000),
                    },
                  );
                  if (!r.ok) {
                    const d = await r.json().catch(() => null);
                    throw Error(
                      d?.error?.message ||
                        "The enquiry could not be saved. Please try again.",
                    );
                  }
                  const d = await r.json();
                  if (d.status !== "received" || typeof d.id !== "string")
                    throw Error(
                      "Receipt could not be verified. Retry the same enquiry to check.",
                    );
                  setSent(true);
                } catch (e) {
                  setFailure(
                    e instanceof Error
                      ? e.message
                      : "We could not confirm receipt. Retry the same enquiry to check.",
                  );
                } finally {
                  setSending(false);
                }
              }}
            >
              <h2>Send an enquiry</h2>
              <p className="muted small">
                {demoEnabled
                  ? "Preview only. Use sample details; this form does not send messages."
                  : "General enquiries only. Do not include medical records or sensitive health information. To book, use the appointment assistant."}
              </p>
              {failure && <p role="alert">{failure}</p>}
              {care && (
                <div className="notice">
                  Service selected: <strong>{care.name}</strong>
                </div>
              )}
              {plan && (
                <div className="notice">
                  Plan selected: <strong>{plan.name}</strong> · sample price ₹
                  {plan.price.toLocaleString("en-IN")}
                </div>
              )}
              {params.get("insurer") && (
                <div className="notice">
                  {demoEnabled
                    ? "Example insurer selected: "
                    : "Insurer selected: "}
                  {params.get("insurer")}
                </div>
              )}
              <ArcInput
                label="Your name"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
              <ArcInput
                label="Email address"
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
              <ArcSelect
                label="What can we help with?"
                value={topic}
                onValueChange={setTopic}
                options={[
                  "General enquiry",
                  "Health check enquiry",
                  "Insurance enquiry",
                  "Visiting information",
                ].map((t) => ({ value: t, label: t }))}
              />
              <ArcTextarea
                label="Your message"
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  demoEnabled ? "Enter a sample enquiry" : "How can we help?"
                }
                maxLength={2000}
              />
              <ArcButton disabled={sending}>
                {sending
                  ? "Saving…"
                  : demoEnabled
                    ? "Preview enquiry"
                    : "Send enquiry"}{" "}
                <ArrowRight size={16} />
              </ArcButton>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
