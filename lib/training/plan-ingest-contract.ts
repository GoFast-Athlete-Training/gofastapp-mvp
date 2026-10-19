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
      daySegmentsByDateKey?: Record<string, WorkoutStep[]>;
    }
  | {
      scope: "plan";
      parseSource: "deterministic" | "openai";
      plan: PlanIngestPlanPayload;
      summary: string;
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
