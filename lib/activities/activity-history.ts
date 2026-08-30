import { Prisma } from '@prisma/client';

export const ACTIVITY_HISTORY_DEFAULT_LIMIT = 50;
export const ACTIVITY_HISTORY_MAX_LIMIT = 200;

export type ActivityHistoryFilter = 'all' | 'unmatched';

export type ActivityHistoryRow = {
  id: string;
  sourceActivityId: string;
  source: string;
  ingestionStatus: string;
  activityType: string | null;
  activityName: string | null;
  startTime: string | null;
  duration: number | null;
  distance: number | null;
  calories: number | null;
  averageSpeed: number | null;
  averageHeartRate: number | null;
  elevationGain: number | null;
  matchedWorkoutId: string | null;
  matchedWorkoutTitle: string | null;
  matchedWorkoutType: string | null;
  matchedPlanName: string | null;
  communityPublishedAt: string | null;
};

export type ActivityHistoryCursor = {
  startTime: string;
  id: string;
};

type RawActivityRow = {
  id: string;
  sourceActivityId: string;
  source: string;
  ingestionStatus: string;
  activityType: string | null;
  activityName: string | null;
  startTime: Date | null;
  duration: number | null;
  distance: number | null;
  calories: number | null;
  averageSpeed: number | null;
  averageHeartRate: number | null;
  elevationGain: number | null;
  matched_workout: {
    id: string;
    title: string;
    workoutType: string;
    communityPublishedAt: Date | null;
    training_plans: { name: string } | null;
  } | null;
};

export const activityHistoryInclude = {
  matched_workout: {
    select: {
      id: true,
      title: true,
      workoutType: true,
      communityPublishedAt: true,
      training_plans: { select: { name: true } },
    },
  },
} as const;

export function parseActivityHistoryLimit(raw: string | null): number {
  if (!raw) return ACTIVITY_HISTORY_DEFAULT_LIMIT;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return ACTIVITY_HISTORY_DEFAULT_LIMIT;
  return Math.min(ACTIVITY_HISTORY_MAX_LIMIT, Math.max(1, parsed));
}

export function parseActivityHistoryFilter(raw: string | null): ActivityHistoryFilter {
  return raw === 'unmatched' ? 'unmatched' : 'all';
}

export function formatLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseActivityHistoryDate(raw: string | null): Date | null {
  if (!raw?.trim()) return null;
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function encodeActivityHistoryCursor(row: { startTime: Date | null; id: string }): string | null {
  if (!row.startTime) return null;
  const payload: ActivityHistoryCursor = {
    startTime: row.startTime.toISOString(),
    id: row.id,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeActivityHistoryCursor(raw: string | null): ActivityHistoryCursor | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw.trim(), 'base64url').toString('utf8')) as ActivityHistoryCursor;
    if (!parsed?.id || !parsed?.startTime) return null;
    const startTime = new Date(parsed.startTime);
    if (Number.isNaN(startTime.getTime())) return null;
    return { id: parsed.id, startTime: startTime.toISOString() };
  } catch {
    return null;
  }
}

export function buildActivityHistoryWhere(params: {
  athleteId: string;
  filter: ActivityHistoryFilter;
  from: Date | null;
  to: Date | null;
  cursor: ActivityHistoryCursor | null;
}): Prisma.athlete_activitiesWhereInput {
  const and: Prisma.athlete_activitiesWhereInput[] = [{ athleteId: params.athleteId }];

  if (params.filter === 'unmatched') {
    and.push({ matched_workout: { is: null } });
  }

  if (params.from || params.to) {
    and.push({
      startTime: {
        ...(params.from ? { gte: params.from } : {}),
        ...(params.to ? { lt: params.to } : {}),
      },
    });
  }

  if (params.cursor) {
    const cursorTime = new Date(params.cursor.startTime);
    and.push({
      OR: [
        { startTime: { lt: cursorTime } },
        {
          AND: [{ startTime: cursorTime }, { id: { lt: params.cursor.id } }],
        },
      ],
    });
  }

  return and.length === 1 ? and[0]! : { AND: and };
}

export function mapActivityHistoryRow(row: RawActivityRow): ActivityHistoryRow {
  return {
    id: row.id,
    sourceActivityId: row.sourceActivityId,
    source: row.source,
    ingestionStatus: row.ingestionStatus,
    activityType: row.activityType,
    activityName: row.activityName,
    startTime: row.startTime?.toISOString() ?? null,
    duration: row.duration,
    distance: row.distance,
    calories: row.calories,
    averageSpeed: row.averageSpeed,
    averageHeartRate: row.averageHeartRate,
    elevationGain: row.elevationGain,
    matchedWorkoutId: row.matched_workout?.id ?? null,
    matchedWorkoutTitle: row.matched_workout?.title ?? null,
    matchedWorkoutType: row.matched_workout?.workoutType ?? null,
    matchedPlanName: row.matched_workout?.training_plans?.name ?? null,
    communityPublishedAt: row.matched_workout?.communityPublishedAt?.toISOString() ?? null,
  };
}

export function getSundayWeekStart(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatWeekRangeLabel(start: Date, endExclusive: Date): string {
  const end = addDays(endExclusive, -1);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endLabel = end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}

export function computeWeekStats(items: ActivityHistoryRow[]) {
  const miles = items.reduce((sum, item) => sum + (item.distance ?? 0) / 1609.34, 0);
  const minutes = items.reduce((sum, item) => sum + (item.duration ?? 0) / 60, 0);
  const calories = items.reduce((sum, item) => sum + (item.calories ?? 0), 0);
  return {
    activities: items.length,
    miles,
    minutes: Math.round(minutes),
    calories: Math.round(calories),
  };
}
