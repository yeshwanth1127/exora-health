import assert from "node:assert/strict";
import test from "node:test";
import { isDevelopmentLoginConfigured } from "../src/hms/runtime-flags.ts";
import {
  fallbackTenantName,
  fetchTenantName,
} from "../src/hms/tenant-brand.ts";

test("development login is controlled by its explicit build flag", () => {
  assert.equal(isDevelopmentLoginConfigured("true"), true);
  assert.equal(isDevelopmentLoginConfigured(true), true);
  assert.equal(isDevelopmentLoginConfigured("false"), false);
  assert.equal(isDevelopmentLoginConfigured(undefined), false);
});

test("staff branding uses the tenant returned by public bootstrap", async () => {
  const name = await fetchTenantName(async () =>
    new Response(JSON.stringify({ tenant: { name: " Test Hospital " } }), {
      status: 200,
    }),
  );
  assert.equal(name, "Test Hospital");
});

test("staff branding has a neutral fallback for an empty tenant name", async () => {
  const name = await fetchTenantName(async () =>
    new Response(JSON.stringify({ tenant: { name: " " } }), { status: 200 }),
  );
  assert.equal(name, fallbackTenantName);
});
