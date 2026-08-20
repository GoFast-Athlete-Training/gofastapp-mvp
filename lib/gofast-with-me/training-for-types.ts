export type GoFastWithMeTrainingSummary = {
  planName: string;
  startDate: string;
  totalWeeks: number;
  athleteRaceId?: string | null;
  raceName: string | null;
  raceDate: string | null;
  raceCity: string | null;
  raceState: string | null;
  raceDistanceLabel: string | null;
};

export type GoFastWithMeChasingGoal = {
  athleteRaceId?: string | null;
  name: string | null;
  distance: string;
  goalTime: string | null;
  targetByDate: string;
  raceName: string | null;
  raceDate: string | null;
  raceCity: string | null;
  raceState: string | null;
  raceDistanceLabel: string | null;
};

export type GoFastWithMeTrainingFor = {
  trainingSummary: GoFastWithMeTrainingSummary | null;
  primaryChasingGoal: GoFastWithMeChasingGoal | null;
};
