import type { RunnerAgendaItem } from "@/lib/runner/build-runner-agenda";

export const PAST_RUN_PREVIEW_LIMIT = 5;

export function pastGroupRunItems(pastItems: RunnerAgendaItem[]): RunnerAgendaItem[] {
  return pastItems.filter((item) => item.joinedRun != null);
}

export function pastTrainingWorkoutItems(pastItems: RunnerAgendaItem[]): RunnerAgendaItem[] {
  return pastItems.filter((item) => {
    const run = item.joinedRun;
    if (!run) return false;
    return Boolean(run.workoutId || run.plannedWorkoutId || run.plannedWorkoutPreview);
  });
}
