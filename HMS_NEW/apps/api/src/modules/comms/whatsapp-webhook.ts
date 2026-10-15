import { z } from "zod";
import { forbidden, invalid } from "@hms/platform";
import {
  parseWhatsAppProviderConfig,
  type WhatsAppBinding,
} from "./whatsapp-provider-config.ts";

const Epoch = z
  .string()
  .regex(/^\d{1,12}$/)
  .refine((v) => Number(v) <= 253402300799);
const Message = z.looseObject({
  id: z.string().min(1).max(1024),
  from: z.string().regex(/^[1-9][0-9]{7,14}$/),
  timestamp: Epoch.optional(),
  text: z.looseObject({ body: z.string() }).optional(),
});
const Status = z.looseObject({
  id: z.string().min(1).max(1024),
  status: z.string().min(1).max(100),
  timestamp: Epoch.optional(),
});
const Value = z.looseObject({
  metadata: z.looseObject({ phone_number_id: z.string().regex(/^\d{5,40}$/) }),
  messages: z.array(Message).max(100).optional(),
  statuses: z.array(Status).max(100).optional(),
});
const Envelope = z.looseObject({
  object: z.literal("whatsapp_business_account").optional(),
  entry: z
    .array(
      z.looseObject({
        id: z
          .string()
          .regex(/^\d{5,40}$/)
          .optional(),
        changes: z
          .array(z.looseObject({ field: z.string().optional(), value: Value }))
          .min(1)
          .max(100),
      }),
    )
    .min(1)
    .max(100),
});

export interface WhatsAppWebhookValue {
  binding: WhatsAppBinding;
  value: z.infer<typeof Value>;
}

/** Validate the entire signed batch before any tenant transaction or control action. */
export function decodeWhatsAppWebhook(
  body: unknown,
  managed: WhatsAppBinding[] = [],
): WhatsAppWebhookValue[] {
  const parsed = Envelope.safeParse(body);
  if (!parsed.success) throw invalid("Invalid WhatsApp webhook envelope");
  const configured = new Map(
    [...parseWhatsAppProviderConfig().bindings, ...managed].map((b) => [
      b.phoneNumberId,
      b,
    ]),
  );
  const values: WhatsAppWebhookValue[] = [];
  for (const entry of parsed.data.entry)
    for (const change of entry.changes) {
      const binding = configured.get(change.value.metadata.phone_number_id);
      // This decoder runs after raw-byte HMAC verification. Losing the GET challenge token
      // must not discard authentic STOP/human requests from an existing subscription.
      if (!binding?.signatureConfigured)
        throw forbidden("Unconfigured WhatsApp provider binding");
      if (
        binding.mode === "multi_clinic" &&
        (parsed.data.object !== "whatsapp_business_account" ||
          change.field !== "messages" ||
          entry.id !== binding.businessAccountId)
      )
        throw forbidden("WhatsApp event does not match its provider binding");
      if (
        binding.mode === "legacy" &&
        binding.businessAccountId &&
        entry.id !== binding.businessAccountId
      )
        throw forbidden("WhatsApp event does not match its provider binding");
      values.push({ binding, value: change.value });
      if (values.length > 100)
        throw invalid("Too many WhatsApp webhook changes");
    }
  return values;
}
