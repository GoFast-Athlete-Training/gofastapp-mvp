import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recommendQualityCatalogueIds } from "@/lib/training/recommend-quality-catalogue";

describe("recommendQualityCatalogueIds", () => {
  const catalogue = [
    { id: "a", name: "Steady Tempo", workBaseReps: 1, workBaseRepMeters: 1600 },
    { id: "b", name: "2-1 Tempo", workBaseReps: 3, workBaseRepMeters: 1600 },
    { id: "c", name: "2-1-2 Tempo", workBaseReps: 5, workBaseRepMeters: 1600 },
    { id: "d", name: "Over/Under", workBaseReps: 4, workBaseRepMeters: 800 },
    { id: "e", name: "Rolling 400s", workBaseReps: 8, workBaseRepMeters: 400 },
    { id: "f", name: "Tempo F", workBaseReps: 2, workBaseRepMeters: 1600 },
    { id: "g", name: "Tempo G", workBaseReps: 2, workBaseRepMeters: 1600 },
    { id: "h", name: "Tempo H", workBaseReps: 2, workBaseRepMeters: 1600 },
    { id: "i", name: "Tempo I", workBaseReps: 2, workBaseRepMeters: 1600 },
  ];

  it("elite fills to 8 with aggressive workouts preferred", () => {
    const ids = recommendQualityCatalogueIds({
      catalogue,
      templateSeedIds: ["a", "b"],
      weeklyVolumeBand: "ELITE",
      progressionAggressiveness: "AMBITIOUS",
    });
    assert.equal(ids.length, 8);
    assert.ok(ids.includes("a"));
    assert.ok(ids.includes("b"));
    assert.ok(ids.includes("c"));
  });

  it("finish band keeps a smaller default set", () => {
    const ids = recommendQualityCatalogueIds({
      catalogue,
      templateSeedIds: ["a", "b"],
      weeklyVolumeBand: "FINISH",
      progressionAggressiveness: "CONSERVATIVE",
    });
    assert.ok(ids.length >= 4);
    assert.ok(ids.length <= 8);
    assert.ok(ids.includes("a"));
    assert.ok(ids.includes("b"));
  });
});
