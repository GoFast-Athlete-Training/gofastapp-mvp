export type GoFastWithMeTrainingSummary = {
  planName: string;
  startDate: string;
  totalWeeks: number;
  raceName: string | null;
  raceDate: string | null;
  raceCity: string | null;
  raceState: string | null;
  raceDistanceLabel: string | null;
};

export type GoFastWithMeChasingGoal = {
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
