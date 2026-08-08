import { describe, expect, it } from "vitest";
import { computeAthletePoints } from "./athlete-points-config";

describe("computeAthletePoints", () => {
  it("uses flat MVP1 weights", () => {
    const result = computeAthletePoints({ rsvpGoingCount: 3, checkinCount: 5 });
    expect(result.total).toBe(8);
    expect(result.breakdown).toEqual({
      city_run_rsvp: 3,
      city_run_checkin: 5,
    });
    expect(result.weights).toEqual({
      city_run_rsvp: 1,
      city_run_checkin: 1,
    });
  });

  it("returns zero when no activity", () => {
    const result = computeAthletePoints({ rsvpGoingCount: 0, checkinCount: 0 });
    expect(result.total).toBe(0);
  });
});
