'use client';

import type { AthleteCommunityPayload } from '@/lib/gofast-with-me/container-hub-service';
import AthleteCommunityGoalRaceCompact from '@/components/gofast-with-me/AthleteCommunityGoalRaceCompact';
import AthleteCommunityMyTrainingSection from '@/components/gofast-with-me/AthleteCommunityMyTrainingSection';
import ContainerHubRunsSection from '@/components/gofast-with-me/ContainerHubRunsSection';
import AthleteCommunityMyRunningSection from '@/components/gofast-with-me/AthleteCommunityMyRunningSection';
import AthleteCommunityTipsRail from '@/components/gofast-with-me/AthleteCommunityTipsRail';
import AthleteCommunityFavoriteRoutesRail from '@/components/gofast-with-me/AthleteCommunityFavoriteRoutesRail';

type Props = {
  community: AthleteCommunityPayload;
  firstName: string;
  displayAsOwner: boolean;
  previewFollower: boolean;
  hasTrainingFor: boolean;
};

export default function AthleteCommunitySections({
  community,
  firstName,
  displayAsOwner,
  previewFollower,
  hasTrainingFor,
}: Props) {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        {hasTrainingFor ? (
          <AthleteCommunityGoalRaceCompact
            trainingSummary={community.trainingFor.trainingSummary}
            primaryChasingGoal={community.trainingFor.primaryChasingGoal}
          />
        ) : (
          <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">Goal Race</h2>
            <p className="mt-2 text-sm text-gray-600">
              {displayAsOwner
                ? 'Set a race goal or active plan — it hydrates here for followers.'
                : `${firstName} hasn't shared a goal race yet.`}
            </p>
          </section>
        )}

        <AthleteCommunityMyTrainingSection
          community={community}
          firstName={firstName}
          displayAsOwner={displayAsOwner}
          previewFollower={previewFollower}
        />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <ContainerHubRunsSection
          runs={community.upcomingRuns}
          hostFirstName={firstName}
          isHost={displayAsOwner}
        />
      </section>

      <AthleteCommunityMyRunningSection
        community={community}
        firstName={firstName}
        displayAsOwner={displayAsOwner}
      />

      <AthleteCommunityFavoriteRoutesRail
        routes={community.runRoutes ?? []}
        firstName={firstName}
      />

      <AthleteCommunityTipsRail
        tips={community.tips}
        firstName={firstName}
        displayAsOwner={displayAsOwner}
      />
    </div>
  );
}
