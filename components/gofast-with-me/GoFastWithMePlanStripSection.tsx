'use client';

import Link from 'next/link';
import PublicPlanWeekViewer from '@/components/training/PublicPlanWeekViewer';
import AdoptThisPlanPanel from '@/components/training/AdoptThisPlanPanel';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  publishedPlan: NonNullable<ContainerHubPayload['publishedPlan']>;
  hostFirstName: string;
  isHost: boolean;
};

export default function GoFastWithMePlanStripSection({
  publishedPlan,
  hostFirstName,
  isHost,
}: Props) {
  const canAdopt =
    publishedPlan.isPublic &&
    !isHost &&
    !!publishedPlan.raceRegistryId &&
    !!publishedPlan.raceName &&
    !!publishedPlan.raceDate;

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Join me
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {isHost
            ? 'This is the training week your followers see when you share your GoFast plan.'
            : `Train alongside ${hostFirstName} — their current week on this plan.`}
        </p>
      </div>
      <PublicPlanWeekViewer
        weeks={publishedPlan.weeks}
        totalWeeks={publishedPlan.totalWeeks}
        ctaHref={`/plans/${encodeURIComponent(publishedPlan.slug)}`}
        ctaLabel="View full plan"
      />
      <p className="text-xs text-gray-500 px-1">
        <Link
          href={`/plans/${encodeURIComponent(publishedPlan.slug)}`}
          className="text-orange-600 font-semibold hover:underline"
        >
          {publishedPlan.name}
        </Link>
        {' · '}
        See the full build on this plan.
      </p>
      {canAdopt ? (
        <AdoptThisPlanPanel
          slug={publishedPlan.slug}
          planTitle={publishedPlan.name}
          raceRegistryId={publishedPlan.raceRegistryId!}
          raceName={publishedPlan.raceName!}
          raceDate={publishedPlan.raceDate!}
          distanceLabel={publishedPlan.distanceLabel}
          distanceMeters={publishedPlan.distanceMeters}
          sourceAuthorAthleteId={publishedPlan.sourceAuthorAthleteId}
          className="mx-1"
        />
      ) : null}
    </div>
  );
}
