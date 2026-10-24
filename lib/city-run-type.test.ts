import { describe, expect, it } from "vitest";
import { cityRunTypeFromRelationshipPatch } from "@/lib/city-run-type";

describe("cityRunTypeFromRelationshipPatch", () => {
  it("keeps RACE_SHAKEOUT when only runClubId is stamped", () => {
    const type = cityRunTypeFromRelationshipPatch(
      { runClubId: "club-1" },
      {
        cityRunType: "RACE_SHAKEOUT",
        raceRegistryId: "race-1",
        runClubId: null,
        runStoreId: null,
      },
    );
    expect(type).toBeUndefined();
  });

  it("does not retarget type when meetUpStoreId is not a container key", () => {
    const type = cityRunTypeFromRelationshipPatch(
      {},
      {
        cityRunType: "RACE_SHAKEOUT",
        raceRegistryId: "race-1",
        runClubId: "club-1",
        runStoreId: null,
      },
    );
    expect(type).toBeUndefined();
  });
});
