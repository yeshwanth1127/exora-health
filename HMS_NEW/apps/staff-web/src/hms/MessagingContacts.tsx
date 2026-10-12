import { useState } from "react";
import {
  ContactPointCreateSchema,
  ContactInterestSchema,
  MessagingConsentCreateSchema,
  type ContactPoint,
} from "@hms/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { query } from "./client";
import { useCommand, useQuery, useWorkspace } from "./hooks";
import { useUnsaved } from "./leave";
import {
  decodeCapabilities,
  decodeContacts,
  messagingAvailability,
} from "./comms-model";
import { Choice, Empty, ErrorMessage, Field, Hint, LoadingState } from "./ui";

type Owner =
  | { patientId: string; bookingPartyId?: never }
  | { patientId?: never; bookingPartyId: string };
export function MessagingContacts(owner: Owner) {
  const { facility, can } = useWorkspace();
  const contacts = useQuery(
    `/v1/contact-points?${query({ facilityId: facility.facilityId, ...owner })}`,
    0,
    decodeContacts,
  );
  const capability = useQuery(
    `/v1/comms/capabilities?${query({ facilityId: facility.facilityId })}`,
    0,
    decodeCapabilities,
  );
  const cmd = useCommand();
  const [address, setAddress] = useState(""),
    [error, setError] = useState("");
  useUnsaved(!!address || cmd.unknown);
  const active = capability.data?.moduleStatus === "active";
  const writable = can("comms.reply") && active;
  return (
    <section
      className="space-y-4 border-t pt-5"
      aria-label="Messaging preferences"
    >
      <h3 className="font-semibold">Messaging preferences</h3>
      <p className="text-xs text-muted-foreground">
        WhatsApp contacts and permission to message are separate from clinical
        consent. Adding a phone does not opt anyone in.
      </p>
      <LoadingState {...capability}>
        {capability.data && capability.data.moduleStatus !== "active" && (
          <Hint>
            {messagingAvailability(capability.data.moduleStatus)} New contacts
            and opt-ins are unavailable; existing opt-outs remain available.
          </Hint>
        )}
      </LoadingState>
      <LoadingState {...contacts}>
        {contacts.data?.items.map((contact) => (
          <ContactConsent
            key={contact.id}
            contact={contact}
            active={active}
            canReply={can("comms.reply")}
            canManage={can("comms.manage")}
            onSaved={contacts.refresh}
          />
        ))}
        {contacts.data?.items.length === 0 && (
          <Empty>
            No WhatsApp contact has been selected for this person at this
            clinic.
          </Empty>
        )}
      </LoadingState>
      {can("comms.reply") && (
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const body = ContactPointCreateSchema.safeParse({
              facilityId: facility.facilityId,
              ...owner,
              channel: "whatsapp",
              address,
            });
            if (!body.success) {
              setError(
                "Use an international phone number, for example +919876543210.",
              );
              return;
            }
            setError("");
            if (await cmd.run("/v1/contact-points", body.data, true)) {
              setAddress("");
              void contacts.refresh();
            }
          }}
        >
          <Field
            title="WhatsApp phone (with country code)"
            id="messaging-address"
          >
            <Input
              id="messaging-address"
              type="tel"
              autoComplete="off"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="+919876543210"
              disabled={!writable || cmd.busy || cmd.unknown}
            />
          </Field>
          <ErrorMessage text={error || cmd.error} />
          <Button
            type="submit"
            variant="outline"
            disabled={!writable || !address || cmd.busy || cmd.unknown}
          >
            {cmd.busy ? "Saving…" : "Add messaging contact"}
          </Button>
          {cmd.unknown && (
            <p className="text-xs text-muted-foreground">
              The save outcome is unknown. Close and reopen this record to check
              before making another change.
            </p>
          )}
        </form>
      )}
    </section>
  );
}

function ContactConsent({
  contact,
  active,
  canReply,
  canManage,
  onSaved,
}: {
  contact: ContactPoint;
  active: boolean;
  canReply: boolean;
  canManage: boolean;
  onSaved: () => Promise<boolean>;
}) {
  const cmd = useCommand();
  const [purpose, setPurpose] = useState("reminders"),
    [evidence, setEvidence] = useState(""),
    [affirmed, setAffirmed] = useState(false),
    [error, setError] = useState("");
  useUnsaved(!!evidence || affirmed || cmd.unknown);
  const writable = active && (purpose === "marketing" ? canManage : canReply);
  async function record(action: "opt_in" | "opt_out" | "stop") {
    const body = MessagingConsentCreateSchema.safeParse({
      purpose,
      action,
      source: "staff",
      evidence,
      explicitOptIn: affirmed,
    });
    if (!body.success) {
      setError(
        action === "opt_in"
          ? "Record how consent was obtained and confirm a fresh, explicit opt-in."
          : "Record the withdrawal request or STOP evidence.",
      );
      return;
    }
    setError("");
    if (
      await cmd.run(
        `/v1/contact-points/${contact.id}/consents`,
        body.data,
        true,
      )
    ) {
      setEvidence("");
      setAffirmed(false);
      await onSaved();
    }
  }
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium break-all">{contact.address}</p>
      {!!contact.interests?.length && (
        <p className="text-xs text-muted-foreground">
          Declared interests: {contact.interests.join(", ")}
        </p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Care: {contact.consents.care ? "Opted in" : "No consent"}</span>
        <span>
          Reminders: {contact.consents.reminders ? "Opted in" : "No consent"}
        </span>
        <span>
          Marketing: {contact.consents.marketing ? "Opted in" : "No consent"}
        </span>
      </div>
      {canManage && contact.status === "active" && (
        <DeclaredInterest contact={contact} active={active} onSaved={onSaved} />
      )}
      {(canReply || canManage) && contact.status === "active" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void record("opt_in");
          }}
        >
          <Choice
            label="Message purpose"
            value={purpose}
            onChange={setPurpose}
            options={[
              { value: "care", label: "Booking and care messages" },
              { value: "reminders", label: "Appointment reminders" },
              { value: "marketing", label: "Marketing" },
            ]}
            disabled={cmd.busy || cmd.unknown}
          />
          {purpose === "marketing" && !canManage && (
            <p className="text-xs text-muted-foreground">
              An administrator must record marketing opt-in. You can still
              record a withdrawal or STOP request below.
            </p>
          )}
          <Field
            title="Consent or withdrawal evidence"
            id={`consent-${contact.id}`}
          >
            <Textarea
              id={`consent-${contact.id}`}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              maxLength={500}
              placeholder="How and when the person requested this change. Do not include clinical details."
              disabled={cmd.busy || cmd.unknown}
            />
          </Field>
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={affirmed}
              onChange={(e) => setAffirmed(e.target.checked)}
              disabled={!writable || cmd.busy || cmd.unknown}
            />
            The person gave a fresh, explicit opt-in for this purpose.
          </label>
          <ErrorMessage text={error || cmd.error} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="outline"
              disabled={
                !writable ||
                !affirmed ||
                evidence.trim().length < 3 ||
                cmd.busy ||
                cmd.unknown
              }
            >
              Record opt-in
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void record("opt_out")}
              disabled={
                !canReply ||
                evidence.trim().length < 3 ||
                cmd.busy ||
                cmd.unknown
              }
            >
              Withdraw this purpose
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void record("stop")}
              disabled={
                !canReply ||
                evidence.trim().length < 3 ||
                cmd.busy ||
                cmd.unknown
              }
            >
              Record STOP for this phone
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            STOP blocks every messaging purpose for this phone across matching
            contacts. Only a fresh opt-in can restore its stated purpose.
          </p>
          {cmd.unknown && (
            <Hint>
              The outcome is unknown. Close and reopen this record to verify the
              saved consent before another change.
            </Hint>
          )}
        </form>
      )}
    </div>
  );
}

function DeclaredInterest({
  contact,
  active,
  onSaved,
}: {
  contact: ContactPoint;
  active: boolean;
  onSaved: () => Promise<boolean>;
}) {
  const cmd = useCommand();
  const [interest, setInterest] = useState(""),
    [evidence, setEvidence] = useState(""),
    [error, setError] = useState("");
  useUnsaved(!!interest || !!evidence || cmd.unknown);
  return (
    <details className="border-t pt-3">
      <summary className="text-xs font-medium cursor-pointer">
        Voluntarily declared marketing interest
      </summary>
      <form
        className="space-y-3 mt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const parsed = ContactInterestSchema.safeParse({
            interest,
            evidence,
            version: contact.version,
          });
          if (!parsed.success) {
            setError(
              "Enter the person's declared interest and evidence. Reload if the contact revision is missing.",
            );
            return;
          }
          setError("");
          if (
            await cmd.run(
              `/v1/contact-points/${contact.id}/interests`,
              parsed.data,
              true,
            )
          ) {
            setInterest("");
            setEvidence("");
            await onSaved();
          }
        }}
      >
        <p className="text-xs text-muted-foreground">
          Record only an interest the contact voluntarily declared. Do not infer
          it from a diagnosis, chart or another person sharing this phone.
          Current marketing opt-in is required.
        </p>
        <Field title="Declared interest" id={`interest-${contact.id}`}>
          <Input
            id={`interest-${contact.id}`}
            value={interest}
            maxLength={100}
            onChange={(e) => setInterest(e.target.value)}
            disabled={
              !active || !contact.consents.marketing || cmd.busy || cmd.unknown
            }
          />
        </Field>
        <Field
          title="Declaration evidence"
          id={`interest-evidence-${contact.id}`}
        >
          <Textarea
            id={`interest-evidence-${contact.id}`}
            value={evidence}
            maxLength={500}
            onChange={(e) => setEvidence(e.target.value)}
            disabled={
              !active || !contact.consents.marketing || cmd.busy || cmd.unknown
            }
          />
        </Field>
        <ErrorMessage text={error || cmd.error} />
        <Button
          type="submit"
          variant="outline"
          disabled={
            !active ||
            !contact.consents.marketing ||
            interest.trim().length < 2 ||
            evidence.trim().length < 3 ||
            cmd.busy ||
            cmd.unknown
          }
        >
          Record declared interest
        </Button>
        {!contact.consents.marketing && (
          <p className="text-xs text-muted-foreground">
            Record fresh marketing consent before declaring an interest.
          </p>
        )}
        {cmd.unknown && (
          <Hint>
            The outcome is unknown. Reload this contact before another change.
          </Hint>
        )}
      </form>
    </details>
  );
}
