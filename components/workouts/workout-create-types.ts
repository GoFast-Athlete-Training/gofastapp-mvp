export type CatalogueBrowseItem = {
  id: string;
  name: string;
  description: string | null;
  workoutType: string;
  workBaseReps: number | null;
  workBaseRepMeters: number | null;
  recoveryDistanceMeters: number | null;
  recoveryDurationSeconds: number | null;
};
