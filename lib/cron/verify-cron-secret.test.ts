import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { verifyCronSecret } from "./verify-cron-secret";

const ORIGINAL = process.env.CRON_SECRET;

test("verifyCronSecret accepts Bearer token", () => {
  process.env.CRON_SECRET = "test-secret-123";
  const req = new NextRequest("http://localhost/api/cron/test", {
    headers: { authorization: "Bearer test-secret-123" },
  });
  assert.equal(verifyCronSecret(req), null);
  process.env.CRON_SECRET = ORIGINAL;
});

test("verifyCronSecret rejects missing auth", () => {
  process.env.CRON_SECRET = "test-secret-123";
  const req = new NextRequest("http://localhost/api/cron/test");
  const res = verifyCronSecret(req);
  assert.ok(res);
  assert.equal(res?.status, 401);
  process.env.CRON_SECRET = ORIGINAL;
});

test("verifyCronSecret rejects invalid token", () => {
  process.env.CRON_SECRET = "test-secret-123";
  const req = new NextRequest("http://localhost/api/cron/test", {
    headers: { authorization: "Bearer wrong" },
  });
  const res = verifyCronSecret(req);
  assert.ok(res);
  assert.equal(res?.status, 401);
  process.env.CRON_SECRET = ORIGINAL;
});

test("verifyCronSecret fails when CRON_SECRET unset", () => {
  delete process.env.CRON_SECRET;
  const req = new NextRequest("http://localhost/api/cron/test", {
    headers: { authorization: "Bearer anything" },
  });
  const res = verifyCronSecret(req);
  assert.ok(res);
  assert.equal(res?.status, 500);
  process.env.CRON_SECRET = ORIGINAL;
});
