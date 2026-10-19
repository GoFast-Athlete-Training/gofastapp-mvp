import assert from "node:assert/strict";
import test from "node:test";
import { pickClosestCatalogueEntry } from "@/lib/training/plan-ingest-catalogue-match";

test("pickClosestCatalogueEntry prefers structured tempo for multi-block hint", () => {
  const catalogue = [
    {
      id: "easy-only",
      name: "Easy 6",
      slug: "easy-6",
      workoutType: "Tempo" as const,
      segmentPaceDist: null,
      warmupMiles: null,
      cooldownMiles: null,
      workBaseMiles: 6,
      workBaseReps: null,
      workBaseRepMeters: null,
    },
    {
      id: "wu-tempo-cd",
      name: "2-2-2 Tempo",
      slug: "2-2-2-tempo",
      workoutType: "Tempo" as const,
      segmentPaceDist: null,
      warmupMiles: 2,
      cooldownMiles: 2,
      workBaseMiles: 2,
      workBaseReps: null,
      workBaseRepMeters: null,
    },
  ];
  const match = pickClosestCatalogueEntry({
    workoutType: "Tempo",
    miles: 6,
    hintText: "2 miles easy 2 miles hard 2 miles easy",
    catalogue,
  });
  assert.equal(match.catalogueWorkoutId, "wu-tempo-cd");
  assert.equal(match.approximateMatch, true);
});
