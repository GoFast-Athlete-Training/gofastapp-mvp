import assert from "node:assert/strict";
import test from "node:test";
import { buildShapeFromPasteText, parsedPasteToWorkoutSteps } from "@/lib/training/paste-workout-pipeline";
import { tryParsePastedWorkoutText } from "@/lib/training/parse-pasted-workout";
import { groupSegmentsInDisplayOrder, isMultiStepRepeatGroup } from "@/lib/training/segment-summary";
import { normalizeAiSegmentsForAssembler } from "@/lib/training/workout-assembler";

test("assembler outputs flat cycle rows for fartlek shape", () => {
  const parsed = tryParsePastedWorkoutText("20 × (1' @ 10K / 1' steady) — 40 min fartlek", "Intervals");
  assert.ok(parsed);
  const steps = parsedPasteToWorkoutSteps(parsed!, "6:14");
  assert.equal(steps.length, 40);
  const groups = groupSegmentsInDisplayOrder(
    steps.map((s, i) => ({
      id: `s-${i}`,
      stepOrder: s.stepOrder,
      title: s.title ?? "Work",
      durationType: s.durationType,
      durationValue: s.durationValue ?? 0,
      repeatCount: s.repeatCount ?? null,
      targets: s.targets,
    }))
  );
  const block = groups.find((g) => isMultiStepRepeatGroup(g));
  assert.ok(block);
  assert.equal(block!.flatRepeatCount, 20);
});

test("normalizeAi folds paired 20x time segments", () => {
  const normalized = normalizeAiSegmentsForAssembler([
    {
      stepOrder: 1,
      title: "Intervals",
      durationType: "TIME",
      durationValue: 1,
      repeatCount: 20,
      targets: [{ type: "PACE", valueLow: 1, valueHigh: 2 }],
    },
    {
      stepOrder: 2,
      title: "Steady",
      durationType: "TIME",
      durationValue: 1,
      repeatCount: 20,
      targets: [{ type: "PACE", valueLow: 3, valueHigh: 4 }],
    },
  ]);
  assert.equal(normalized.length, 40);
  assert.equal(normalized[0]!.repeatCount, 1);
  assert.equal(normalized[1]!.repeatCount, 1);
});

test("buildShapeFromPaste exposes labels without paces", () => {
  const shape = buildShapeFromPasteText("20 × (1' @ 10K / 1' steady) — 40 min fartlek", "Intervals");
  assert.ok(shape);
  const repeat = shape!.pieces.find((p) => p.kind === "repeat");
  assert.ok(repeat && repeat.kind === "repeat");
  assert.equal(repeat.repeatCount, 20);
  assert.equal(repeat.steps.length, 2);
  assert.equal(repeat.steps[1]!.kind === "effort" ? repeat.steps[1]!.effortLabel : "", "steady");
});
