'use client';

import Link from 'next/link';
import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';
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
  const showWorkoutPicker =
    !!plan?.planId &&
    !!plan.startDate &&
    plan.totalWeeks != null &&
    canPublishPlan(plan);

  return (
    <section id="workouts" className={embedded ? 'space-y-4' : 'space-y-6 pb-8 max-w-3xl'}>
      {!embedded ? (
        <div>
          <h2 className="text-lg font-bold text-gray-900">Runs &amp; Training</h2>
          <p className="text-sm text-gray-600 mt-1">
            Host a joinable run anytime — no plan required. Plan sharing is optional below.
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
          <p className="text-xs text-gray-600 mt-1">Hosted runs first — plan sharing optional.</p>
        </div>
      )}

      <GoFastWithMeRunsPanel athleteId={athleteId} publicSlug={publicSlug} embedded />

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

      {showWorkoutPicker ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">GoRun from this week&apos;s plan</h3>
          <GoFastWithMeWorkoutPicker
            planId={plan!.planId!}
            planStartDate={plan!.startDate!}
            totalWeeks={plan!.totalWeeks!}
          />
        </div>
      ) : null}
    </section>
  );
}
