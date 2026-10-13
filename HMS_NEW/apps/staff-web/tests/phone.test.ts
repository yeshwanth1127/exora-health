import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingPhone } from "../src/lib/phone.ts";

test("waitlist phone validation rejects the unprefixed long number from the reported failure", () => {
  assert.equal(bookingPhone("81383838383838"), null);
  assert.equal(bookingPhone("919900000002"), null);
  assert.equal(bookingPhone(""), null);
  assert.equal(bookingPhone("1234567890"), null);
});

test("booking contacts normalize Indian mobiles and formatted international numbers to the API contract", () => {
  assert.equal(bookingPhone("99000 00002"), "+919900000002");
  assert.equal(bookingPhone("+91 (99000) 00002"), "+919900000002");
  assert.equal(bookingPhone("+1 (202) 555-0100"), "+12025550100");
  assert.equal(bookingPhone("+01234567890"), null);
  assert.equal(bookingPhone("+1234567890123456"), null);
});
