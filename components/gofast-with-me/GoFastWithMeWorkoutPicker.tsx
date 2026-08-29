'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import api from '@/lib/api';
import { auth } from '@/lib/firebase';
import WeekWorkoutWidget from '@/components/training/WeekWorkoutWidget';
import type { CreateCityRunFormWorkout } from '@/components/cityruns/CreateCityRunForm';
import type { PlanDayCard } from '@/lib/training/fetch-plan-week-client';
import { resolveWorkoutForPlanDay } from '@/lib/training/fetch-plan-week-client';
import { currentTrainingWeekNumber, localTodayKey } from '@/lib/training/plan-utils';
import { displayWorkoutListTitle } from '@/lib/training/workout-display-title';

type Props = {
  planId: string;
  planStartDate: string;
  totalWeeks: number;
  onWorkoutReady: (workout: CreateCityRunFormWorkout) => void;
};

export default function GoFastWithMeWorkoutPicker({
  planId,
  planStartDate,
  totalWeeks,
  onWorkoutReady,
}: Props) {
  const todayKey = localTodayKey();
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    void loadWeek();
  }, [loadWeek]);

  const handleInviteFromDay = async (day: PlanDayCard) => {
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
      const { data } = await api.get<{ workout: CreateCityRunFormWorkout }>(
        `/training/workout/${workoutId}`
      );
      const w = data?.workout;
      if (!w?.id) {
        setError('Workout not found.');
        return;
      }
      onWorkoutReady(w);
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
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-orange-100 p-2 text-orange-700">
          <Users className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Invite from this week&apos;s plan</h3>
          <p className="text-xs text-gray-600 mt-1 max-w-xl">
            Pick a planned workout, set meetup and time, and share an RSVP link — all without
            leaving studio.
          </p>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}

      {loading ? (
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
              onClick={() => void handleInviteFromDay(selectedDay)}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {busyDayKey === selectedDay.dateKey ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Invite from this workout
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
