/** Plan-aware training CTA for a claimed athlete_races row. */

export function trainingPlanCtaForRace(params: {
  athleteRaceId: string;
  trainingPlanId: string | null;
  goalTime: string | null;
  myRaceHref: string;
}): { href: string; label: string } {
  if (params.trainingPlanId) {
    return {
      href: `/training-setup/${encodeURIComponent(params.trainingPlanId)}`,
      label: "View plan →",
    };
  }
  if (params.goalTime?.trim()) {
    return {
      href: `/training-setup?athleteRaceId=${encodeURIComponent(params.athleteRaceId)}`,
      label: "Add a plan",
    };
  }
  return { href: params.myRaceHref, label: "Set a goal →" };
}
