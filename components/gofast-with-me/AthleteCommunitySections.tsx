'use client';

import { useMemo } from 'react';
import type { AthleteCommunityPayload } from '@/lib/gofast-with-me/container-hub-service';
import AthleteCommunityGoalRaceCompact from '@/components/gofast-with-me/AthleteCommunityGoalRaceCompact';
import AthleteCommunityMyTrainingSection from '@/components/gofast-with-me/AthleteCommunityMyTrainingSection';
import ContainerHubRunsSection from '@/components/gofast-with-me/ContainerHubRunsSection';
import AthleteCommunityTipsRail from '@/components/gofast-with-me/AthleteCommunityTipsRail';
import AthleteCommunityFavoriteRoutesRail from '@/components/gofast-with-me/AthleteCommunityFavoriteRoutesRail';
import AthleteHubStreamFeed from '@/components/gofast-with-me/AthleteHubStreamFeed';
import { composeHubStreamFeed } from '@/lib/gofast-with-me/hub-stream-feed';

type Props = {
  community: AthleteCommunityPayload;
  firstName: string;
  displayAsOwner: boolean;
  previewFollower: boolean;
  hasTrainingFor: boolean;
};

const MAX_UPCOMING_RUNS = 4;

export default function AthleteCommunitySections({
  community,
  firstName,
  displayAsOwner,
  previewFollower,
  hasTrainingFor,
}: Props) {
  const feedItems = useMemo(
    () =>
      composeHubStreamFeed({
        updateMessages: community.messages.filter((m) => m.topic === 'updates'),
        recentActivities: community.recentActivities ?? [],
        attendedClubRuns: community.attendedClubRuns ?? [],
      }),
    [community]
  );

  const upcomingRuns = (community.upcomingRuns ?? []).slice(0, MAX_UPCOMING_RUNS);

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
          runs={upcomingRuns}
          hostFirstName={firstName}
          isHost={displayAsOwner}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Feed</h2>
          <p className="mt-1 text-sm text-gray-500">
            Recent runs, daily logs, and club runs from {firstName}.
          </p>
        </div>
        <AthleteHubStreamFeed items={feedItems} hostFirstName={firstName} />
      </section>

      <AthleteCommunityTipsRail
        tips={community.tips}
        firstName={firstName}
        displayAsOwner={displayAsOwner}
      />

      <AthleteCommunityFavoriteRoutesRail
        routes={community.runRoutes ?? []}
        firstName={firstName}
      />
    </div>
  );
}
