import assert from "node:assert/strict";
import test from "node:test";

const METERS_PER_MILE = 1609.34;

function metersToMiDisplay(m: number | null | undefined): string | null {
  if (m == null || !Number.isFinite(m) || m <= 0) return null;
  const mi = m / METERS_PER_MILE;
  const rounded =
    Math.abs(mi - Math.round(mi)) < 0.06 ? Math.round(mi) : Math.round(mi * 10) / 10;
  return `${rounded} mi`;
}

test("metersToMiDisplay matches title rounding for 10.75 mi easy run", () => {
  const meters = 10.75 * METERS_PER_MILE;
  assert.equal(metersToMiDisplay(meters), "10.8 mi");
});

test("metersToMiDisplay does not jump to 11 mi for near-integer distances", () => {
  const meters = 10.8 * METERS_PER_MILE;
  assert.equal(metersToMiDisplay(meters), "10.8 mi");
});
