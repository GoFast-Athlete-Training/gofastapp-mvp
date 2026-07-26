'use client';

import Link from 'next/link';
import PublicPlanWeekViewer from '@/components/training/PublicPlanWeekViewer';
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
  return (
    <section id="plan-strip" className="space-y-3">
      <div className="px-1">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Plan strip
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {isHost
            ? 'This is the training week your followers see when you surface your GoFast plan.'
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
        Join the journey on this plan.
      </p>
    </section>
  );
}
