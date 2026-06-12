import assert from "node:assert/strict";
import test from "node:test";
import {
  emailContactability,
  isApplePrivateRelayEmail,
  isExternallyContactableEmail,
  sanitizeContactEmailForStorage,
} from "./athlete-contact-email";

test("isApplePrivateRelayEmail detects relay domain", () => {
  assert.equal(isApplePrivateRelayEmail("abc@privaterelay.appleid.com"), true);
  assert.equal(isApplePrivateRelayEmail("real@gmail.com"), false);
});

test("isExternallyContactableEmail rejects relay and blank", () => {
  assert.equal(isExternallyContactableEmail("abc@privaterelay.appleid.com"), false);
  assert.equal(isExternallyContactableEmail(""), false);
  assert.equal(isExternallyContactableEmail("runner@gmail.com"), true);
});

test("emailContactability classifies relay separately", () => {
  assert.equal(emailContactability("abc@privaterelay.appleid.com"), "apple_relay");
  assert.equal(emailContactability(null), "missing");
});

test("sanitizeContactEmailForStorage strips relay", () => {
  assert.equal(sanitizeContactEmailForStorage("abc@privaterelay.appleid.com"), null);
  assert.equal(sanitizeContactEmailForStorage("runner@gmail.com"), "runner@gmail.com");
});
