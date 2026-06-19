import { describe, expect, it } from "vitest";
import { tryParseTrackIntervalText } from "./parse-group-workout-text";

describe("tryParseTrackIntervalText", () => {
  it("parses 8 x 1600 with recovery", () => {
    const result = tryParseTrackIntervalText("8 x 1600 w/ 400 jog");
    expect(result).not.toBeNull();
    expect(result?.segments).toHaveLength(1);
    expect(result?.segments[0].repeatCount).toBe(8);
    expect(result?.segments[0].durationType).toBe("DISTANCE");
    expect(result?.segments[0].recoveryDurationType).toBe("DISTANCE");
  });

  it("parses compound track prescription", () => {
    const result = tryParseTrackIntervalText("4 x 800m @ 5K; then 4 x 400m");
    expect(result).not.toBeNull();
    expect(result?.segments.length).toBeGreaterThanOrEqual(2);
  });

  it("returns null for non-interval text", () => {
    expect(tryParseTrackIntervalText("easy 6 miles")).toBeNull();
  });
});
