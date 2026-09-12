import { describe, expect, it } from "vitest";
import { interpolateTemplateString } from "./interpolate";

describe("interpolateTemplateString", () => {
  it("replaces fact placeholders", () => {
    expect(
      interpolateTemplateString("Great job, {{firstName}}!", { firstName: "Alex" }),
    ).toBe("Great job, Alex!");
  });

  it("leaves unknown placeholders empty", () => {
    expect(interpolateTemplateString("{{missing}} done", {})).toBe(" done");
  });
});
