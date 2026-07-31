'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Loader2, Users } from 'lucide-react';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';
import WeekWorkoutWidget from '@/components/training/WeekWorkoutWidget';
import type { PlanDayCard } from '@/lib/training/fetch-plan-week-client';
import { resolveWorkoutForPlanDay } from '@/lib/training/fetch-plan-week-client';
import { currentTrainingWeekNumber, localTodayKey } from '@/lib/training/plan-utils';
import { displayWorkoutListTitle } from '@/lib/training/workout-display-title';

type Props = {
  planId: string;
  planStartDate: string;
  totalWeeks: number;
};

export default function GoFastWithMeWorkoutPicker({
  planId,
  planStartDate,
  totalWeeks,
}: Props) {
  const router = useRouter();
  const todayKey = localTodayKey();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weekDays, setWeekDays] = useState<PlanDayCard[]>([]);
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [busyDayKey, setBusyDayKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const weekNumber = currentTrainingWeekNumber(planStartDate, totalWeeks);
      const res = await api.get('/training/plan/week', {
        params: { planId, weekNumber },
      });
      const days = (res.data?.days ?? []) as PlanDayCard[];
      setWeekDays(days);
      setSelectedDayKey((prev) => {
        if (days.some((d) => d.dateKey === prev)) return prev;
        if (days.some((d) => d.dateKey === todayKey)) return todayKey;
        return days.find((d) => d.workoutType !== 'Rest')?.dateKey ?? days[0]?.dateKey ?? todayKey;
      });
    } catch {
      setError('Could not load this week\'s workouts.');
    } finally {
      setLoading(false);
    }
  }, [planId, planStartDate, totalWeeks, todayKey]);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && weekDays.length === 0) {
      void loadWeek();
    }
  };

  const handleBuildRun = async (day: PlanDayCard) => {
    if (day.workoutType === 'Rest' || !day.dateKey) return;
    setBusyDayKey(day.dateKey);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        setError('Sign in required.');
        return;
      }
      const token = await user.getIdToken();
      const workoutId =
        day.workoutId ?? (await resolveWorkoutForPlanDay(planId, day.dateKey, token));
      router.push(`/workouts/${encodeURIComponent(workoutId)}/let-others-join`);
    } catch {
      setError('Could not open the run builder.');
    } finally {
      setBusyDayKey(null);
    }
  };

  const workoutDays = weekDays.filter(
    (day) => day.workoutType !== 'Rest' && day.title.trim().length > 0
  );
  const selectedDay =
    weekDays.find((day) => day.dateKey === selectedDayKey) ??
    workoutDays[0] ??
    null;

  return (
    <div className="rounded-2xl border border-orange-200 bg-orange-50/30 p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-orange-100 p-2 text-orange-700">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Build a GoRun With Me</h3>
            <p className="text-xs text-gray-600 mt-1 max-w-xl">
              Pick a planned workout from this week and open the existing let-others-join builder.
              Full training execution stays in My Training.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-50"
        >
          {expanded ? (
            <>
              Hide workout picker
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            </>
          ) : (
            <>
              Choose a workout
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </>
          )}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}

      {expanded ? (
        loading ? (
          <p className="text-sm text-gray-500 inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading this week&apos;s workouts…
          </p>
        ) : workoutDays.length === 0 ? (
          <p className="text-sm text-gray-600">No workouts scheduled for this week.</p>
        ) : (
          <div className="space-y-4">
            <WeekWorkoutWidget
              days={weekDays}
              todayKey={todayKey}
              selectedDateKey={selectedDayKey || todayKey}
              onSelectDay={(day) => setSelectedDayKey(day.dateKey)}
            />

            <ul className="space-y-2">
              {workoutDays.map((day) => {
                const headline = displayWorkoutListTitle({
                  title: day.title,
                  workoutType: day.workoutType,
                  estimatedDistanceInMeters: day.estimatedDistanceInMeters,
                });
                const selected = day.dateKey === selectedDayKey;
                const busy = busyDayKey === day.dateKey;
                return (
                  <li key={day.dateKey}>
                    <button
                      type="button"
                      onClick={() => setSelectedDayKey(day.dateKey)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        selected
                          ? 'border-orange-300 bg-white shadow-sm'
                          : 'border-orange-100 bg-white/70 hover:border-orange-200'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-gray-900">{headline}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {day.dayAssigned ?? day.dateKey}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {selectedDay ? (
              <button
                type="button"
                disabled={busyDayKey != null}
                onClick={() => void handleBuildRun(selectedDay)}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {busyDayKey === selectedDay.dateKey ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Build GoRun With Me for this workout
              </button>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}
