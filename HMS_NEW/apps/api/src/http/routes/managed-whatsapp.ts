import {
  PromotionInput,
  promotionsDashboard,
  previewPromotion,
  promotionAction,
} from "../../modules/comms/managed-promotions.ts";
import {
  AutomationKind,
  automationDashboard,
  setAutomation,
  refreshAutomation,
} from "../../modules/comms/managed-automations.ts";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { DB, Kysely } from "@hms/db";
import { authorize, grantedFacilities } from "../../auth/principal.ts";
import {
  callerOf,
  principalOf,
  parse,
  uuid,
  idempotencyKey,
} from "../support.ts";
import { conversationFacility } from "../../modules/comms/whatsapp.ts";
import type { ManagedSettings } from "../../modules/comms/managed-config.ts";
import {
  finishWhatsApp,
  saveWhatsAppWorkspace,
  startWhatsApp,
  whatsappDashboard,
  whatsappThread,
  whatsappCommand,
  WhatsAppConnectInput,
  WhatsAppDraft,
  WhatsAppPreferences,
} from "../../modules/comms/managed-whatsapp.ts";
export function registerManagedWhatsAppRoutes(
  app: FastifyInstance,
  db: Kysely<DB>,
  settings: ManagedSettings,
) {
  const scope = z.strictObject({ facilityId: uuid });
  app.get("/v1/whatsapp-workspace/promotions", async (r) => {
    const { facilityId } = parse(scope, r.query);
    authorize(principalOf(r), "campaigns.manage", facilityId);
    return promotionsDashboard(db, callerOf(r), facilityId, settings);
  });
  app.post("/v1/whatsapp-workspace/promotions/preview", async (r) => {
    const input = parse(PromotionInput, r.body);
    authorize(principalOf(r), "campaigns.manage", input.facilityId);
    return previewPromotion(
      db,
      callerOf(r),
      input,
      idempotencyKey(r),
      settings,
    );
  });
  app.post("/v1/whatsapp-workspace/promotions/:id/:action", async (r) => {
    const { id, action } = parse(
      z.strictObject({ id: uuid, action: z.enum(["approve", "pause"]) }),
      r.params,
    );
    const { facilityId, version } = parse(
      scope.extend({ version: z.number().int().positive() }),
      r.body,
    );
    authorize(
      principalOf(r),
      action === "approve" ? "campaigns.approve" : "campaigns.manage",
      facilityId,
    );
    return promotionAction(
      db,
      callerOf(r),
      facilityId,
      id,
      version,
      action,
      idempotencyKey(r),
      settings,
    );
  });
  app.get("/v1/whatsapp-workspace/automations", async (r) => {
    const { facilityId } = parse(scope, r.query);
    authorize(principalOf(r), "comms.read", facilityId);
    return automationDashboard(db, callerOf(r), facilityId);
  });
  app.put("/v1/whatsapp-workspace/automations", async (r) => {
    const { facilityId, ...input } = parse(
      scope.extend({
        kind: AutomationKind,
        enabled: z.boolean(),
        version: z.number().int().nonnegative(),
      }),
      r.body,
    );
    authorize(principalOf(r), "comms.manage", facilityId);
    return setAutomation(
      db,
      callerOf(r),
      facilityId,
      input,
      idempotencyKey(r),
      settings,
    );
  });
  app.post("/v1/whatsapp-workspace/automations/refresh", async (r) => {
    const { facilityId, kind } = parse(
      scope.extend({ kind: AutomationKind }),
      r.body,
    );
    authorize(principalOf(r), "comms.manage", facilityId);
    return refreshAutomation(db, callerOf(r), facilityId, kind, settings);
  });
  app.get("/v1/whatsapp-workspace", async (r) => {
    const { facilityId } = parse(scope, r.query),
      p = principalOf(r);
    authorize(p, "comms.read", facilityId);
    const grants = grantedFacilities(p, "comms.reply");
    return whatsappDashboard(
      db,
      callerOf(r),
      facilityId,
      settings,
      grants === null || grants.has(facilityId),
    );
  });
  app.put("/v1/whatsapp-workspace", async (r) => {
    const b = parse(
      scope.extend({
        version: z.number().int().nonnegative(),
        draft: WhatsAppDraft,
        preferences: WhatsAppPreferences,
      }),
      r.body,
    );
    authorize(principalOf(r), "comms.manage", b.facilityId);
    return saveWhatsAppWorkspace(
      db,
      callerOf(r),
      b.facilityId,
      b.version,
      b.draft,
      b.preferences,
      idempotencyKey(r),
      settings,
    );
  });
  app.post("/v1/whatsapp-workspace/connect", async (r) => {
    const { facilityId } = parse(scope, r.body);
    authorize(principalOf(r), "comms.manage", facilityId);
    return startWhatsApp(
      db,
      callerOf(r),
      facilityId,
      idempotencyKey(r),
      settings,
    );
  });
  app.post("/v1/whatsapp-workspace/connect/complete", async (r) => {
    const b = parse(WhatsAppConnectInput, r.body);
    authorize(principalOf(r), "comms.manage", b.facilityId);
    return finishWhatsApp(db, callerOf(r), b, settings);
  });
  app.get("/v1/whatsapp-workspace/conversations/:id", async (r) => {
    const { id } = parse(z.strictObject({ id: uuid }), r.params),
      facility = await conversationFacility(db, callerOf(r), id),
      p = principalOf(r);
    authorize(p, "comms.read", facility);
    const grants = grantedFacilities(p, "comms.reply");
    return whatsappThread(
      db,
      callerOf(r),
      id,
      grants === null || grants.has(facility),
    );
  });
  app.post("/v1/whatsapp-workspace/conversations/:id/:action", async (r) => {
    const { id, action } = parse(
        z.strictObject({
          id: uuid,
          action: z.enum(["assign", "close", "reply", "handoff", "resume"]),
        }),
        r.params,
      ),
      b = parse(
        z.strictObject({
          version: z.number().int().positive(),
          text: z.string().trim().min(1).max(3000).optional(),
        }),
        r.body,
      );
    authorize(
      principalOf(r),
      "comms.reply",
      await conversationFacility(db, callerOf(r), id),
    );
    if (action === "reply") parse(z.string().min(1), b.text);
    return whatsappCommand(
      db,
      callerOf(r),
      id,
      b,
      action,
      idempotencyKey(r),
      settings,
    );
  });
}
