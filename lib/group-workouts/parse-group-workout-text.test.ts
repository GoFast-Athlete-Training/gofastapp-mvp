import { describe, expect, it } from "vitest";
import { tryParseTrackIntervalText } from "./parse-group-workout-text";

describe("tryParseTrackIntervalText", () => {
  it("parses 8 x 1600 with recovery and 10K pace offset", () => {
    const result = tryParseTrackIntervalText("8 x 1600 @ 10K w/ 400 jog");
    expect(result).not.toBeNull();
    expect(result?.segments).toHaveLength(1);
    expect(result?.segments[0].repeatCount).toBe(8);
    expect(result?.segments[0].durationType).toBe("DISTANCE");
    expect(result?.segments[0].recoveryDurationType).toBe("DISTANCE");
    expect(result?.segments[0].targets?.[0]?.type).toBe("PACE_OFFSET");
    expect(result?.segments[0].targets?.[0]?.value).toBe(15);
  });

  it("parses compound track prescription", () => {
    const result = tryParseTrackIntervalText("4 x 800m @ 5K; then 4 x 400m");
    expect(result).not.toBeNull();
    expect(result?.segments.length).toBeGreaterThanOrEqual(2);
  });

  it("returns null for non-interval text", () => {
    expect(tryParseTrackIntervalText("easy 6 miles")).toBeNull();
  });

  it("parses warmup, intervals, and cooldown in order", () => {
    const result = tryParseTrackIntervalText(
      "1 mile warmup, 5 x 1600m @ 10K with 400m recovery, 1 mile cooldown"
    );
    expect(result).not.toBeNull();
    expect(result?.segments).toHaveLength(3);
    expect(result?.segments[0].title).toBe("Warmup");
    expect(result?.segments[0].repeatCount).toBeNull();
    expect(result?.segments[1].repeatCount).toBe(5);
    expect(result?.segments[1].recoveryDurationType).toBe("DISTANCE");
    expect(result?.segments[1].targets?.[0]?.type).toBe("PACE_OFFSET");
    expect(result?.segments[2].title).toBe("Cooldown");
    expect(result?.segments[2].recoveryDurationType).toBeNull();
  });
});
