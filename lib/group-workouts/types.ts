export type GroupWorkoutSegmentInput = {
  stepOrder: number;
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: number;
  targets?: Array<{ type: string; valueLow?: number; valueHigh?: number }> | null;
  repeatCount?: number | null;
  notes?: string | null;
  recoveryDurationType?: string | null;
  recoveryDurationValue?: number | null;
};

export type GroupWorkoutParseResult = {
  segments: GroupWorkoutSegmentInput[];
  suggestedTitle: string;
  suggestedDescription: string;
};
