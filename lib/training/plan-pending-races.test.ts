import { describe, expect, it } from "vitest";
import {
  computePendingCandidates,
  getSnappedAthleteRaceIds,
} from "./plan-pending-races";

describe("plan-pending-races", () => {
  it("extracts snapped ids from along-way JSON", () => {
    const ids = getSnappedAthleteRaceIds([
      { sourceAthleteRaceId: "a", raceRegistryId: "r1", name: "A", raceDate: "2026-06-01T00:00:00.000Z" },
      { sourceAthleteRaceId: "b", raceRegistryId: "r2", name: "B", raceDate: "2026-07-01T00:00:00.000Z" },
    ]);
    expect(ids).toEqual(["a", "b"]);
  });

  it("pending = in-window candidates not in snaps", () => {
    const candidates = [
      {
        athleteRaceId: "snap-a",
        raceRegistryId: "r1",
        race: { name: "Snap A", raceDate: "2026-06-01T00:00:00.000Z", distanceLabel: "10K" },
      },
      {
        athleteRaceId: "new-b",
        raceRegistryId: "r2",
        race: { name: "New B", raceDate: "2026-07-01T00:00:00.000Z", distanceLabel: "Half" },
      },
    ];
    const pending = computePendingCandidates(candidates, ["snap-a"]);
    expect(pending.map((c) => c.athleteRaceId)).toEqual(["new-b"]);
  });
});
