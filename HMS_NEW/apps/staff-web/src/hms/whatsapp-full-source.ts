import {
  ConversationsResponseSchema,
  ConversationThreadSchema,
  ConversationCreateSchema,
  VersionCommandSchema,
  ConversationReplySchema,
  SupportCaseStatusSchema,
  SupportCaseCreateSchema,
  WhatsAppAssetsResponseSchema,
  WhatsAppUploadSchema,
  MessageTemplatesResponseSchema,
  CampaignsResponseSchema,
  CampaignCreateSchema,
  CampaignPreviewSchema,
  CampaignApproveSchema,
  CampaignTestSchema,
  WhatsAppSettingsSchema,
  WhatsAppSettingsUpsertSchema,
  ContactPointsResponseSchema,
  MessageTemplateCreateSchema,
  CampaignSchema,
  CampaignTestResponseSchema,
  WhatsAppAssetSchema,
  ConversationCreatedSchema,
  SupportCaseSchema,
  MessageTemplateSchema,
  type Campaign as ContractCampaign,
} from "@hms/contracts";
import { HmsError, IntentKeys, query, request, requestBlob } from "./client";
import type {
  Facility,
  ClinicDirectory,
  FacilityDetail,
  Practitioner,
} from "./types";
const wa = "/api/v1/admin/whatsapp";
const fail = () =>
  new HmsError(
    "The WhatsApp response could not be verified. Refresh before continuing.",
    502,
    "invalid_response",
  );
function decode<T>(
  schema: {
    safeParse(value: unknown): { success: true; data: T } | { success: false };
  },
  value: unknown,
): T {
  const r = schema.safeParse(value);
  if (!r.success) throw fail();
  return r.data;
}
const asset = (a: {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
}) => ({
  id: a.id,
  filename: a.filename,
  mime_type: a.mimeType,
  size_bytes: a.sizeBytes,
  kind: a.mimeType.startsWith("image/") ? "image" : "document",
  validation_state: a.status,
});
export function fullWhatsAppSource(
  facility: Facility,
  practitioners: Practitioner[],
  intents: IntentKeys,
) {
  const at = facility.facilityId,
    versions = new Map<string, number>(),
    campaigns = new Map<string, ContractCampaign>();
  let clinicVersion: number | undefined;
  const campaign = (c: ContractCampaign) => {
    campaigns.set(c.id, c);
    versions.set(c.id, c.version);
    return {
      id: c.id,
      title: c.title,
      status: c.status,
      template_id: c.templateId,
      parameters: c.parameters,
      asset_id: c.assetId,
      scheduled_at: c.scheduledAt,
      audience: { branch_id: at, interest: c.interest ?? undefined },
      rate_paise: c.rateMinor,
      budget_paise: c.budgetMinor,
      approved_count: c.approvedCount,
      counts: {},
      engaged: null,
      bookings: null,
      unsubscribes_from_buttons: null,
      simulationOnly: true,
    };
  };
  const send = async <T = unknown>(
    path: string,
    body: unknown,
    method = "POST",
    schema?: {
      safeParse(
        value: unknown,
      ): { success: true; data: T } | { success: false };
    },
    key?: string,
  ) => {
    const raw = await request<unknown>(path, {
      method,
      body,
      idempotencyKey: key ?? intents.for(path, body),
    });
    const result = schema ? decode(schema, raw) : (raw as T);
    intents.complete(path, body);
    return result;
  };
  async function directory(signal: AbortSignal) {
    const [d, f] = await Promise.all([
      request<ClinicDirectory>(`/v1/facilities/${at}/directory`, { signal }),
      request<FacilityDetail>(`/v1/facilities/${at}`, { signal }),
    ]);
    clinicVersion = f.version;
    return {
      branches: [
        {
          id: at,
          name: f.name,
          area: f.city ?? "",
          is_active: f.status === "active",
          address: f.addressLine1 ?? "",
          directions_url: f.directionsUrl ?? "",
          arrival_instructions: f.arrivalInstructions ?? "",
        },
      ],
      departments: d.departments.map((d) => ({
        id: d.departmentId,
        name: d.name,
        slug: d.name,
        is_active: d.status === "active",
      })),
    };
  }
  return {
    async read(
      path: string,
      signal: AbortSignal,
    ): Promise<unknown | undefined> {
      const url = new URL(path, "http://local");
      if (url.pathname === `${wa}/contacts`)
        return decode(
          ContactPointsResponseSchema,
          await request(
            `/v1/conversations/contacts?${query({ facilityId: at })}`,
            { signal },
          ),
        );
      if (url.pathname === `${wa}/settings`)
        return decode(
          WhatsAppSettingsSchema,
          await request(`/v1/comms/settings?${query({ facilityId: at })}`, {
            signal,
          }),
        );
      if (url.pathname === "/api/v1/admin/catalogue") return directory(signal);
      if (url.pathname === "/api/v1/admin/whatsapp-assets") {
        const [d, r] = await Promise.all([
          directory(signal),
          request(`/v1/comms/assets?${query({ facilityId: at })}`, { signal }),
        ]);
        const a = decode(WhatsAppAssetsResponseSchema, r).items;
        return {
          departments: d.departments.map((d) => ({
            ...d,
            guide: (() => {
              const found = a.find(
                (a) =>
                  a.ownerType === "department" &&
                  a.ownerId === d.id &&
                  a.status !== "retired",
              );
              return found ? asset(found) : null;
            })(),
          })),
          doctors: practitioners
            .filter((p) => p.facilityId === at)
            .map((p) => ({
              id: p.staffId,
              name: p.name,
              title: "",
              departments: [p.department],
              photo: (() => {
                const found = a.find(
                  (a) =>
                    a.ownerType === "practitioner" &&
                    a.ownerId === p.staffId &&
                    a.status !== "retired",
                );
                return found ? asset(found) : null;
              })(),
            })),
        };
      }
      if (url.pathname === `${wa}/campaign-assets`)
        return decode(
          WhatsAppAssetsResponseSchema,
          await request(`/v1/comms/assets?${query({ facilityId: at })}`, {
            signal,
          }),
        )
          .items.filter(
            (a) => a.ownerType === "campaign" && a.status !== "retired",
          )
          .map(asset);
      if (url.pathname === `${wa}/templates`)
        return decode(
          MessageTemplatesResponseSchema,
          await request(`/v1/message-templates?${query({ facilityId: at })}`, {
            signal,
          }),
        ).items.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.providerApproval.toUpperCase(),
          language: t.language,
          category: t.category.toUpperCase(),
          synced_at: "",
          components: [{ type: "BODY", text: t.body }],
          spec: {
            parameters: t.parameterCount,
            header:
              t.header === "image"
                ? "IMAGE"
                : t.header === "text"
                  ? "TEXT"
                  : null,
          },
          simulationOnly: true,
        }));
      if (url.pathname === `${wa}/campaigns`)
        return decode(
          CampaignsResponseSchema,
          await request(`/v1/campaigns?${query({ facilityId: at })}`, {
            signal,
          }),
        ).items.map(campaign);
      const preview = url.pathname.match(
        /^\/api\/v1\/admin\/whatsapp\/campaigns\/([0-9a-f-]{36})\/preview$/i,
      );
      if (preview) {
        const r = decode(
          CampaignPreviewSchema,
          await request(`/v1/campaigns/${preview[1]}/preview`, { signal }),
        );
        versions.set(preview[1], r.version);
        return {
          body: r.body,
          recipients: r.recipients,
          estimated_cost_paise: r.estimatedCostMinor,
          within_budget: r.withinBudget,
          audience_hash: r.audienceHash,
          header_asset_id: campaigns.get(preview[1])?.assetId ?? null,
        };
      }
      if (url.pathname === `${wa}/conversations`) {
        const r = decode(
          ConversationsResponseSchema,
          await request(
            `/v1/conversations?${query({ facilityId: at, kind: url.searchParams.get("kind") === "all" ? undefined : (url.searchParams.get("kind") ?? undefined), status: url.searchParams.get("status") === "all" ? undefined : url.searchParams.get("status") === "resolved" ? "closed" : (url.searchParams.get("status") ?? undefined), search: url.searchParams.get("q") ?? undefined, offset: Number(url.searchParams.get("offset") ?? 0), limit: 30 })}`,
            { signal },
          ),
        );
        return {
          items: r.items.map((c) => {
            versions.set(c.id, c.version);
            return {
              sender_id: c.id,
              display_address: c.contactAddress,
              name: c.name ?? c.contactAddress,
              preview: "",
              assigned_to: c.assignedStaffName,
              assigned_staff_id: c.assignedStaffId,
              version: c.version,
              automation_state: c.automationState,
              automation_allowed: c.automationAllowed,
              automation_blocked_reasons: c.automationBlockedReasons,
              updated_at: c.updatedAt,
              open: c.status === "open",
              kinds: c.kinds ?? (c.status === "open" ? ["reception"] : []),
            };
          }),
          total: (r as typeof r & { total?: number }).total ?? r.items.length,
          offset: Number(url.searchParams.get("offset") ?? 0),
          limit: 30,
        };
      }
      const thread = url.pathname.match(
        /^\/api\/v1\/admin\/whatsapp\/conversations\/([0-9a-f-]{36})$/i,
      );
      if (thread) {
        const r = decode(
          ConversationThreadSchema,
          await request(`/v1/conversations/${thread[1]}`, { signal }),
        );
        versions.set(r.conversation.id, r.conversation.version);
        r.cases.forEach((c) => versions.set(c.id, c.version));
        return {
          sender_id: r.conversation.id,
          display_address: r.conversation.contactAddress,
          open: r.conversation.status === "open",
          active_handoff:
            r.conversation.status === "open" &&
            r.conversation.automationState !== "automation",
          version: r.conversation.version,
          automation_state: r.conversation.automationState,
          automation_allowed: r.conversation.automationAllowed,
          automation_blocked_reasons: r.conversation.automationBlockedReasons,
          assigned_staff_id: r.conversation.assignedStaffId,
          assigned_to: r.conversation.assignedStaffName,
          can_reply: r.conversation.canReply,
          cases: r.cases,
          messages: r.messages.map((m) => ({
            id: m.id,
            direction: m.direction,
            content: { kind: "text", text: m.text },
            created_at: m.createdAt,
            actor: m.actorStaffId,
            delivery: m.transport === "log" ? "local_not_sent" : m.status,
          })),
          history_note: r.hasOlderMessages
            ? "Showing the latest 100 saved messages. Earlier history is not loaded. Provider sending is unavailable."
            : "Saved history. Provider sending is unavailable.",
          has_older_messages: r.hasOlderMessages ?? false,
        };
      }
      return undefined;
    },
    async write(
      path: string,
      options: { method?: string; body?: unknown },
    ): Promise<unknown | undefined> {
      const b = (options.body ?? {}) as Record<string, unknown>;
      const reception = path.match(
        /^\/api\/v1\/admin\/whatsapp\/reception\/([0-9a-f-]{36})(\/(reply|handoff|resume))?$/i,
      );
      if (reception) {
        const version = b.version ?? versions.get(reception[1]);
        const key =
          typeof b.idempotency_key === "string" ? b.idempotency_key : undefined;
        if (reception[3] === "reply")
          return send(
            `/v1/conversations/${reception[1]}/reply`,
            ConversationReplySchema.parse({ version, text: b.text }),
            "POST",
            ConversationThreadSchema,
            key,
          );
        return send(
          `/v1/conversations/${reception[1]}/${reception[3] ?? (b.status === "closed" ? "close" : "assign")}`,
          VersionCommandSchema.parse({ version }),
          "POST",
          ConversationThreadSchema,
          key,
        );
      }
      const caseStatus = path.match(
        /^\/api\/v1\/admin\/whatsapp-cases\/([0-9a-f-]{36})$/i,
      );
      if (caseStatus)
        return send(
          `/v1/support-cases/${caseStatus[1]}/status`,
          SupportCaseStatusSchema.parse({
            version: versions.get(caseStatus[1]),
            status: b.status,
          }),
          "POST",
          SupportCaseSchema,
        );
      if (path === `${wa}/conversations` && options.method === "POST")
        return send(
          "/v1/conversations",
          ConversationCreateSchema.parse({ ...b, facilityId: at }),
          "POST",
          ConversationCreatedSchema,
        );
      if (path === `${wa}/support-cases`)
        return send(
          "/v1/support-cases",
          SupportCaseCreateSchema.parse(b),
          "POST",
          SupportCaseSchema,
        );
      const photo = path.match(
          /^\/api\/v1\/admin\/doctors\/([0-9a-f-]{36})\/photo$/i,
        ),
        guide = path.match(
          /^\/api\/v1\/admin\/departments\/([0-9a-f-]{36})\/guide$/i,
        );
      if (photo || guide || path === `${wa}/campaign-assets`) {
        const file = (options.body as FormData).get("file");
        if (!(file instanceof File))
          throw new HmsError("Choose an upload file.", 400, "validation");
        const max =
          file.type === "application/pdf" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > max)
          throw new HmsError(
            "The selected file exceeds the upload limit.",
            400,
            "validation",
          );
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 32768)
          binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
        const data = WhatsAppUploadSchema.parse({
          facilityId: at,
          filename: file.name,
          mimeType: file.type,
          dataBase64: btoa(binary),
        });
        const route = photo
          ? `/v1/practitioners/${photo[1]}/whatsapp-photo`
          : guide
            ? `/v1/departments/${guide[1]}/whatsapp-guide`
            : "/v1/campaign-assets";
        const result = await send(
          route,
          data,
          photo || guide ? "PUT" : "POST",
          WhatsAppAssetSchema,
        );
        return asset(result);
      }
      const clinic = path.match(
        /^\/api\/v1\/admin\/whatsapp\/branches\/([0-9a-f-]{36})$/i,
      );
      if (clinic) {
        if (clinic[1] !== at)
          throw new HmsError("Choose the current clinic.", 403, "forbidden");
        if (clinicVersion === undefined) throw fail();
        return send(
          `/v1/facilities/${at}`,
          {
            version: clinicVersion,
            addressLine1: b.address,
            directionsUrl: b.directions_url || null,
            arrivalInstructions: b.arrival_instructions || null,
          },
          "PATCH",
        );
      }
      if (path === `${wa}/settings` && options.method === "PUT")
        return send(
          "/v1/comms/settings",
          WhatsAppSettingsUpsertSchema.parse({ ...b, facilityId: at }),
          "PUT",
          WhatsAppSettingsSchema,
        );
      if (path === `${wa}/templates` && options.method === "POST")
        return send(
          "/v1/message-templates",
          MessageTemplateCreateSchema.parse({ ...b, facilityId: at }),
          "POST",
          MessageTemplateSchema,
        );
      if (path === `${wa}/campaigns`) {
        const data = CampaignCreateSchema.parse({
          facilityId: at,
          title: b.title,
          templateId: b.template_id,
          parameters: b.parameters,
          assetId: b.asset_id,
          scheduledAt: b.scheduled_at,
          interest: (b.audience as Record<string, unknown>)?.interest ?? null,
          budgetMinor: b.budget_paise,
        });
        return campaign(
          await send("/v1/campaigns", data, "POST", CampaignSchema),
        );
      }
      const act = path.match(
        /^\/api\/v1\/admin\/whatsapp\/campaigns\/([0-9a-f-]{36})\/(preview|test|approve|pause)$/i,
      );
      if (act) {
        if (act[2] === "preview")
          return this.read(path, new AbortController().signal);
        const version = versions.get(act[1]);
        const data =
          act[2] === "approve"
            ? CampaignApproveSchema.parse({
                version,
                audienceHash: b.audience_hash,
                expectedCount: b.expected_count,
                testReceived: b.test_received,
              })
            : act[2] === "test"
              ? CampaignTestSchema.parse({ version, recipientId: b.sender_id })
              : VersionCommandSchema.parse({ version });
        return act[2] === "test"
          ? send(
              `/v1/campaigns/${act[1]}/${act[2]}`,
              data,
              "POST",
              CampaignTestResponseSchema,
            )
          : send(
              `/v1/campaigns/${act[1]}/${act[2]}`,
              data,
              "POST",
              CampaignSchema,
            );
      }
      return undefined;
    },
    asset: (id: string, signal: AbortSignal) =>
      requestBlob(`/v1/comms/assets/${id}/content`, signal),
  };
}
