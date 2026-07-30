'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import PlanWeekViewer from '@/components/training/PlanWeekViewer';
import type { PlanDayCard } from '@/lib/training/fetch-plan-week-client';
import {
  currentTrainingWeekNumber,
  effectiveTrainingWeekCount,
  formatCalendarWeekRangeLabel,
  localTodayKey,
} from '@/lib/training/plan-utils';
import { planScheduleLooksStructured } from '@/lib/training/plan-schedule-schema';
import { buildWeekSummary } from '@/lib/training/week-summary-service';

type PlanDetailSlice = {
  id: string;
  name: string;
  startDate: string;
  totalWeeks: number;
  planSchedule: unknown;
  race_registry?: { raceDate?: string | null } | null;
};

function hasSchedule(plan: PlanDetailSlice): boolean {
  if (!Array.isArray(plan.planSchedule) || (plan.planSchedule as unknown[]).length === 0) {
    return false;
  }
  if (planScheduleLooksStructured(plan.planSchedule)) return true;
  return (plan.planSchedule as unknown[]).some(
    (w) =>
      w &&
      typeof w === 'object' &&
      typeof (w as { schedule?: unknown }).schedule === 'string' &&
      String((w as { schedule: string }).schedule).trim().length > 0
  );
}

function effectiveWeeks(plan: PlanDetailSlice): number {
  return effectiveTrainingWeekCount(
    new Date(plan.startDate),
    plan.totalWeeks,
    plan.race_registry?.raceDate ? new Date(plan.race_registry.raceDate) : null
  );
}

export default function GoFastWithMeWeekStrip() {
  const router = useRouter();
  const [planDetail, setPlanDetail] = useState<PlanDetailSlice | null>(null);
  const [weekNumber, setWeekNumber] = useState(1);
  const [weekDays, setWeekDays] = useState<PlanDayCard[]>([]);
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noPlan, setNoPlan] = useState(false);
  const [noSchedule, setNoSchedule] = useState(false);

  const effectiveTotalWeeks = planDetail ? effectiveWeeks(planDetail) : 1;
  const todayKey = localTodayKey();

  const calendarRangeLabel = useMemo(() => {
    if (!planDetail) return '';
    return formatCalendarWeekRangeLabel(planDetail.startDate, weekNumber, {
      raceDate: planDetail.race_registry?.raceDate ?? null,
      totalWeeks: effectiveTotalWeeks,
    });
  }, [planDetail, weekNumber, effectiveTotalWeeks]);

  const weekSummary = useMemo(() => {
    if (!weekDays.length || !planDetail) return null;
    return buildWeekSummary({
      weekNumber,
      totalWeeks: effectiveTotalWeeks,
      days: weekDays,
    });
  }, [weekDays, weekNumber, effectiveTotalWeeks, planDetail]);

  const loadPlan = useCallback(async () => {
    setLoadingPlan(true);
    setError(null);
    setNoPlan(false);
    setNoSchedule(false);
    try {
      const statusRes = await api.get('/me/share-hub-status');
      const planStatus = statusRes.data?.status?.plan as {
        hasActivePlan?: boolean;
        planId?: string | null;
        hasSchedule?: boolean;
      } | undefined;

      if (!planStatus?.hasActivePlan || !planStatus.planId) {
        setPlanDetail(null);
        setNoPlan(true);
        return;
      }

      if (!planStatus.hasSchedule) {
        setNoSchedule(true);
      }

      const detailRes = await api.get(`/training-plan/${planStatus.planId}`);
      const plan = detailRes.data?.plan as PlanDetailSlice | undefined;
      if (!plan?.id) {
        setError('Could not load your active plan.');
        return;
      }

      setPlanDetail(plan);
      if (hasSchedule(plan)) {
        const wn = currentTrainingWeekNumber(plan.startDate, effectiveWeeks(plan));
        setWeekNumber(wn);
        setSelectedDayKey(todayKey);
      }
    } catch {
      setError('Could not load your training week.');
    } finally {
      setLoadingPlan(false);
    }
  }, [todayKey]);

  const fetchWeekDays = useCallback(
    async (wn: number) => {
      if (!planDetail || !hasSchedule(planDetail)) return;
      setLoadingWeek(true);
      try {
        const res = await api.get('/training/plan/week', {
          params: { planId: planDetail.id, weekNumber: wn },
        });
        const days = (res.data?.days ?? []) as PlanDayCard[];
        setWeekDays(days);
        setSelectedDayKey((prev) => {
          if (days.some((d) => d.dateKey === prev)) return prev;
          if (days.some((d) => d.dateKey === todayKey)) return todayKey;
          return days[0]?.dateKey ?? todayKey;
        });
      } catch {
        setError('Could not load this week.');
      } finally {
        setLoadingWeek(false);
      }
    },
    [planDetail, todayKey]
  );

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    if (!planDetail || !hasSchedule(planDetail)) return;
    void fetchWeekDays(weekNumber);
  }, [planDetail, weekNumber, fetchWeekDays]);

  const openDay = (day: PlanDayCard) => {
    router.push(`/training/day/${encodeURIComponent(day.dateKey)}`);
  };

  if (loadingPlan) {
    return <p className="text-sm text-gray-500">Loading your training week…</p>;
  }

  if (noPlan) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
        <p className="text-sm text-gray-700">No active training plan yet.</p>
        <Link
          href="/training-setup"
          className="inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          Build a plan
        </Link>
      </div>
    );
  }

  if (error && weekDays.length === 0) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (noSchedule || !planDetail || !hasSchedule(planDetail)) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
        <p className="text-sm text-gray-700">Your plan needs a generated schedule before the week strip can load.</p>
        <Link
          href={`/training-setup/${planDetail?.id ?? ''}`}
          className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100"
        >
          Finish generating schedule
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PlanWeekViewer
        weekNumber={weekNumber}
        totalWeeks={effectiveTotalWeeks}
        days={weekDays}
        loading={loadingWeek}
        todayKey={todayKey}
        selectedDateKey={selectedDayKey || todayKey}
        calendarRangeLabel={calendarRangeLabel}
        summary={weekSummary}
        onPrevWeek={() => setWeekNumber((n) => Math.max(1, n - 1))}
        onNextWeek={() => setWeekNumber((n) => Math.min(effectiveTotalWeeks, n + 1))}
        onSelectDay={(day) => {
          setSelectedDayKey(day.dateKey);
          openDay(day);
        }}
        sectionLabel="This week"
        showCalendarRangeLabel
      />
      <p className="text-xs text-gray-500">
        Tap a workout to open it in My Training — Garmin, matching, and full details live there.
      </p>
      <Link
        href="/training"
        className="inline-flex text-sm font-semibold text-sky-700 hover:underline"
      >
        Open in My Training →
      </Link>
    </div>
  );
}
