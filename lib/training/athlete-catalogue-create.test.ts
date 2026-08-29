import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultFieldsForType } from "@/lib/training/athlete-catalogue-create";

describe("athlete catalogue defaults", () => {
  it("tempo gets sustained block defaults", () => {
    const d = defaultFieldsForType("Tempo");
    assert.equal(d.workBaseMiles, 4.0);
    assert.equal(d.workBaseReps, null);
  });

  it("intervals get rep defaults", () => {
    const d = defaultFieldsForType("Intervals");
    assert.equal(d.workBaseReps, 6);
    assert.equal(d.workBaseRepMeters, 800);
  });
});
