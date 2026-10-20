/**
 * Athlete plan ingest — preview then commit. Scopes: workout | week | plan.
 */

import type { WorkoutType } from "@prisma/client";
import type { WorkoutStep } from "@/lib/training/prescription";
import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";

export type PlanIngestScope = "workout" | "week" | "plan";

export type PlanIngestWorkoutPayload = {
  dateKey: string;
  workoutType: WorkoutType;
  miles: number;
  catalogueWorkoutId?: string | null;
  planCycleIndex?: number | null;
  segments?: WorkoutStep[];
  suggestedTitle?: string;
  suggestedDescription?: string;
};

export type PlanIngestWeekPayload = {
  weekNumber: number;
  week: PlanWeekSchedule;
};

export type PlanIngestPlanPayload = {
  weeks: PlanWeekSchedule[];
};

export type PlanWeekPreviewDay = {
  dateKey: string;
  weekdayLabel: string;
  workoutType: string;
  miles: number;
  workoutName?: string | null;
  paceNote?: string | null;
  catalogueWorkoutId?: string | null;
  catalogueName?: string | null;
  catalogueApproximate?: boolean;
  catalogueMissing?: boolean;
  hasCustomSegments: boolean;
  structurePreviewLines?: string[];
  action: "replace" | "keep";
  keepReason?: "race" | "completed" | null;
};

export type PlanWeekIngestRowStatus =
  | "import"
  | "skipped_race"
  | "skipped_protected"
  | "out_of_week"
  | "invalid";

export type PlanWeekIngestRow = {
  dateKey: string;
  workoutName: string;
  type: string;
  miles: number | null;
  pace: string;
  status: PlanWeekIngestRowStatus;
  detail?: string;
};

export type PlanIngestPreviewResult =
  | {
      scope: "workout";
      parseSource: "deterministic" | "openai";
      workout: PlanIngestWorkoutPayload;
      summary: string;
    }
  | {
      scope: "week";
      parseSource: "deterministic" | "openai";
      week: PlanIngestWeekPayload;
      summary: string;
      /** @deprecated week ingest materializes from catalogueWorkoutId only */
      daySegmentsByDateKey?: Record<string, WorkoutStep[]>;
      weekPreviewDays?: PlanWeekPreviewDay[];
      weekIngestRows?: PlanWeekIngestRow[];
      catalogueNotes?: string[];
    }
  | {
      scope: "plan";
      parseSource: "deterministic" | "openai";
      plan: PlanIngestPlanPayload;
      summary: string;
      /** CSV/paste workout names keyed by dateKey for display titles after catalogue materialize. */
      dayTitlesByDateKey?: Record<string, string>;
      daySegmentsByDateKey?: Record<string, WorkoutStep[]>;
    };

export type PlanIngestCommitBody = {
  planId: string;
  scope: PlanIngestScope;
  preview: PlanIngestPreviewResult;
};

export type DayBriefStance = "keep" | "shorten" | "swap" | "rest";

export type DayBriefResult = {
  stance: DayBriefStance;
  reasons: string[];
  /** Optional ingest preview the athlete can accept */
  proposedIngest: PlanIngestPreviewResult | null;
};
