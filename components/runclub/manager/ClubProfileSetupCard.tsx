'use client';

import ManagerStoplightCard from '@/components/runclub/manager/ManagerStoplightCard';

type ClubProfileSetupCardProps = {
  coreComplete: boolean;
  socialsComplete: boolean;
  href: string;
};

export default function ClubProfileSetupCard({
  coreComplete,
  socialsComplete,
  href,
}: ClubProfileSetupCardProps) {
  return (
    <ManagerStoplightCard
      title="Club profile"
      items={[
        {
          label: 'Core',
          tone: coreComplete ? 'complete' : 'incomplete',
          status: coreComplete ? 'Done' : 'Needs fix',
          href,
          actionLabel: coreComplete ? 'Edit' : 'Fix',
        },
        {
          label: 'Socials',
          tone: socialsComplete ? 'complete' : 'incomplete',
          status: socialsComplete ? 'Done' : 'Needs fix',
          href,
          actionLabel: socialsComplete ? 'Edit' : 'Fix',
        },
      ]}
    />
  );
}
