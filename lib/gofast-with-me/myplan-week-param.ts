import { currentTrainingWeekNumber } from "@/lib/training/plan-utils";

/** Resolve `?week=` for `/u/{handle}/myplan` — number, `race`, or current calendar week. */
export function resolveMyPlanInitialWeek(params: {
  weekParam: string | null | undefined;
  totalWeeks: number;
  planStartDate: Date;
}): number {
  const total = Math.max(1, Math.floor(params.totalWeeks));
  const raw = params.weekParam?.trim().toLowerCase() ?? "";
  if (raw === "race") return total;
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1) return Math.min(total, n);
  }
  return currentTrainingWeekNumber(params.planStartDate, total);
}
