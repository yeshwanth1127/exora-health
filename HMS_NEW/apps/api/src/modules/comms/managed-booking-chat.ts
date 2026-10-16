import { sql, type DB, type Kysely, type Transaction } from "@hms/db";
import {
  forbidden,
  preconditionFailed,
  runQuery,
  setTransactionContext,
} from "@hms/platform";
import { authorize, resolvePrincipal } from "../../auth/principal.ts";
import type { Caller } from "../../caller.ts";
import {
  publicBook,
  publicCatalog,
  publicSlots,
} from "../booking/public-booking.ts";
import { readSlot, type PublicBookingSite } from "../booking/public-config.ts";
import { addressLock } from "./notifications.ts";
import { assertWhatsAppActive } from "./whatsapp.ts";
import type { ManagedSettings } from "./managed-config.ts";

type Tx = Transaction<DB>;
type State = {
  phoneNumberId?: string;
  department?: string;
  step?:
    | "consent"
    | "reminders"
    | "department"
    | "doctor"
    | "mode"
    | "slot"
    | "name"
    | "confirm";
  page?: number;
  doctor?: string;
  doctorName?: string;
  virtual?: boolean;
  mode?: "in_person" | "virtual";
  from?: string;
  choices?: any[];
  selected?: any;
  name?: string;
};
export function bookingSite(
  settings: ManagedSettings,
  tenant: string,
  facility: string,
) {
  const sites =
    settings.booking?.sites.filter(
      (s) => s.tenantId === tenant && s.facilityId === facility,
    ) ?? [];
  // Multiple website aliases can share a facility, but authority must be identical.
  const site = sites[0];
  if (
    !site ||
    sites.some(
      (s) =>
        s.identityIssuer !== site.identityIssuer ||
        s.identitySubject !== site.identitySubject,
    )
  )
    throw preconditionFailed(
      "Online booking is being prepared for this clinic.",
    );
  return site;
}
export async function bookingAuthority(
  db: Kysely<DB>,
  site: PublicBookingSite,
): Promise<Caller> {
  const p = await resolvePrincipal(
    db,
    { issuer: site.identityIssuer, subject: site.identitySubject },
    site.tenantId,
  );
  if (!p.isSystemAccount)
    throw forbidden("Booking requires a dedicated integration account.");
  authorize(p, "appointments.read", site.facilityId);
  authorize(p, "appointments.book", site.facilityId);
  return {
    tenantId: p.tenantId,
    actor: { kind: "staff", staffId: p.staffId, userId: p.userAccountId },
  };
}
export async function verifyChatActivation(
  db: Kysely<DB>,
  caller: Caller,
  facility: string,
  settings: ManagedSettings,
) {
  if (!settings.whatsappSending || !settings.meta)
    throw preconditionFailed("WhatsApp sending is being prepared.");
  const site = bookingSite(settings, caller.tenantId, facility),
    actor = await bookingAuthority(db, site);
  const catalog = await publicCatalog(db, actor, site);
  if (!catalog.doctors.length)
    throw preconditionFailed(
      "Publish at least one doctor with a consultation fee and schedule before accepting bookings.",
    );
  return site;
}
const localTime = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
const choice = (text: string, choices: any[] | undefined) =>
  /^\d{1,2}$/.test(text) ? choices?.[Number(text) - 1] : undefined;
/** Each signed inbound ID is consumed once. The booking command uses that same durable ID on retries. */
export async function dispatchBookingChats(
  db: Kysely<DB>,
  settings: ManagedSettings,
) {
  if (
    !settings.whatsappSending ||
    !settings.meta ||
    !settings.booking?.sites.length
  )
    return 0;
  const { rows } = await sql<{
    tenant_id: string;
    id: string;
  }>`SELECT * FROM comms.booking_chat_candidates()`.execute(db);
  let count = 0;
  for (const r of rows) {
    try {
      const processed = await db.transaction().execute(async (tx) => {
        await setTransactionContext(tx, r.tenant_id);
        await sql`SET LOCAL ROLE mod_comms`.execute(tx);
        const {
          rows: [input],
        } =
          await sql<any>`SELECT i.*,c.facility_id,c.contact_point_id,p.address FROM comms.inbound_message i
          JOIN comms.conversation c ON c.tenant_id=i.tenant_id AND c.id=i.conversation_id
          JOIN comms.contact_point p ON p.tenant_id=c.tenant_id AND p.id=c.contact_point_id WHERE i.id=${r.id}`.execute(
            tx,
          );
        if (!input) return false;
        await sql`SELECT pg_advisory_xact_lock(hashtextextended(${r.tenant_id + ":booking-chat:" + input.conversation_id},0))`.execute(
          tx,
        );
        await addressLock(tx, r.tenant_id, input.address);
        // Preserve provider arrival order across concurrent workers.
        const {
          rows: [first],
        } = await sql<{
          id: string;
        }>`SELECT i.id FROM comms.inbound_message i WHERE i.conversation_id=${input.conversation_id}
          AND NOT EXISTS(SELECT 1 FROM comms.booking_chat_input p WHERE p.inbound_id=i.id) AND i.created_at>=(SELECT booking_enabled_at FROM comms.whatsapp_workspace WHERE facility_id=${input.facility_id})
          ORDER BY i.created_at,i.id LIMIT 1`.execute(tx);
        if (first?.id !== r.id) return false;
        const {
          rows: [mark],
        } =
          await sql`INSERT INTO comms.booking_chat_input(tenant_id,inbound_id) VALUES(${r.tenant_id},${r.id}) ON CONFLICT DO NOTHING RETURNING id`.execute(
            tx,
          );
        if (!mark) return false;
        const {
          rows: [live],
        } =
          await sql<any>`SELECT w.draft,w.preferences,w.booking_enabled_at,c.automation_state,c.status,c.last_inbound_at,comms.has_consent(p.id,'care') AS consent
          FROM comms.whatsapp_workspace w JOIN comms.conversation c ON c.facility_id=w.facility_id AND c.tenant_id=w.tenant_id
          JOIN comms.contact_point p ON p.id=c.contact_point_id AND p.tenant_id=c.tenant_id
          JOIN comms.managed_connection mc ON mc.facility_id=w.facility_id AND mc.tenant_id=w.tenant_id AND mc.provider='whatsapp' AND mc.enabled
          WHERE c.id=${input.conversation_id} AND w.draft->>'live'='true' AND coalesce(w.draft->>'paused','false')<>'true'
          AND p.status='active' AND mc.external_id=${input.phone_number_id} AND mc.metadata->>'subscribed'='true' AND c.last_inbound_at>now()-interval '24 hours'`.execute(
            tx,
          );
        if (
          !live ||
          live.status !== "open" ||
          live.automation_state !== "automation"
        )
          return true;
        await assertWhatsAppActive(tx);
        const text = String(input.text_content).trim(),
          command = text.toUpperCase();
        if (command === "STOP" || command === "[UNSUPPORTED MESSAGE CONTENT]")
          return true;
        const site = bookingSite(settings, r.tenant_id, input.facility_id),
          actor = await bookingAuthority(db, site);
        const catalog = await publicCatalog(db, actor, site);
        const {
          rows: [saved],
        } =
          await sql<any>`SELECT state,expires_at,updated_at FROM comms.booking_chat WHERE conversation_id=${input.conversation_id}`.execute(
            tx,
          );
        let state: State =
          saved &&
          new Date(saved.expires_at) > new Date() &&
          new Date(saved.updated_at) >= new Date(live.booking_enabled_at) &&
          saved.state.phoneNumberId === input.phone_number_id
            ? saved.state
            : {};
        const {
          rows: [recent],
        } = await sql<{
          n: number;
        }>`SELECT count(*)::int AS n FROM comms.outbound_message WHERE conversation_id=${input.conversation_id} AND managed_purpose IN('booking','booking_prompt') AND created_at>now()-interval '10 minutes'`.execute(
          tx,
        );
        if ((recent?.n ?? 0) >= 20) return true;
        const custom = (id: string) =>
          String(
            live.draft.steps?.find((s: any) => s.id === id && s.on)?.message ??
              "",
          ).trim();
        let body = "",
          prompt = false;
        const showDoctors = () => {
          const available = state.department
            ? catalog.doctors.filter((d) =>
                d.departments.includes(state.department!),
              )
            : catalog.doctors;
          const page = state.page ?? 0,
            choices = available.slice(page * 10, page * 10 + 10);
          state = {
            step: "doctor",
            department: state.department,
            page,
            choices: choices.map((d) => ({
              slug: d.slug,
              name: d.name,
              virtual: d.acceptsVirtual,
            })),
          };
          body = choices.length
            ? (custom("doctor") ? custom("doctor") + "\n" : "") +
              "Choose a doctor by replying with a number:\n" +
              choices
                .map(
                  (d, i) =>
                    `${i + 1}. ${d.name}${d.specialty ? " · " + d.specialty : ""}`,
                )
                .join("\n") +
              (available.length > (page + 1) * 10
                ? "\nReply NEXT for more doctors."
                : "")
            : "No doctors are available for online booking. Reply HUMAN to contact reception.";
        };
        const showDirectory = () => {
          const departments = [
            ...new Set(catalog.doctors.flatMap((d) => d.departments)),
          ].slice(0, 50);
          if (
            live.draft.steps?.some((s: any) => s.id === "department" && s.on) &&
            departments.length > 1
          ) {
            state = { step: "department", choices: departments };
            body =
              (custom("department") || "Choose a speciality.") +
              "\n" +
              departments.map((d, i) => `${i + 1}. ${d}`).join("\n");
          } else showDoctors();
        };
        const showSlots = async () => {
          const from = state.from ?? catalog.today,
            to = new Date(Date.parse(from) + 13 * 86400000)
              .toISOString()
              .slice(0, 10);
          const report = await publicSlots(
            db,
            actor,
            site,
            settings.booking!.signingSecret,
            {
              doctor: state.doctor!,
              mode: state.mode ?? "in_person",
              from,
              to: to > catalog.bookingUntil ? catalog.bookingUntil : to,
            },
          );
          const offset = (state.page ?? 0) * 10,
            choices = report.slots.slice(offset, offset + 10);
          state = { ...state, step: "slot", choices };
          body = choices.length
            ? "Choose an available time by replying with a number:\n" +
              choices
                .map(
                  (s, i) =>
                    `${i + 1}. ${localTime(s.startsAt, report.timezone)} · ₹${(s.feeMinor / 100).toFixed(2)}`,
                )
                .join("\n") +
              "\nTimes are held only after confirmation." +
              (report.slots.length > offset + 10
                ? " Reply NEXT for more."
                : "") +
              " Reply with YYYY-MM-DD for another date."
            : "No priced times are available in this date range. Reply with YYYY-MM-DD for another date or HUMAN for reception.";
        };
        if (["RESTART", "BOOK", "HI", "HELLO", "START"].includes(command))
          state = {};
        if (!state.step || (!live.consent && state.step !== "consent")) {
          if (live.consent) showDirectory();
          else {
            state = { step: "consent" };
            prompt = true;
            body = `${custom("welcome") || `Welcome to ${catalog.clinicName}.`} To book, reply YES to receive WhatsApp messages about this booking. Reply HUMAN for reception or STOP to opt out. This does not subscribe you to promotions.`;
          }
        } else if (state.step === "consent") {
          if (command !== "YES") {
            prompt = true;
            body =
              "Reply YES to receive messages about this booking, HUMAN for reception, or STOP to opt out.";
          } else {
            await sql`INSERT INTO comms.messaging_consent_event(tenant_id,contact_point_id,purpose,action,source,evidence,explicit_opt_in,recorded_by) VALUES(${r.tenant_id},${input.contact_point_id},'care','opt_in','provider','Affirmative YES to booking care-message consent in signed WhatsApp conversation',true,NULL)`.execute(
              tx,
            );
            state = { step: "reminders" };
            body =
              "Would you like appointment reminders too? Reply REMIND to opt in, or SKIP to continue without reminders. This does not include promotions.";
          }
        } else if (state.step === "reminders") {
          if (command === "REMIND") {
            await sql`INSERT INTO comms.messaging_consent_event(tenant_id,contact_point_id,purpose,action,source,evidence,explicit_opt_in,recorded_by) VALUES(${r.tenant_id},${input.contact_point_id},'reminders','opt_in','provider','Affirmative REMIND reply to appointment reminder consent in signed WhatsApp conversation',true,NULL)`.execute(
              tx,
            );
            showDirectory();
          } else if (command === "SKIP") showDirectory();
          else
            body =
              "Reply REMIND to receive appointment reminders, or SKIP to continue without them.";
        } else if (state.step === "department") {
          const department = choice(text, state.choices);
          if (typeof department === "string") {
            state = { department };
            showDoctors();
          } else body = "Reply with a speciality number or RESTART.";
        } else if (state.step === "doctor") {
          if (
            command === "NEXT" &&
            catalog.doctors.length > ((state.page ?? 0) + 1) * 10
          ) {
            state.page = (state.page ?? 0) + 1;
            showDoctors();
          } else {
            const d = choice(text, state.choices);
            if (!d)
              body =
                "Please reply with a doctor number from the list, or RESTART.";
            else {
              state = {
                step: "mode",
                doctor: d.slug,
                doctorName: d.name,
                virtual: d.virtual,
              };
              if (d.virtual)
                body =
                  "Choose visit type: reply 1 for in person or 2 for video consultation.";
              else {
                state.mode = "in_person";
                await showSlots();
              }
            }
          }
        } else if (state.step === "mode") {
          if (text !== "1" && !(text === "2" && state.virtual))
            body = "Reply 1 for in person or 2 for video consultation.";
          else {
            state.mode = text === "2" ? "virtual" : "in_person";
            await showSlots();
          }
        } else if (state.step === "slot") {
          if (command === "NEXT") {
            state.page = (state.page ?? 0) + 1;
            await showSlots();
          } else if (
            /^\d{4}-\d{2}-\d{2}$/.test(text) &&
            !Number.isNaN(Date.parse(text)) &&
            new Date(text).toISOString().slice(0, 10) === text &&
            text >= catalog.today &&
            text <= catalog.bookingUntil
          ) {
            state.from = text;
            state.page = 0;
            await showSlots();
          } else {
            const selected = choice(text, state.choices);
            if (!selected)
              body =
                "Reply with a time number, a date as YYYY-MM-DD, or RESTART.";
            else if (
              readSlot(selected.slotToken, settings.booking!.signingSecret)
                .expiresAt <= Date.now()
            ) {
              state.page = 0;
              await showSlots();
              body = "Those times expired. " + body;
            } else {
              state = { ...state, step: "name", selected, choices: [] };
              body =
                (custom("details") ||
                  "Please reply with the patient’s full name (2–100 characters).") +
                " Do not send medical records or symptoms here.";
            }
          }
        } else if (state.step === "name") {
          if (
            text.length < 2 ||
            text.length > 100 ||
            /[\r\n\u0000-\u001f]/.test(text)
          )
            body = "Please enter a name between 2 and 100 characters.";
          else {
            state = { ...state, step: "confirm", name: text };
            body = `Confirm: ${state.doctorName}, ${localTime(state.selected.startsAt, catalog.timezone)}, ${state.mode === "virtual" ? "video" : "in person"}, ₹${(state.selected.feeMinor / 100).toFixed(2)}. Reply CONFIRM to book, or RESTART. No payment is collected in this chat.`;
          }
        } else if (state.step === "confirm") {
          if (command !== "CONFIRM")
            body = "Reply CONFIRM to book this time, or RESTART.";
          else {
            try {
              const receipt = await publicBook(
                db,
                actor,
                site,
                settings.booking!.signingSecret,
                {
                  slotToken: state.selected.slotToken,
                  name: state.name!,
                  phone: input.address,
                },
                readSlot(
                  state.selected.slotToken,
                  settings.booking!.signingSecret,
                ),
                input.id,
                "whatsapp",
                input.contact_point_id,
              );
              body = `Your appointment is confirmed. Reference: ${receipt.confirmationCode}. ${receipt.doctorName}, ${localTime(receipt.startsAt, receipt.timezone)}. Fee: ₹${(receipt.feeMinor / 100).toFixed(2)}. Reply HUMAN if you need to change or cancel it.`;
              state = {};
            } catch (error) {
              // A failed/expired slot never produces a confirmation. A committed command replays by inbound ID.
              if (!(error instanceof Error) || !("code" in error)) throw error;
              state = { ...state, step: "slot", page: 0, selected: undefined };
              await showSlots();
              body =
                "That booking could not be completed. Please choose an available time again. " +
                body;
            }
          }
        }
        const local = new Intl.DateTimeFormat("en-GB", {
          timeZone: catalog.timezone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date());
        const hours = live.preferences.hours,
          away = live.preferences.away;
        const open =
          !hours ||
          hours.from === hours.to ||
          (hours.from < hours.to
            ? local >= hours.from && local < hours.to
            : local >= hours.from || local < hours.to);
        if (
          !open &&
          away?.on &&
          away.text &&
          (!saved?.state?.step ||
            ["RESTART", "BOOK", "HI", "HELLO", "START"].includes(command))
        )
          body = String(away.text).slice(0, 1024) + "\n" + body;
        if (body)
          await sql`INSERT INTO comms.outbound_message(tenant_id,facility_id,conversation_id,contact_point_id,text_content,managed_send_requested,managed_purpose,managed_inbound_id,managed_details)
          VALUES(${r.tenant_id},${input.facility_id},${input.conversation_id},${input.contact_point_id},${body.slice(0, 3000)},true,${prompt ? "booking_prompt" : "booking"},${input.id},${JSON.stringify({ phoneNumberId: input.phone_number_id })}::jsonb) ON CONFLICT DO NOTHING`.execute(
            tx,
          );
        await sql`INSERT INTO comms.booking_chat(tenant_id,conversation_id,state,expires_at) VALUES(${r.tenant_id},${input.conversation_id},${JSON.stringify({ ...state, phoneNumberId: input.phone_number_id })}::jsonb,now()+interval '15 minutes')
          ON CONFLICT(tenant_id,conversation_id) DO UPDATE SET state=EXCLUDED.state,expires_at=EXCLUDED.expires_at`.execute(
          tx,
        );
        return true;
      });
      if (processed) count++;
    } catch {
      // No contact content or provider errors in logs. Retrying reuses the signed inbound ID.
    }
  }
  return count;
}
