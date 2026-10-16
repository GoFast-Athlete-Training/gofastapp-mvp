"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Dumbbell, MapPin, Users } from "lucide-react";
import api from "@/lib/api";
import GoFastWithMeWorkoutPicker from "@/components/gofast-with-me/GoFastWithMeWorkoutPicker";
import type { CreateCityRunFormWorkout } from "@/components/cityruns/CreateCityRunForm";

type ActivePlan = {
  id: string;
  startDate: string;
  totalWeeks: number;
};

type Props = {
  hasWorkout: boolean;
  workoutTitle?: string | null;
  onChooseMeetupOnly: () => void;
  onWorkoutReady: (workout: CreateCityRunFormWorkout) => void;
};

export default function HostRunWorkoutSlot({
  hasWorkout,
  workoutTitle,
  onChooseMeetupOnly,
  onWorkoutReady,
}: Props) {
  const [planOpen, setPlanOpen] = useState(false);
  const [activePlan, setActivePlan] = useState<ActivePlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const loadActivePlan = useCallback(async () => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await api.get<{ plans?: ActivePlan[] }>("/training-plan", {
        params: { status: "active" },
      });
      const plan = res.data?.plans?.[0];
      if (!plan?.id) {
        setPlanError("No active training plan this week.");
        setActivePlan(null);
        return;
      }
      setActivePlan({
        id: plan.id,
        startDate:
          typeof plan.startDate === "string"
            ? plan.startDate
            : new Date(plan.startDate).toISOString(),
        totalWeeks: plan.totalWeeks,
      });
    } catch {
      setPlanError("Could not load your training plan.");
      setActivePlan(null);
    } finally {
      setPlanLoading(false);
    }
  }, []);

  useEffect(() => {
    if (planOpen && !activePlan && !planLoading && !planError) {
      void loadActivePlan();
    }
  }, [planOpen, activePlan, planLoading, planError, loadActivePlan]);

  function openPlanPicker() {
    setPlanOpen(true);
  }

  function closePlanPicker() {
    setPlanOpen(false);
  }

  const chipBase =
    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition";
  const chipIdle = "border-gray-200 bg-white text-gray-800 hover:bg-gray-50";
  const chipActive = "border-orange-300 bg-orange-50 text-orange-900";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
        Workout (optional)
      </p>

      {hasWorkout && workoutTitle ? (
        <p className="text-sm text-gray-700 mb-3">
          Attached:{" "}
          <span className="font-semibold text-gray-900">{workoutTitle}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            closePlanPicker();
            onChooseMeetupOnly();
          }}
          className={`${chipBase} ${!hasWorkout ? chipActive : chipIdle}`}
        >
          <MapPin className="h-4 w-4 shrink-0" />
          Meetup only
        </button>
        <button
          type="button"
          onClick={() => {
            if (planOpen) closePlanPicker();
            else openPlanPicker();
          }}
          className={`${chipBase} ${planOpen ? chipActive : chipIdle}`}
        >
          <Users className="h-4 w-4 shrink-0" />
          From plan
        </button>
        <Link
          href="/workouts/create?from=host-a-run"
          className={`${chipBase} ${chipIdle}`}
          onClick={() => closePlanPicker()}
        >
          <Dumbbell className="h-4 w-4 shrink-0" />
          Build one
        </Link>
      </div>

      {planOpen ? (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <button
            type="button"
            onClick={closePlanPicker}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Close plan picker
          </button>
          {planLoading ? (
            <div className="py-8 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : planError || !activePlan ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {planError || "No plan found."}
            </div>
          ) : (
            <GoFastWithMeWorkoutPicker
              planId={activePlan.id}
              planStartDate={activePlan.startDate}
              totalWeeks={activePlan.totalWeeks}
              onWorkoutReady={(workout) => {
                closePlanPicker();
                onWorkoutReady(workout);
              }}
            />
          )}
        </div>
      ) : null}
    </section>
  );
}
