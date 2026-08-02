'use client';

import { MessageCircle, Route, Target, Users } from 'lucide-react';
import MobileHubTabs from '@/components/shared/MobileHubTabs';
import type { AthleteCommunityHubTab } from '@/lib/gofast-with-me/athlete-community-routes';
import type { AthleteCommunityPayload } from '@/lib/gofast-with-me/container-hub-service';
import GoFastWithMeHubFeed from '@/components/gofast-with-me/GoFastWithMeHubFeed';
import GoFastWithMeTrainingForCard from '@/components/gofast-with-me/GoFastWithMeTrainingForCard';
import GoFastWithMePlanStripSection from '@/components/gofast-with-me/GoFastWithMePlanStripSection';
import ContainerHubRunsSection from '@/components/gofast-with-me/ContainerHubRunsSection';
import GoFastWithMeFollowersSection from '@/components/gofast-with-me/GoFastWithMeFollowersSection';
import AthleteTipsSection from '@/components/gofast-with-me/AthleteTipsSection';
import AthleteInstagramSection from '@/components/gofast-with-me/AthleteInstagramSection';
import AthleteCommunityUpdatesSection from '@/components/gofast-with-me/AthleteCommunityUpdatesSection';
import AthleteCommunityLatestUpdateBanner from '@/components/gofast-with-me/AthleteCommunityLatestUpdateBanner';

const TABS = [
  { id: 'chatter', label: 'Chatter', icon: <MessageCircle className="h-5 w-5" /> },
  { id: 'journey', label: 'Journey', icon: <Target className="h-5 w-5" /> },
  { id: 'runs', label: 'Runs', icon: <Route className="h-5 w-5" /> },
  { id: 'people', label: 'People', icon: <Users className="h-5 w-5" /> },
] as const;

type Props = {
  activeTab: AthleteCommunityHubTab;
  onTabChange: (tab: AthleteCommunityHubTab) => void;
  community: AthleteCommunityPayload;
  firstName: string;
  displayAsOwner: boolean;
  canParticipate: boolean;
  handle: string;
  updateMessages: AthleteCommunityPayload['messages'];
  hasTrainingFor: boolean;
};

export default function AthleteCommunityMobileTabs({
  activeTab,
  onTabChange,
  community,
  firstName,
  displayAsOwner,
  canParticipate,
  handle,
  updateMessages,
  hasTrainingFor,
}: Props) {
  const latestUpdate = updateMessages[0] ?? null;

  return (
    <MobileHubTabs
      tabs={[...TABS]}
      activeTab={activeTab}
      onTabChange={(id) => onTabChange(id as AthleteCommunityHubTab)}
    >
      {activeTab === 'chatter' ? (
        <section className="flex min-h-[calc(100dvh-11rem)] flex-col min-w-0 space-y-3">
          {latestUpdate ? (
            <AthleteCommunityLatestUpdateBanner
              update={latestUpdate}
              hostFirstName={firstName}
              onViewJourney={() => onTabChange('journey')}
              hasMultiple={updateMessages.length > 1}
            />
          ) : null}
          <GoFastWithMeHubFeed
            hostId={community.host.id}
            isHost={displayAsOwner}
            canAccessFeed={canParticipate}
            upcomingRuns={community.upcomingRuns}
            publishedPlan={community.publishedPlan}
            initialMessages={community.messages.filter((m) => m.topic === 'chatter')}
            chatterMode
            variant="mobile-hub"
            showHeading
          />
        </section>
      ) : null}

      {activeTab === 'journey' ? (
        <div className="space-y-6">
          {hasTrainingFor ? (
            <GoFastWithMeTrainingForCard
              trainingSummary={community.trainingFor.trainingSummary}
              primaryChasingGoal={community.trainingFor.primaryChasingGoal}
            />
          ) : null}

          {community.publishedPlan ? (
            <GoFastWithMePlanStripSection
              publishedPlan={community.publishedPlan}
              hostFirstName={firstName}
              isHost={displayAsOwner}
            />
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">Plan</h2>
              <p className="text-sm text-gray-600 mt-2">
                {displayAsOwner
                  ? 'Publish your plan in Runs & Training so followers can see your training week here.'
                  : `${firstName} hasn't shared a public plan yet.`}
              </p>
            </div>
          )}

          <AthleteCommunityUpdatesSection
            messages={updateMessages}
            hostFirstName={firstName}
            isOwner={displayAsOwner}
          />

          <AthleteTipsSection
            tips={community.tips}
            hostFirstName={firstName}
            isOwner={displayAsOwner}
          />

          <AthleteInstagramSection media={community.instagramMedia} />
        </div>
      ) : null}

      {activeTab === 'runs' ? (
        <ContainerHubRunsSection
          runs={community.upcomingRuns}
          hostFirstName={firstName}
          isHost={displayAsOwner}
        />
      ) : null}

      {activeTab === 'people' ? (
        <GoFastWithMeFollowersSection
          hub={{
            ...community,
            isHost: displayAsOwner,
          }}
          handle={handle}
          variant="hub"
        />
      ) : null}
    </MobileHubTabs>
  );
}
