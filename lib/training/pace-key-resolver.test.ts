import assert from "node:assert/strict";
import test from "node:test";
import {
  effectivePaceProfileForPreset,
  resolveCataloguePaceSecPerMile,
} from "@/lib/training/pace-key-resolver";
import { defaultPaceProfileForCapability } from "@/lib/training/preset-strategy";

const ANCHOR_SEC = 386; // 6:26/mi

test("effectivePaceProfileForPreset preserves authored profile", () => {
  const authored = {
    moderate: { anchor: "current5k" as const, offsetSecPerMile: 45 },
  };
  const out = effectivePaceProfileForPreset({
    paceProfile: authored,
    athletePersonaCapability: null,
  });
  assert.deepEqual(out, authored);
});

test("effectivePaceProfileForPreset falls back when preset profile is null", () => {
  const out = effectivePaceProfileForPreset({
    paceProfile: null,
    athletePersonaCapability: null,
  });
  assert.deepEqual(out, defaultPaceProfileForCapability(null));
  assert.equal(out.moderate?.offsetSecPerMile, 60);
  assert.equal(out.threshold?.offsetSecPerMile, 20);
});

test("resolveCataloguePaceSecPerMile resolves moderate and threshold from default profile", () => {
  const profile = defaultPaceProfileForCapability(null);
  const ctx = {
    fitnessAnchorSecPerMile: ANCHOR_SEC,
    racePaceSecPerMile: null,
    paceProfile: profile,
  };
  assert.equal(
    resolveCataloguePaceSecPerMile({ paceKey: "moderate", ctx }),
    ANCHOR_SEC + 60
  );
  assert.equal(
    resolveCataloguePaceSecPerMile({ paceKey: "threshold", ctx }),
    ANCHOR_SEC + 20
  );
});
