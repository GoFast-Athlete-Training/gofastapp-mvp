export type PlanPhaseOutline = { name: string; startWeek: number; endWeek: number };
export type PlanWeekOutline = {
  weekNumber: number;
  phase: string;
  schedule: string;
};

export type PlanOutlineResult = {
  phases: PlanPhaseOutline[];
  planWeeks: PlanWeekOutline[];
};
