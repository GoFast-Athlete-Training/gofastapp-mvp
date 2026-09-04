'use client';

import Link from 'next/link';
import GoFastWithMeSetupPanel from '@/components/gofast-with-me/GoFastWithMeSetupPanel';
import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';

type Props = {
  publicSlug: string;
  firstName: string | null;
  plan: ShareHubPlanStatus | null;
  planLoading?: boolean;
  planRefreshing?: boolean;
  onRefreshPlanStatus: () => Promise<void>;
};

export default function GoFastWithMeTrainingStudioPanel({
  publicSlug,
  firstName,
  plan,
  planLoading = false,
  planRefreshing = false,
  onRefreshPlanStatus,
}: Props) {
  return (
    <section id="training-studio" className="space-y-6 pb-8 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Training</h2>
        <p className="text-sm text-gray-600 mt-1">
          Publish your plan so followers can train alongside you.
        </p>
        <Link
          href="/training"
          className="inline-flex mt-2 text-sm font-semibold text-sky-700 hover:underline"
        >
          Open My Training for full execution →
        </Link>
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
