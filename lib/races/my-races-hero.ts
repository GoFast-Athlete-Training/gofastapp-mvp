/**
 * Pick the hero my-race on /races from plan FK, goal bolt, or nearest upcoming.
 */

export type HeroRaceCandidate = {
  athleteRaceId: string;
  raceDate: string;
};

export function pickHeroAthleteRace(params: {
  upcoming: HeroRaceCandidate[];
  planAthleteRaceId: string | null;
  goalAthleteRaceId: string | null;
}): HeroRaceCandidate | null {
  const { upcoming, planAthleteRaceId, goalAthleteRaceId } = params;
  if (upcoming.length === 0) return null;

  if (planAthleteRaceId) {
    const byPlan = upcoming.find((r) => r.athleteRaceId === planAthleteRaceId);
    if (byPlan) return byPlan;
  }

  if (goalAthleteRaceId) {
    const byGoal = upcoming.find((r) => r.athleteRaceId === goalAthleteRaceId);
    if (byGoal) return byGoal;
  }

  const sorted = [...upcoming].sort(
    (a, b) => new Date(a.raceDate).getTime() - new Date(b.raceDate).getTime()
  );
  return sorted[0] ?? null;
}
