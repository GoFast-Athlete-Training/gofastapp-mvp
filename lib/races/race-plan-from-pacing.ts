import type { RacePacingBlock } from "@/lib/races/race-pacing-blocks";
import type { RacePlanDocument } from "@/lib/races/race-plan-types";
import { formatPaceMinSec } from "@/lib/training/goal-pace-calculator";

export function pacingBlocksToRacePlanDocument(params: {
  goalTimeDisplay: string;
  blocks: RacePacingBlock[];
}): RacePlanDocument {
  let mileStart = 0;
  const blocks = params.blocks.map((b) => {
    const mileEnd = mileStart + b.miles;
    const docBlock = {
      mileStart,
      mileEnd,
      paceLow: formatPaceMinSec(b.paceSecPerMiLow),
      paceHigh: formatPaceMinSec(b.paceSecPerMiHigh),
      effort: b.kind === "warmup" ? "Ease in" : "Hold goal effort",
      instruction: b.name,
      cue: b.name,
    };
    mileStart = mileEnd;
    return docBlock;
  });
  return {
    goal: `Finish in ${params.goalTimeDisplay}`,
    primaryRule: "Run each segment in the pace band; adjust for hills and weather on race morning.",
    blocks,
  };
}
