/**
 * Pick the hero my-race on /races from isPrimaryRace, plan on row, or nearest upcoming.
 */

export type HeroRaceCandidate = {
  athleteRaceId: string;
  raceDate: string;
  isPrimaryRace?: boolean;
  trainingPlanId?: string | null;
};

export function pickHeroAthleteRace(params: {
  upcoming: HeroRaceCandidate[];
}): HeroRaceCandidate | null {
  const { upcoming } = params;
  if (upcoming.length === 0) return null;

  const byPrimary = upcoming.find((r) => r.isPrimaryRace);
  if (byPrimary) return byPrimary;

  const byPlan = upcoming.find((r) => r.trainingPlanId);
  if (byPlan) return byPlan;

  const sorted = [...upcoming].sort(
    (a, b) => new Date(a.raceDate).getTime() - new Date(b.raceDate).getTime()
  );
  return sorted[0] ?? null;
}
