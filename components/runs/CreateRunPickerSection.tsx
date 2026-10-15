"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dumbbell, MapPin, Users } from "lucide-react";
import api from "@/lib/api";
import GoFastWithMeWorkoutPicker from "@/components/gofast-with-me/GoFastWithMeWorkoutPicker";
import CityRunMeetupOnlyForm from "@/components/cityruns/CityRunMeetupOnlyForm";
import type { CreateCityRunFormWorkout } from "@/components/cityruns/CreateCityRunForm";

type ActivePlan = {
  id: string;
  startDate: string;
  totalWeeks: number;
};

type PickerView = "choices" | "plan" | "none";

export default function CreateRunPickerSection() {
  const router = useRouter();
  const [view, setView] = useState<PickerView>("choices");
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
    if (view === "plan" && !activePlan && !planLoading && !planError) {
      void loadActivePlan();
    }
  }, [view, activePlan, planLoading, planError, loadActivePlan]);

  function onPlanWorkoutReady(workout: CreateCityRunFormWorkout) {
    router.push(`/host-a-run?workoutId=${encodeURIComponent(workout.id)}`);
  }

  if (view === "none") {
    return (
      <section className="space-y-4">
        <button
          type="button"
          onClick={() => setView("choices")}
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Back to choices
        </button>
        <CityRunMeetupOnlyForm />
      </section>
    );
  }

  if (view === "plan") {
    return (
      <section className="space-y-4">
        <button
          type="button"
          onClick={() => setView("choices")}
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          ← Back to choices
        </button>
        {planLoading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
          </div>
        ) : planError || !activePlan ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {planError || "No plan found."}
          </div>
        ) : (
          <GoFastWithMeWorkoutPicker
            planId={activePlan.id}
            planStartDate={activePlan.startDate}
            totalWeeks={activePlan.totalWeeks}
            onWorkoutReady={onPlanWorkoutReady}
          />
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-5">
        <div className="rounded-xl bg-orange-100 p-2.5 shrink-0">
          <Users className="h-6 w-6 text-orange-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Create a run</h2>
          <p className="text-sm text-gray-600 mt-1">
            Build a workout, use your plan, or meet up with no workout — then share an invite.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Link
          href="/workouts/create?from=build-a-run"
          className="flex items-start gap-3 rounded-xl border border-orange-200 bg-white p-4 hover:bg-orange-50/40 transition"
        >
          <Dumbbell className="h-5 w-5 text-orange-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-900">Create a workout</p>
            <p className="text-sm text-gray-600 mt-0.5">
              Build distance and pace first, then invite others if you want company.
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setView("plan")}
          className="w-full flex items-start gap-3 rounded-xl border border-orange-200 bg-white p-4 text-left hover:bg-orange-50/40 transition"
        >
          <Users className="h-5 w-5 text-orange-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-900">Choose a workout from plan</p>
            <p className="text-sm text-gray-600 mt-0.5">
              Use a workout from this week, then set meetup and share an invite.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setView("none")}
          className="w-full flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left hover:bg-gray-50 transition"
        >
          <MapPin className="h-5 w-5 text-gray-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-900">None — just want to meet up and go</p>
            <p className="text-sm text-gray-600 mt-0.5">
              Time and place only. Add an optional route when you share the invite.
            </p>
          </div>
        </button>
      </div>
    </section>
  );
}
