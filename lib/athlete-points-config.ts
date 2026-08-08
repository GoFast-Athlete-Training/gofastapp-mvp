/** Personal athlete points — MVP1 flat weights; adjust here without migrations. */

export const ATHLETE_POINTS_WEIGHTS = {
  city_run_rsvp: 1,
  city_run_checkin: 1,
} as const;

export type AthletePointsAction = keyof typeof ATHLETE_POINTS_WEIGHTS;

export type AthletePointsBreakdown = Record<AthletePointsAction, number>;

export type AthletePointsCounts = {
  rsvpGoingCount: number;
  checkinCount: number;
};

export const ATHLETE_POINTS_REDEEM_HINT =
  "Points will unlock merch — coming soon.";

export function computeAthletePoints(counts: AthletePointsCounts): {
  total: number;
  breakdown: AthletePointsBreakdown;
  weights: typeof ATHLETE_POINTS_WEIGHTS;
} {
  const breakdown: AthletePointsBreakdown = {
    city_run_rsvp: counts.rsvpGoingCount * ATHLETE_POINTS_WEIGHTS.city_run_rsvp,
    city_run_checkin:
      counts.checkinCount * ATHLETE_POINTS_WEIGHTS.city_run_checkin,
  };

  const total = breakdown.city_run_rsvp + breakdown.city_run_checkin;

  return {
    total,
    breakdown,
    weights: ATHLETE_POINTS_WEIGHTS,
  };
}
