import {
  listEnquiries,
  reviewEnquiry,
} from "../../modules/booking/website-enquiries.ts";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DB, Kysely } from "@hms/db";
import { authorize } from "../../auth/principal.ts";

import {
  parse,
  uuid,
  idempotencyKey,
  callerOf,
  principalOf,
} from "../support.ts";
import {
  getWebsiteSettings,
  saveWebsiteSettings,
  WebsiteSettings,
} from "../../modules/booking/website-settings.ts";
export function registerWebsiteSettingsRoutes(
  app: FastifyInstance,
  db: Kysely<DB>,
) {
  app.get("/v1/facilities/:facilityId/website/enquiries", async (request) => {
    const { facilityId } = parse(
      z.object({ facilityId: uuid }),
      request.params,
    );
    authorize(principalOf(request), "config.manage", facilityId);
    return listEnquiries(db, callerOf(request), facilityId);
  });
  app.post(
    "/v1/facilities/:facilityId/website/enquiries/:id/review",
    async (request) => {
      const ids = parse(
        z.object({ facilityId: uuid, id: uuid }),
        request.params,
      );
      const body = parse(
        z.strictObject({ version: z.number().int().positive() }),
        request.body,
      );
      authorize(principalOf(request), "config.manage", ids.facilityId);
      return reviewEnquiry(
        db,
        callerOf(request),
        { ...ids, ...body },
        idempotencyKey(request),
      );
    },
  );
  const Params = z.object({ facilityId: uuid });
  app.get("/v1/facilities/:facilityId/website", async (request) => {
    const { facilityId } = parse(Params, request.params);
    authorize(principalOf(request), "config.manage", facilityId);
    return getWebsiteSettings(db, callerOf(request), facilityId);
  });
  app.put("/v1/facilities/:facilityId/website", async (request) => {
    const { facilityId } = parse(Params, request.params);
    const body = parse(
      WebsiteSettings.extend({ version: uuid.nullable() }),
      request.body,
    );
    authorize(principalOf(request), "config.manage", facilityId);
    return saveWebsiteSettings(
      db,
      callerOf(request),
      { facilityId, ...body },
      idempotencyKey(request),
    );
  });
}
