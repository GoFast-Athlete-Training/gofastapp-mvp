import { workoutHasActuals } from "@/lib/training/workout-has-actuals";

export type RunnerPlannedWorkoutPreview = {
  id: string;
  title: string;
  workoutType: string;
  segments: Array<{
    id: string;
    stepOrder: number;
    title: string;
    durationType: string;
    durationValue: number;
    repeatCount?: number | null;
  }>;
};

export type RunnerPlanSession = {
  plannedWorkoutId: string | null;
  workoutId: string | null;
  dateKey: string;
  title: string;
  workoutType: string;
  estimatedDistanceInMeters: number | null;
  actualDistanceMeters: number | null;
  actualDurationSeconds: number | null;
  cityRunId: string | null;
  plannedWorkoutPreview: RunnerPlannedWorkoutPreview | null;
};

export type RunnerJoinedRun = {
  id: string;
  slug: string | null;
  title: string;
  date: string;
  dateKey: string;
  city: string | null;
  cityRunType: string | null;
  meetUpPoint: string;
  meetUpCity: string | null;
  meetUpState: string | null;
  totalMiles: number | null;
  pace: string | null;
  workoutDescription: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone: string | null;
  runClub: { slug: string; name: string; logoUrl: string | null } | null;
  runClubId: string | null;
  plannedWorkoutId: string | null;
  plannedWorkoutPreview: RunnerPlannedWorkoutPreview | null;
  hasCheckin: boolean;
  checkedInAt: string | null;
  isPast: boolean;
  isToday: boolean;
  isLive: boolean;
  needsWereYouThere: boolean;
  supportsCheckin: boolean;
};

export type RunnerAgendaItemKind = 'merged' | 'plan-only' | 'joined-run-only';

export type RunnerAgendaItem = {
  id: string;
  dateKey: string;
  kind: RunnerAgendaItemKind;
  isToday: boolean;
  sortPriority: number;
  plan: RunnerPlanSession | null;
  joinedRun: RunnerJoinedRun | null;
};

export type RunnerAgendaPayload = {
  todayKey: string;
  hasActivePlan: boolean;
  items: RunnerAgendaItem[];
};

type JoinedRunInput = RunnerJoinedRun;
type PlanSessionInput = RunnerPlanSession;

/** Pure merge + rank for runner agenda sources. */
export function buildRunnerAgenda(params: {
  todayKey: string;
  planSessions: PlanSessionInput[];
  joinedRuns: JoinedRunInput[];
  maxItems?: number;
}): RunnerAgendaItem[] {
  const { todayKey, planSessions, joinedRuns, maxItems = 12 } = params;
  const usedPlanKeys = new Set<string>();
  const usedRunIds = new Set<string>();
  const items: RunnerAgendaItem[] = [];

  const planByKey = new Map<string, PlanSessionInput>();
  for (const plan of planSessions) {
    if (!planByKey.has(plan.dateKey)) {
      planByKey.set(plan.dateKey, plan);
    }
  }

  const runById = new Map(joinedRuns.map((r) => [r.id, r]));
  const runsByDate = new Map<string, JoinedRunInput[]>();
  for (const run of joinedRuns) {
    const list = runsByDate.get(run.dateKey) ?? [];
    list.push(run);
    runsByDate.set(run.dateKey, list);
  }

  const isRelevantRun = (run: JoinedRunInput) =>
    !run.isPast || run.needsWereYouThere || run.isLive;

  const isRelevantPlan = (plan: PlanSessionInput) => {
    if (plan.dateKey >= todayKey) return true;
    const linkedRun = plan.cityRunId ? runById.get(plan.cityRunId) : null;
    return linkedRun ? isRelevantRun(linkedRun) : false;
  };

  const sortPriorityFor = (dateKey: string, run: JoinedRunInput | null): number => {
    const isToday = dateKey === todayKey || Boolean(run?.isToday);
    if (isToday) return 0;
    if (run?.needsWereYouThere) return 1;
    if (run?.isLive) return 2;
    if (dateKey < todayKey) return 3;
    return 4;
  };

  const pushItem = (item: Omit<RunnerAgendaItem, 'sortPriority'> & { sortPriority?: number }) => {
    items.push({
      ...item,
      sortPriority: item.sortPriority ?? sortPriorityFor(item.dateKey, item.joinedRun),
    });
  };

  for (const plan of planSessions) {
    if (!isRelevantPlan(plan)) continue;

    let linkedRun: JoinedRunInput | null = null;
    if (plan.cityRunId) {
      linkedRun = runById.get(plan.cityRunId) ?? null;
    }
    if (!linkedRun) {
      linkedRun =
        joinedRuns.find(
          (r) =>
            r.plannedWorkoutId &&
            plan.plannedWorkoutId &&
            r.plannedWorkoutId === plan.plannedWorkoutId
        ) ?? null;
    }

    if (linkedRun && isRelevantRun(linkedRun)) {
      usedPlanKeys.add(plan.dateKey);
      usedRunIds.add(linkedRun.id);
      pushItem({
        id: `merged:${plan.dateKey}:${linkedRun.id}`,
        dateKey: plan.dateKey,
        kind: 'merged',
        isToday: plan.dateKey === todayKey || linkedRun.isToday,
        plan,
        joinedRun: linkedRun,
      });
    }
  }

  const dateKeys = new Set<string>([
    ...planSessions.map((p) => p.dateKey),
    ...joinedRuns.map((r) => r.dateKey),
  ]);

  for (const dateKey of [...dateKeys].sort()) {
    const plan = planByKey.get(dateKey);
    const runsOnDay = (runsByDate.get(dateKey) ?? []).filter(isRelevantRun);

    if (plan && isRelevantPlan(plan) && !usedPlanKeys.has(dateKey)) {
      const unlinkedRun = runsOnDay.find((r) => !usedRunIds.has(r.id)) ?? null;
      if (unlinkedRun) {
        usedPlanKeys.add(dateKey);
        usedRunIds.add(unlinkedRun.id);
        pushItem({
          id: `merged-day:${dateKey}:${unlinkedRun.id}`,
          dateKey,
          kind: 'merged',
          isToday: dateKey === todayKey || unlinkedRun.isToday,
          plan,
          joinedRun: unlinkedRun,
        });
        continue;
      }

      usedPlanKeys.add(dateKey);
      pushItem({
        id: `plan:${dateKey}`,
        dateKey,
        kind: 'plan-only',
        isToday: dateKey === todayKey,
        plan,
        joinedRun: null,
      });
    }

    for (const run of runsOnDay) {
      if (usedRunIds.has(run.id)) continue;
      usedRunIds.add(run.id);
      pushItem({
        id: `run:${run.id}`,
        dateKey: run.dateKey,
        kind: 'joined-run-only',
        isToday: run.isToday,
        plan: null,
        joinedRun: run,
      });
    }
  }

  items.sort((a, b) => {
    if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    return a.id.localeCompare(b.id);
  });

  return items.slice(0, maxItems);
}
