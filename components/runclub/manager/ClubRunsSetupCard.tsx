'use client';

import ManagerStoplightCard from '@/components/runclub/manager/ManagerStoplightCard';

type ClubRunsSetupCardProps = {
  hasSeries: boolean;
  hasUpcomingRuns: boolean;
  href: string;
};

export default function ClubRunsSetupCard({
  hasSeries,
  hasUpcomingRuns,
  href,
}: ClubRunsSetupCardProps) {
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
          tone: hasUpcomingRuns ? 'complete' : 'incomplete',
          status: hasUpcomingRuns ? 'Done' : 'Needs fix',
          href,
          actionLabel: hasUpcomingRuns ? 'Edit' : 'Fix',
        },
      ]}
    />
  );
}
