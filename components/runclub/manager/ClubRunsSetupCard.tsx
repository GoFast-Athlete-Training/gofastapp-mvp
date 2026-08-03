'use client';

import ManagerStoplightCard from '@/components/runclub/manager/ManagerStoplightCard';

type ClubRunsSetupCardProps = {
  hasSeries: boolean;
  hasUpcomingRuns: boolean;
  runsNeedReview: number;
  href: string;
};

export default function ClubRunsSetupCard({
  hasSeries,
  hasUpcomingRuns,
  runsNeedReview,
  href,
}: ClubRunsSetupCardProps) {
  const upcomingTone = !hasUpcomingRuns
    ? 'incomplete'
    : runsNeedReview > 0
      ? 'attention'
      : 'complete';
  const upcomingStatus = !hasUpcomingRuns
    ? 'Needs fix'
    : runsNeedReview > 0
      ? `${runsNeedReview} need review`
      : 'Done';

  return (
    <ManagerStoplightCard
      title="Runs"
      items={[
        {
          label: 'Series',
          tone: hasSeries ? 'complete' : 'incomplete',
          status: hasSeries ? 'Done' : 'Needs fix',
          href,
          actionLabel: hasSeries ? 'Edit' : 'Fix',
        },
        {
          label: 'Upcoming',
          tone: upcomingTone,
          status: upcomingStatus,
          href,
          actionLabel: upcomingTone === 'complete' ? 'Edit' : 'Fix',
        },
      ]}
    />
  );
}
