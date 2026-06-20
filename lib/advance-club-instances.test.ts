import { describe, expect, it } from "vitest";
import {
  addDaysUtc,
  dateToYmd,
  parseYmd,
  titleForAdvancedDate,
} from "./advance-club-instances";

describe("advance-club-instances title", () => {
  it("updates date suffix in title", () => {
    expect(
      titleForAdvancedDate("The Ballston Runaways Wednesday Run (6/10)", "2026-06-17")
    ).toBe("The Ballston Runaways Wednesday Run (6/17)");
  });
});

describe("advance-club-instances dates", () => {
  it("adds seven days in UTC", () => {
    const prior = parseYmd("2026-06-10");
    const next = addDaysUtc(prior, 7);
    expect(dateToYmd(next)).toBe("2026-06-17");
  });
});
