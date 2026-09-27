/** Race-day segment builder (no catalogue) — shared by hub, day page, AthleteRacePoint. */
export function buildRaceDayBuilderHref(params: {
  planId: string;
  dateKey: string;
  back: string;
}): string {
  const q = new URLSearchParams({
    raceDay: "1",
    planId: params.planId,
    date: params.dateKey,
    back: params.back,
  });
  return `/workouts/create?${q.toString()}`;
}

export function isRacePlanDay(workoutType: string | null | undefined): boolean {
  return String(workoutType ?? "").trim() === "Race";
}
