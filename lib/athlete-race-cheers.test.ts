import assert from "node:assert/strict";
import test from "node:test";
import { appendCheer, parseMyCheers, removeCheer, sanitizeCheerInput } from "./athlete-race-cheers";

test("appendCheer and removeCheer round-trip", () => {
  const clean = sanitizeCheerInput("Sam", "Go get it!");
  assert.ok(clean);
  const withOne = appendCheer([], clean);
  assert.equal(withOne.length, 1);
  const removed = removeCheer(withOne, withOne[0]!.id);
  assert.equal(removed.length, 0);
});

test("parseMyCheers skips invalid rows", () => {
  const parsed = parseMyCheers([
    { id: "a", name: "Pat", message: "Hi", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "", name: "x", message: "y", createdAt: "2026-01-01T00:00:00.000Z" },
  ]);
  assert.equal(parsed.length, 1);
});
