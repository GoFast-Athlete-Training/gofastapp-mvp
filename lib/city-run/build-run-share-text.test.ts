import { describe, expect, it } from "vitest";
import { buildCityRunShareText } from "./build-run-share-text";

describe("buildCityRunShareText", () => {
  it("uses come join me for individual runs", () => {
    const text = buildCityRunShareText({
      runTitle: "Saturday miles",
      cityRunType: "INDIVIDUAL",
    });
    expect(text).toContain("Come join me");
    expect(text).toContain("Saturday miles");
  });

  it("uses club name for club runs", () => {
    const text = buildCityRunShareText({
      runTitle: "Track night",
      cityRunType: "CLUB",
      runClubName: "Runaways",
    });
    expect(text).toContain("Come join Runaways");
  });
});
