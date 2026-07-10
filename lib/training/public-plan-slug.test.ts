import { describe, expect, it } from "vitest";
import { slugifyPlanSlug } from "./public-plan-slug";

describe("slugifyPlanSlug", () => {
  it("lowercases and hyphenates plan names", () => {
    expect(slugifyPlanSlug("Adam's Sub-3 Boston Build")).toBe("adam-s-sub-3-boston-build");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugifyPlanSlug("  ---Boston Plan---  ")).toBe("boston-plan");
  });

  it("returns empty string for punctuation-only input", () => {
    expect(slugifyPlanSlug("!!!")).toBe("");
  });
});
