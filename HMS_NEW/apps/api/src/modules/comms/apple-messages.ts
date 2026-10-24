import { sql, type DB, type Kysely } from '@hms/db';
import {
  conflict,
  notFound,
  runCommand,
  runQuery,
  setTransactionContext,
} from '@hms/platform';
import { z } from 'zod';
import type { Caller } from '../../caller.ts';
import {
  publicBook,
  publicCatalog,
  publicSlots,
} from '../booking/public-booking.ts';
import { readSlot } from '../booking/public-config.ts';
import { bookingAuthority, bookingSite } from './managed-booking-chat.ts';
import type { ManagedSettings } from './managed-config.ts';
import type { AppleBinding } from './apple-config.ts';
import { assertWhatsAppActive } from './whatsapp.ts';

export const TranscriptEntry = z.object({
  Id: z.string().min(1).max(200),
  AbsoluteTime: z.iso.datetime({ offset: true }),
  Type: z.string(),
  ContentType: z.string().default('application/octet-stream'),
  Content: z.string().max(32768).optional(),
  ParticipantRole: z.string().optional(),
});
export type AppleTranscriptEntry = z.infer<typeof TranscriptEntry>;
type Slot = Awaited<ReturnType<typeof publicSlots>>['slots'][number];
type State = {
  step?: 'consent' | 'doctor' | 'mode' | 'slot' | 'name' | 'phone' | 'confirm';
  consented?: boolean;
  doctor?: string;
  doctorName?: string;
  virtual?: boolean;
  mode?: 'in_person' | 'virtual';
  choices?: { slug: string; name: string; acceptsVirtual: boolean }[];
  slots?: Slot[];
  selected?: Slot;
  from?: string;
  name?: string;
  phone?: string;
  page?: number;
};
type Conversation = {
  id: string;
  status: 'automation' | 'handoff' | 'closed';
  state: State;
  state_expires_at: Date;
  version: number;
};
const lock = (id: string) =>
  sql`SELECT pg_advisory_xact_lock(hashtextextended(${'apple:' + id},0))`;
const money = (slot: { feeMinor: number; currency?: string }) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: slot.currency ?? 'INR',
  }).format(slot.feeMinor / 100);
const time = (value: string, timezone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZoneName: undefined,
  }).format(new Date(value));

/** Called only after the AWS adapter verifies the queue, topic, instance and private session row. */
export async function ingestAppleTranscript(
  db: Kysely<DB>,
  binding: AppleBinding,
  contactId: string,
  raw: unknown[],
) {
  z.uuid().parse(contactId);
  const entries = z.array(TranscriptEntry).max(500).parse(raw);
  return db.transaction().execute(async (tx) => {
    await setTransactionContext(tx, binding.tenantId);
    await sql`SET LOCAL ROLE mod_comms`.execute(tx);
    await assertWhatsAppActive(tx);
    await lock(binding.instanceArn + ':' + contactId).execute(tx);
    await sql`INSERT INTO comms.apple_conversation(tenant_id,facility_id,instance_arn,contact_id,source)
      VALUES(${binding.tenantId},${binding.facilityId},${binding.instanceArn},${contactId},${binding.localDemo ? 'local_demo' : 'amazon_connect'})
      ON CONFLICT(instance_arn,contact_id) DO NOTHING`.execute(tx);
    const {
      rows: [c],
    } =
      await sql<Conversation>`SELECT * FROM comms.apple_conversation WHERE instance_arn=${binding.instanceArn} AND contact_id=${contactId} AND facility_id=${binding.facilityId}`.execute(
        tx,
      );
    if (!c) throw notFound('Apple conversation');
    await lock(binding.instanceArn + ':' + c.id).execute(tx);
    // Transcript reconciliation handles SNS duplicates and arrival order; business messages are never looped back as input.
    for (const e of entries) {
      if (e.Type === 'MESSAGE' && e.ParticipantRole === 'CUSTOMER') {
        const text =
          e.ContentType === 'text/plain'
            ? (e.Content ?? '').slice(0, 4096)
            : '[Unsupported message]';
        if (text)
          await sql`INSERT INTO comms.apple_message(tenant_id,conversation_id,direction,provider_id,text_content,occurred_at,status)
          VALUES(${binding.tenantId},${c.id},'inbound',${e.Id},${text},${new Date(e.AbsoluteTime)},'received') ON CONFLICT DO NOTHING`.execute(
            tx,
          );
      }
      if (
        e.ContentType ===
          'application/vnd.amazonaws.connect.event.chat.ended' ||
        (e.ContentType ===
          'application/vnd.amazonaws.connect.event.participant.joined' &&
          e.ParticipantRole === 'AGENT')
      ) {
        await sql`UPDATE comms.apple_conversation SET status='closed',state='{}' WHERE id=${c.id}`.execute(
          tx,
        );
        await sql`UPDATE comms.apple_message SET status='cancelled' WHERE conversation_id=${c.id} AND status='queued'`.execute(
          tx,
        );
      }
    }
    return c.id;
  });
}

/** One serialized transition at a time. The committed inbound UUID is the booking idempotency key. */
export async function processAppleConversation(
  db: Kysely<DB>,
  binding: AppleBinding,
  conversationId: string,
  settings: ManagedSettings,
) {
  return db.transaction().execute(async (tx) => {
    await setTransactionContext(tx, binding.tenantId);
    await sql`SET LOCAL ROLE mod_comms`.execute(tx);
    await lock(binding.instanceArn + ':' + conversationId).execute(tx);
    await assertWhatsAppActive(tx);
    const {
      rows: [c],
    } =
      await sql<Conversation>`SELECT * FROM comms.apple_conversation WHERE id=${conversationId}
      AND facility_id=${binding.facilityId} AND instance_arn=${binding.instanceArn}`.execute(
        tx,
      );
    if (!c || c.status === 'closed') return false;
    const {
      rows: [input],
    } = await sql<{
      id: string;
      text_content: string;
      occurred_at: Date;
    }>`SELECT * FROM comms.apple_message
      WHERE conversation_id=${c.id} AND direction='inbound' AND processed_at IS NULL ORDER BY occurred_at,id LIMIT 1`.execute(
      tx,
    );
    if (!input) return false;
    if (new Date(input.occurred_at).getTime() < Date.now() - 15 * 60000) {
      await sql`UPDATE comms.apple_message SET processed_at=now() WHERE id=${input.id}`.execute(
        tx,
      );
      return true;
    }
    const text = input.text_content.trim(),
      command = text.toUpperCase();
    const stop = ['STOP', 'UNSUBSCRIBE', 'END'].includes(command);
    // Reception owns handoff conversations, but customers can still stop them.
    // Consume ordinary inbound messages so they cannot hide a later STOP in the backlog.
    if (c.status === 'handoff' && !stop) {
      await sql`UPDATE comms.apple_message SET processed_at=now() WHERE id=${input.id}`.execute(
        tx,
      );
      return true;
    }
    let state: State =
      new Date(c.state_expires_at).getTime() > Date.now() ? c.state : {};
    let body = '';
    let status: Conversation['status'] = c.status;
    if (['AGENT', 'HUMAN', 'HELP', 'SUPPORT'].includes(command)) {
      status = 'handoff';
      state = {};
      body =
        'Your conversation is waiting for reception. A staff member will reply here during support hours.';
    } else if (stop) {
      status = 'closed';
      state = {};
      body =
        'Booking messages for this conversation have stopped. Please start a new conversation to contact us again.';
    } else {
      const site = bookingSite(settings, binding.tenantId, binding.facilityId),
        actor = await bookingAuthority(db, site);
      const catalog = await publicCatalog(db, actor, site);
      const doctors = () => {
        state = {
          consented: true,
          step: 'doctor',
          choices: catalog.doctors.slice(0, 10),
        };
        body = state.choices!.length
          ? 'Choose a doctor:\n' +
            state.choices!.map((d, i) => `${i + 1}. ${d.name}`).join('\n') +
            '\nReply with a number, or AGENT for reception.'
          : 'No doctors are published for online booking. Reply AGENT for reception.';
      };
      const slots = async () => {
        const from = state.from ?? catalog.today;
        const to = new Date(Date.parse(from + 'T12:00:00Z') + 13 * 86400000)
          .toISOString()
          .slice(0, 10);
        const report = await publicSlots(
          db,
          actor,
          site,
          settings.booking!.signingSecret,
          {
            doctor: state.doctor!,
            mode: state.mode ?? 'in_person',
            from,
            to: to > catalog.bookingUntil ? catalog.bookingUntil : to,
          },
        );
        const offset = (state.page ?? 0) * 10;
        state = {
          ...state,
          step: 'slot',
          slots: report.slots.slice(offset, offset + 10),
          selected: undefined,
        };
        body = state.slots!.length
          ? 'Choose an available time:\n' +
            state
              .slots!.map(
                (s, i) =>
                  `${i + 1}. ${time(s.startsAt, report.timezone)} · ${money(s)}`,
              )
              .join('\n') +
            `\nTimes are in ${report.timezone}. Reply with a number, NEXT, or YYYY-MM-DD for another date. Times are not reserved yet.`
          : 'No priced times are available in this range. Reply with another date (YYYY-MM-DD) or AGENT for reception.';
      };
      if (['BOOK', 'RESTART', 'HI', 'HELLO', 'START'].includes(command))
        state = {};
      if (!state.step) {
        state = { step: 'consent' };
        body = `Welcome to ${catalog.clinicName}. I am the automated booking assistant. Reply YES to continue with appointment messages here, or AGENT for reception. This does not subscribe you to reminders or promotions. Please do not send medical records or symptoms.`;
      } else if (state.step === 'consent') {
        if (command === 'YES') doctors();
        else
          body =
            'Reply YES to continue booking, AGENT for reception, or STOP to end.';
      } else if (state.step === 'doctor') {
        const selected = /^\d{1,2}$/.test(text)
          ? state.choices?.[Number(text) - 1]
          : undefined;
        if (!selected)
          body = 'Reply with a doctor number from the list or RESTART.';
        else {
          state = {
            consented: true,
            step: 'mode',
            doctor: selected.slug,
            doctorName: selected.name,
            virtual: selected.acceptsVirtual,
          };
          if (selected.acceptsVirtual)
            body =
              'Reply 1 for an in-person appointment or 2 for a video appointment.';
          else {
            state.mode = 'in_person';
            await slots();
          }
        }
      } else if (state.step === 'mode') {
        if (text !== '1' && !(text === '2' && state.virtual))
          body = 'Reply 1 for in person, or 2 for video if offered.';
        else {
          state.mode = text === '2' ? 'virtual' : 'in_person';
          await slots();
        }
      } else if (state.step === 'slot') {
        if (command === 'NEXT') {
          state.page = (state.page ?? 0) + 1;
          await slots();
        } else if (
          /^\d{4}-\d{2}-\d{2}$/.test(text) &&
          !Number.isNaN(Date.parse(text)) &&
          new Date(text).toISOString().slice(0, 10) === text &&
          text >= catalog.today &&
          text <= catalog.bookingUntil
        ) {
          state.from = text;
          state.page = 0;
          await slots();
        } else {
          const selected = /^\d{1,2}$/.test(text)
            ? state.slots?.[Number(text) - 1]
            : undefined;
          if (!selected)
            body =
              'Reply with a time number, another date (YYYY-MM-DD), or RESTART.';
          else if (
            readSlot(selected.slotToken, settings.booking!.signingSecret)
              .expiresAt <= Date.now()
          ) {
            await slots();
            body = 'Those times expired. ' + body;
          } else {
            state = { ...state, step: 'name', selected, slots: [] };
            body =
              'What is the patient’s full name? Use 2–100 characters. Do not send symptoms or medical records.';
          }
        }
      } else if (state.step === 'name') {
        if (
          text.length < 2 ||
          text.length > 100 ||
          /[\u0000-\u001f]/.test(text)
        )
          body = 'Please enter a name using 2–100 characters.';
        else {
          state = { ...state, name: text, step: 'phone' };
          body =
            'Enter a contact phone with country code, for example +12125550123. Apple does not share your phone number with this clinic. This will be an unverified booking contact.';
        }
      } else if (state.step === 'phone') {
        if (!/^\+[1-9]\d{7,14}$/.test(text))
          body =
            'Enter the phone with +country code and digits, for example +12125550123.';
        else {
          state = { ...state, phone: text, step: 'confirm' };
          body = `Review: ${state.name}; ${state.doctorName}; ${time(state.selected!.startsAt, catalog.timezone)} (${catalog.timezone}); ${money(state.selected!)}; ${state.mode === 'virtual' ? 'video' : 'in person'}; contact ${text}. Reply CONFIRM to book or RESTART. No payment is collected here.`;
        }
      } else if (state.step === 'confirm') {
        if (command !== 'CONFIRM')
          body = 'Reply CONFIRM to book the reviewed appointment, or RESTART.';
        else {
          try {
            const receipt = await publicBook(
              db,
              actor,
              site,
              settings.booking!.signingSecret,
              {
                slotToken: state.selected!.slotToken,
                name: state.name!,
                phone: state.phone!,
              },
              readSlot(
                state.selected!.slotToken,
                settings.booking!.signingSecret,
              ),
              input.id,
              'apple_messages',
              c.id,
            );
            body = `Your appointment is confirmed. Reference: ${receipt.confirmationCode}. ${receipt.doctorName}, ${time(receipt.startsAt, receipt.timezone)} (${receipt.timezone}), ${money(receipt)}. Reply AGENT to ask reception about changes or cancellation.`;
            state = {};
          } catch (error) {
            if (
              !(error instanceof Error) ||
              !('code' in error) ||
              !['conflict', 'precondition_failed'].includes(String(error.code))
            )
              throw error;
            state = { ...state, page: 0 };
            await slots();
            body =
              'That time could not be booked. Please choose again. ' + body;
          }
        }
      }
    }
    if (status === 'closed')
      await sql`UPDATE comms.apple_message SET status='cancelled' WHERE conversation_id=${c.id} AND status='queued'`.execute(
        tx,
      );
    else if (status === 'handoff')
      await sql`UPDATE comms.apple_message SET status='cancelled' WHERE conversation_id=${c.id} AND status='queued' AND actor_staff_id IS NULL`.execute(
        tx,
      );
    await sql`INSERT INTO comms.apple_message(tenant_id,conversation_id,direction,text_content,status,reply_to)
      VALUES(${binding.tenantId},${c.id},'outbound',${body.slice(0, 4096)},'queued',${input.id}) ON CONFLICT DO NOTHING`.execute(
      tx,
    );
    await sql`UPDATE comms.apple_message SET processed_at=now() WHERE id=${input.id}`.execute(
      tx,
    );
    await sql`UPDATE comms.apple_conversation SET state=${JSON.stringify(state)}::jsonb,status=${status},state_expires_at=now()+interval '15 minutes' WHERE id=${c.id}`.execute(
      tx,
    );
    return true;
  });
}

export async function appleDashboard(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    if (
      !(await tx
        .selectFrom('platform.facility')
        .select('id')
        .where('id', '=', facilityId)
        .executeTakeFirst())
    )
      throw notFound('clinic');
    const { rows } = await sql<{
      id: string;
      status: string;
      source: string;
      version: number;
      updated_at: Date;
    }>`SELECT id,status,source,version,updated_at FROM comms.apple_conversation WHERE facility_id=${facilityId} ORDER BY updated_at DESC LIMIT 100`.execute(
      tx,
    );
    return {
      items: rows.map((c) => ({
        id: c.id,
        status: c.status,
        source: c.source,
        version: c.version,
        updatedAt: c.updated_at.toISOString(),
      })),
    };
  });
}
export async function appleThread(
  db: Kysely<DB>,
  caller: Caller,
  facilityId: string,
  id: string,
) {
  return runQuery(db, caller.tenantId, async (tx) => {
    const {
      rows: [c],
    } =
      await sql<Conversation>`SELECT id,status,version FROM comms.apple_conversation WHERE id=${id} AND facility_id=${facilityId}`.execute(
        tx,
      );
    if (!c) throw notFound('conversation');
    const { rows } = await sql<{
      id: string;
      direction: string;
      text_content: string;
      status: string;
      created_at: Date;
    }>`SELECT id,direction,text_content,status,created_at FROM comms.apple_message WHERE conversation_id=${id} ORDER BY created_at,id LIMIT 500`.execute(
      tx,
    );
    return {
      conversation: c,
      messages: rows.map((m) => ({
        id: m.id,
        direction: m.direction,
        text: m.text_content,
        status: m.status,
        createdAt: m.created_at.toISOString(),
      })),
    };
  });
}
export async function replyApple(
  db: Kysely<DB>,
  caller: Caller,
  input: {
    facilityId: string;
    conversationId: string;
    version: number;
    text: string;
  },
  key: string,
) {
  return runCommand(
    db,
    {
      ...caller,
      module: 'comms',
      name: 'comms.apple_reply',
      request: input,
      idempotencyKey: key,
    },
    async (ctx) => {
      await assertWhatsAppActive(ctx.tx);
      const {
        rows: [found],
      } = await sql<{
        instance_arn: string;
      }>`SELECT instance_arn FROM comms.apple_conversation WHERE id=${input.conversationId} AND facility_id=${input.facilityId}`.execute(
        ctx.tx,
      );
      if (!found) throw notFound('conversation');
      await lock(found.instance_arn + ':' + input.conversationId).execute(
        ctx.tx,
      );
      const {
        rows: [c],
      } =
        await sql<Conversation>`SELECT * FROM comms.apple_conversation WHERE id=${input.conversationId} AND facility_id=${input.facilityId}`.execute(
          ctx.tx,
        );
      if (!c || c.status === 'closed')
        throw conflict('This conversation has ended.');
      if (c.version !== input.version)
        throw conflict('The conversation changed. Reload before replying.');
      await sql`UPDATE comms.apple_conversation SET status='handoff',state='{}' WHERE id=${c.id}`.execute(
        ctx.tx,
      );
      // Takeover cancels unsent automation rather than interleaving it with the receptionist.
      await sql`UPDATE comms.apple_message SET status='cancelled' WHERE conversation_id=${c.id} AND status='queued' AND actor_staff_id IS NULL`.execute(
        ctx.tx,
      );
      const {
        rows: [message],
      } = await sql<{
        id: string;
      }>`INSERT INTO comms.apple_message(tenant_id,conversation_id,direction,text_content,status,actor_staff_id)
      VALUES(${caller.tenantId},${c.id},'outbound',${input.text},'queued',${ctx.actor.staffId}) RETURNING id`.execute(
        ctx.tx,
      );
      ctx.audit({
        action: 'create',
        subjectType: 'comms.apple_message',
        subjectId: message!.id,
        diff: { conversationId: c.id, status: 'queued' },
      });
      return { messageId: message!.id, status: 'queued' as const };
    },
  );
}
