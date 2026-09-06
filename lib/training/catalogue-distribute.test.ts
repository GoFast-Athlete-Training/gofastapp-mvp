import assert from "node:assert/strict";
import test from "node:test";
import {
  distributeCatalogueMiles,
  detectDistributeMode,
  isCanonicalWorkFractionOnlyLongRun,
} from "@/lib/training/catalogue-distribute";

test("fractions-only splits day miles by percentages", () => {
  const bags = distributeCatalogueMiles(
    {
      warmupFraction: 0.1,
      workFraction: 0.5,
      cooldownFraction: 0.1,
      warmupMiles: null,
      cooldownMiles: null,
      workBaseMiles: null,
    },
    20
  );
  assert.equal(bags.mode, "fractions");
  assert.equal(bags.warmupMiles, 2);
  assert.equal(bags.workMiles, 10);
  assert.equal(bags.cooldownMiles, 2);
  assert.equal(bags.easyRemainderMiles, 6);
});

test("miles-only uses absolute bookends and leftover work", () => {
  const bags = distributeCatalogueMiles(
    {
      warmupMiles: 2,
      cooldownMiles: 2,
      workBaseMiles: null,
      warmupFraction: null,
      workFraction: null,
      cooldownFraction: null,
    },
    12
  );
  assert.equal(bags.mode, "miles");
  assert.equal(bags.warmupMiles, 2);
  assert.equal(bags.workMiles, 8);
  assert.equal(bags.cooldownMiles, 2);
  assert.equal(bags.easyRemainderMiles, 0);
});

test("hybrid: absolute warmup then fractions of remainder", () => {
  const bags = distributeCatalogueMiles(
    {
      warmupMiles: 2,
      cooldownMiles: null,
      workFraction: 0.5,
      cooldownFraction: 0.5,
      warmupFraction: null,
      workBaseMiles: null,
    },
    12
  );
  assert.equal(bags.mode, "hybrid");
  assert.equal(bags.warmupMiles, 2);
  assert.equal(bags.workMiles, 5);
  assert.equal(bags.cooldownMiles, 5);
  assert.equal(bags.easyRemainderMiles, 0);
});

test("canonical work-fraction-only detection", () => {
  assert.ok(
    isCanonicalWorkFractionOnlyLongRun({
      workFraction: 0.25,
      warmupFraction: null,
      cooldownFraction: null,
      warmupMiles: null,
      cooldownMiles: null,
      workBaseMiles: null,
    })
  );
  assert.equal(
    detectDistributeMode({
      warmupMiles: 2,
      workFraction: 0.5,
      cooldownFraction: 0.5,
      warmupFraction: null,
      cooldownMiles: null,
      workBaseMiles: null,
    }),
    "hybrid"
  );
});
