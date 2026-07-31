'use client';

import Link from 'next/link';
import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';
import GoFastWithMeSetupPanel from '@/components/gofast-with-me/GoFastWithMeSetupPanel';
import GoFastWithMeWorkoutPicker from '@/components/gofast-with-me/GoFastWithMeWorkoutPicker';
import { canPublishPlan } from '@/lib/gofast-with-me/plan-sharing-utils';

type Props = {
  publicSlug: string;
  firstName: string | null;
  plan: ShareHubPlanStatus | null;
  planLoading?: boolean;
  planRefreshing?: boolean;
  onRefreshPlanStatus: () => Promise<void>;
  embedded?: boolean;
};

export default function GoFastWithMeWorkoutsPanel({
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
    <section id="workouts" className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded ? (
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Workouts</h2>
          <p className="text-sm text-gray-600 mt-1">
            Studio controls for how followers see your plan — polish the title and intro, preview
            the public view, and build a GoRun With Me when you&apos;re ready.
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
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">My Workouts</h3>
          <p className="text-xs text-gray-600 mt-1">
            Plan sharing studio — not a second training dashboard.
          </p>
        </div>
      )}

      <GoFastWithMeSetupPanel
        plan={plan}
        landingSlug={publicSlug}
        firstName={firstName}
        loading={planLoading}
        refreshing={planRefreshing}
        onRefresh={onRefreshPlanStatus}
      />

      {showWorkoutPicker ? (
        <GoFastWithMeWorkoutPicker
          planId={plan!.planId!}
          planStartDate={plan!.startDate!}
          totalWeeks={plan!.totalWeeks!}
        />
      ) : null}
    </section>
  );
}
