'use client';

import { useState } from 'react';
import CreateRunInviteForm, {
  type RunInvitePrefill,
} from '@/components/gofast-with-me/CreateRunInviteForm';
import GoFastWithMeWorkoutPicker from '@/components/gofast-with-me/GoFastWithMeWorkoutPicker';
import GoFastWithMeRunsPanel from '@/components/gofast-with-me/GoFastWithMeRunsPanel';
import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';
import { canPublishPlan } from '@/lib/gofast-with-me/plan-sharing-utils';
import { metersToMiles } from '@/lib/gofast-with-me/invite-workout-edit';
import type { CreateCityRunFormWorkout } from '@/components/cityruns/CreateCityRunForm';

type Props = {
  athleteId: string;
  publicSlug: string;
  plan: ShareHubPlanStatus | null;
};

export default function GoFastWithMeRunsStudioPanel({
  athleteId,
  publicSlug,
  plan,
}: Props) {
  const [prefill, setPrefill] = useState<RunInvitePrefill | null>(null);
  const [showPlanPrefill, setShowPlanPrefill] = useState(false);
  const [hubRefreshKey, setHubRefreshKey] = useState(0);

  const showWorkoutPicker =
    !!plan?.planId &&
    !!plan.startDate &&
    plan.totalWeeks != null &&
    canPublishPlan(plan);

  const handleRunCreated = () => {
    setPrefill(null);
    setShowPlanPrefill(false);
    setHubRefreshKey((k) => k + 1);
  };

  const handleWorkoutReady = (workout: CreateCityRunFormWorkout) => {
    const miles = metersToMiles(workout.estimatedDistanceInMeters ?? null);
    setPrefill({
      title: workout.title,
      date: workout.date?.slice(0, 10) ?? undefined,
      totalMiles: miles != null ? String(miles) : undefined,
    });
    setShowPlanPrefill(false);
  };

  return (
    <section id="runs-studio" className="space-y-6 pb-8 max-w-5xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Runs</h2>
        <p className="text-sm text-gray-600 mt-1">
          Host join-me runs followers can RSVP to.
        </p>
      </div>

      {showWorkoutPicker ? (
        <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/20 p-4">
          <button
            type="button"
            onClick={() => setShowPlanPrefill((v) => !v)}
            className="text-sm font-semibold text-orange-700 hover:text-orange-800"
          >
            {showPlanPrefill ? 'Hide plan prefill' : 'Optional: prefill from this week\'s plan'}
          </button>
          {showPlanPrefill ? (
            <div className="mt-3">
              <GoFastWithMeWorkoutPicker
                planId={plan!.planId!}
                planStartDate={plan!.startDate!}
                totalWeeks={plan!.totalWeeks!}
                onWorkoutReady={handleWorkoutReady}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <CreateRunInviteForm prefill={prefill} onDone={handleRunCreated} />

      <GoFastWithMeRunsPanel
        key={hubRefreshKey}
        athleteId={athleteId}
        publicSlug={publicSlug}
        embedded
        showNoPlanFallback={!showWorkoutPicker}
      />
    </section>
  );
}
