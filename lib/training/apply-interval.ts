/**
 * Set interval day miles from catalogue estimates (pass 4b of plan generation).
 */

import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import {
  estimateCatalogueWorkoutMiles,
  type CatalogueMileEstimateInput,
} from "@/lib/training/catalogue-mile-estimate";

export type ApplyIntervalInput = {
  planSchedule: PlanWeekSchedule[];
  catalogueRowsById: Map<string, CatalogueMileEstimateInput>;
};

/** Mutates planSchedule in-place */
export function applyIntervalSchedule(input: ApplyIntervalInput): void {
  for (const week of input.planSchedule) {
    for (const d of week.days.filter((x) => x.workoutType === "Intervals")) {
      const id = d.catalogueWorkoutId;
      const row = id ? input.catalogueRowsById.get(id) : undefined;
      d.miles = estimateCatalogueWorkoutMiles(row ?? null, "Intervals");
    }
  }
}
