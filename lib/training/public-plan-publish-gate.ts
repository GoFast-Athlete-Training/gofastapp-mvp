import { planScheduleLooksStructured } from "@/lib/training/plan-schedule-schema";

export function trainingPlanMeetsPublicPublishGate(plan: {
  planSchedule: unknown;
  name: string | null;
}): boolean {
  return planScheduleLooksStructured(plan.planSchedule) && Boolean(plan.name?.trim());
}

export function assertTrainingPlanPublishable(plan: {
  planSchedule: unknown;
  name: string | null;
}): void {
  if (!planScheduleLooksStructured(plan.planSchedule)) {
    throw new Error("Generate your schedule before publishing a public plan");
  }
  if (!plan.name?.trim()) {
    throw new Error("Plan must have a name before publishing");
  }
}
