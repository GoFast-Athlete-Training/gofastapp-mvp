'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';
import CreateCityRunForm, {
  type CreateCityRunFormWorkout,
} from '@/components/cityruns/CreateCityRunForm';
import GoFastWithMeSetupPanel from '@/components/gofast-with-me/GoFastWithMeSetupPanel';
import GoFastWithMeWorkoutPicker from '@/components/gofast-with-me/GoFastWithMeWorkoutPicker';
import GoFastWithMeRunsPanel from '@/components/gofast-with-me/GoFastWithMeRunsPanel';
import { canPublishPlan } from '@/lib/gofast-with-me/plan-sharing-utils';

type Props = {
  athleteId: string;
  publicSlug: string;
  firstName: string | null;
  plan: ShareHubPlanStatus | null;
  planLoading?: boolean;
  planRefreshing?: boolean;
  onRefreshPlanStatus: () => Promise<void>;
  embedded?: boolean;
};

export default function GoFastWithMeWorkoutsPanel({
  athleteId,
  publicSlug,
  firstName,
  plan,
  planLoading = false,
  planRefreshing = false,
  onRefreshPlanStatus,
  embedded = false,
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
    <section id="workouts" className={embedded ? 'space-y-4' : 'space-y-6 pb-8 max-w-3xl'}>
      {!embedded ? (
        <div>
          <h2 className="text-lg font-bold text-gray-900">Runs &amp; Training</h2>
          <p className="text-sm text-gray-600 mt-1">
            Pick a workout from this week to invite followers. Plan sharing is optional below.
          </p>
          <Link
            href="/training"
            className="inline-flex mt-2 text-sm font-semibold text-sky-700 hover:underline"
          >
            Open My Training for full execution →
          </Link>
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Runs &amp; Training</h3>
          <p className="text-xs text-gray-600 mt-1">Invite from a plan day first — plan sharing optional.</p>
        </div>
      )}

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

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900">Training plan (optional)</h3>
        <p className="text-xs text-gray-600">
          Share how followers train alongside you — polish title and intro when you have an active plan.
        </p>
      </div>

      <GoFastWithMeSetupPanel
        plan={plan}
        landingSlug={publicSlug}
        firstName={firstName}
        loading={planLoading}
        refreshing={planRefreshing}
        onRefresh={onRefreshPlanStatus}
      />
    </section>
  );
}
