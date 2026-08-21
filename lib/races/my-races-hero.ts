/**
 * Pick the hero my-race on /races from explicit primary, plan FK, or nearest upcoming.
 */

export type HeroRaceCandidate = {
  athleteRaceId: string;
  raceDate: string;
};

export function pickHeroAthleteRace(params: {
  upcoming: HeroRaceCandidate[];
  primaryAthleteRaceId: string | null;
  planAthleteRaceId?: string | null;
}): HeroRaceCandidate | null {
  const { upcoming, primaryAthleteRaceId, planAthleteRaceId } = params;
  if (upcoming.length === 0) return null;

  if (primaryAthleteRaceId) {
    const byPrimary = upcoming.find((r) => r.athleteRaceId === primaryAthleteRaceId);
    if (byPrimary) return byPrimary;
  }

  if (planAthleteRaceId) {
    const byPlan = upcoming.find((r) => r.athleteRaceId === planAthleteRaceId);
    if (byPlan) return byPlan;
  }

  const sorted = [...upcoming].sort(
    (a, b) => new Date(a.raceDate).getTime() - new Date(b.raceDate).getTime()
  );
  return sorted[0] ?? null;
}

/** @deprecated Use primaryAthleteRaceId */
export function pickHeroAthleteRaceLegacy(params: {
  upcoming: HeroRaceCandidate[];
  planAthleteRaceId: string | null;
  goalAthleteRaceId: string | null;
}): HeroRaceCandidate | null {
  return pickHeroAthleteRace({
    upcoming: params.upcoming,
    primaryAthleteRaceId: params.goalAthleteRaceId,
    planAthleteRaceId: params.planAthleteRaceId,
  });
}
