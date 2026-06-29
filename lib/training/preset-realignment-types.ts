/** Service contracts for training preset realignment (Persona → Goal → Coach Intent → Core Preset → Workouts). */

export type TrainingPlanGoalType = "RACE" | "GENERAL_FITNESS" | "MORE_ENDURANCE";

export type PersonaServiceResult = {
  personaSlug: string;
  title: string;
  runningHistory: string | null;
  runningHistorySummary: string | null;
  currentCapability: string | null;
  currentCapabilitySummary: string | null;
  injuryAssessment: string | null;
  injuryAssessmentSummary: string | null;
  dedicationText: string | null;
  dedicationSummary: string | null;
  abilityToTrain: string | null;
  abilityToTrainSummary: string | null;
  estimated5kTimeSeconds: number | null;
  estimated5kPerformanceSummary: string | null;
  estimated5kPerformanceRationale: string | null;
  athletePersonaGoal: string | null;
  athletePersonaSummary: string | null;
  assumptions: string[];
  warnings: string[];
};

export type GoalServiceResult = {
  goalSlug: string;
  goalType: TrainingPlanGoalType;
  targetDistanceLabel: string | null;
  planDurationWeeks: number;
  timeHorizonLabel: string | null;
  successTarget: string | null;
  assumptions: string[];
  warnings: string[];
};

export type CoachIntentServiceResult = {
  coachIntent: string;
  coachingEmphasis: string | null;
  progressionPhilosophy: string | null;
  constraints: string[];
  rationale: string | null;
  warnings: string[];
};

export type WorkoutTypeKey = "Easy" | "LongRun" | "Tempo" | "Intervals";

export type WorkoutStructureSlot = {
  workoutType: WorkoutTypeKey;
  enabled: boolean;
  sessionsPerWeek: number;
};

export type CorePresetServiceResult = {
  title: string;
  description: string | null;
  publicDescription: string | null;
  objectiveOfPlan: string;
  workoutStructure: {
    weeklyRunCount: number;
    cycleLen: number;
    cadenceWeeks: number;
    slots: WorkoutStructureSlot[];
  };
  volume: {
    minWeeklyMiles: number;
    maxWeeklyMiles: number | null;
    baseMiles: number;
    peakMiles: number;
    taperMiles: number;
  };
  schedule: {
    tempoIdealDow: number;
    intervalIdealDow: number;
    longRunDefaultDow: number;
  };
  coachPlanOverviewSummary: string | null;
  reasoning: string | null;
  warnings: string[];
};

export type WorkoutSlotConcept = {
  cyclePosition: number;
  conceptSlug: string;
  intent: string;
  label: string;
};

export type WorkoutBuilderResult = {
  workoutType: WorkoutTypeKey;
  rotationConcept: string;
  slots: WorkoutSlotConcept[];
  warnings: string[];
};

export type CatalogueMatchStatus = "exact" | "similar" | "missing";

export type WorkoutMatcherSlotResult = {
  cyclePosition: number;
  conceptSlug: string;
  status: CatalogueMatchStatus;
  catalogueWorkoutId: string | null;
  catalogueName: string | null;
  catalogueSlug: string | null;
  similar: Array<{ id: string; slug: string; name: string }>;
};

export type WorkoutMatcherResult = {
  workoutType: WorkoutTypeKey;
  slots: WorkoutMatcherSlotResult[];
};

export type SlugResolutionChoice = "use_existing" | "create_new" | "edit" | "skip";

export type SlugResolutionItem<T> = {
  proposedSlug: string;
  proposedLabel: string;
  exactMatch: T | null;
  similar: T[];
  choice: SlugResolutionChoice | null;
  selectedId: string | null;
};
