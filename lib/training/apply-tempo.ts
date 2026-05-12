/**
 * Set tempo day miles from catalogue estimates (pass 4a of plan generation).
 */

import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import {
  estimateCatalogueWorkoutMiles,
  type CatalogueMileEstimateInput,
} from "@/lib/training/catalogue-mile-estimate";

export type ApplyTempoInput = {
  planSchedule: PlanWeekSchedule[];
  catalogueRowsById: Map<string, CatalogueMileEstimateInput>;
};

/** Mutates planSchedule in-place */
export function applyTempoSchedule(input: ApplyTempoInput): void {
  for (const week of input.planSchedule) {
    for (const d of week.days.filter((x) => x.workoutType === "Tempo")) {
      const id = d.catalogueWorkoutId;
      const row = id ? input.catalogueRowsById.get(id) : undefined;
      d.miles = estimateCatalogueWorkoutMiles(row ?? null, "Tempo");
    }
  }
}
