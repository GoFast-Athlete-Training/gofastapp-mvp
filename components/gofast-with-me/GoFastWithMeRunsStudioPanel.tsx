'use client';

import { useState } from 'react';
import CreateCityRunForm, {
  type CreateCityRunFormWorkout,
} from '@/components/cityruns/CreateCityRunForm';
import GoFastWithMeWorkoutPicker from '@/components/gofast-with-me/GoFastWithMeWorkoutPicker';
import GoFastWithMeRunsPanel from '@/components/gofast-with-me/GoFastWithMeRunsPanel';
import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';
import { canPublishPlan } from '@/lib/gofast-with-me/plan-sharing-utils';

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
  const [builderWorkout, setBuilderWorkout] = useState<CreateCityRunFormWorkout | null>(null);
  const [hubRefreshKey, setHubRefreshKey] = useState(0);

  const showWorkoutPicker =
    !!plan?.planId &&
    !!plan.startDate &&
    plan.totalWeeks != null &&
    canPublishPlan(plan);

  const handleRunCreated = () => {
    setBuilderWorkout(null);
    setHubRefreshKey((k) => k + 1);
  };

  return (
    <section id="runs-studio" className="space-y-6 pb-8 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Runs</h2>
        <p className="text-sm text-gray-600 mt-1">
          Host join-me runs followers can RSVP to.
        </p>
      </div>

      {showWorkoutPicker ? (
        <GoFastWithMeWorkoutPicker
          planId={plan!.planId!}
          planStartDate={plan!.startDate!}
          totalWeeks={plan!.totalWeeks!}
          onWorkoutReady={(workout) => setBuilderWorkout(workout)}
        />
      ) : null}

      {builderWorkout ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Build your invite</h3>
            <p className="text-xs text-gray-600 mt-1">
              Your workout is set — add meetup, route, and time. You&apos;ll get an RSVP link for
              followers.
            </p>
          </div>
          <CreateCityRunForm
            workout={builderWorkout}
            onCancel={() => setBuilderWorkout(null)}
            onDone={handleRunCreated}
          />
        </div>
      ) : null}

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
