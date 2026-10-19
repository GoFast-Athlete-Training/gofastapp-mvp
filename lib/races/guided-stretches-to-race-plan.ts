import type { GuidedRaceStretch } from "@/lib/races/guided-race-plan";
import type { RacePlanDocument } from "@/lib/races/race-plan-types";
import { formatPaceMinSec } from "@/lib/training/goal-pace-calculator";

export function guidedStretchesToRacePlanDocument(params: {
  goalTimeDisplay: string;
  stretches: GuidedRaceStretch[];
}): RacePlanDocument {
  const blocks = params.stretches.map((s) => ({
    mileStart: s.mileStart,
    mileEnd: s.mileEnd,
    paceLow: formatPaceMinSec(s.paceSecLow),
    paceHigh: formatPaceMinSec(s.paceSecHigh),
    effort: s.effortNote,
    instruction: s.courseNote ?? s.effortNote,
    cue: s.title,
  }));

  return {
    goal: `Finish in ${params.goalTimeDisplay}`,
    primaryRule: "Run each segment in the pace band; adjust for hills and weather on race morning.",
    blocks,
  };
}
