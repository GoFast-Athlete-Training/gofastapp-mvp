'use client';

import { LayoutList, MessageCircle, Route, Users } from 'lucide-react';
import MobileHubTabs from '@/components/shared/MobileHubTabs';
import type { AthleteCommunityHubTab } from '@/lib/gofast-with-me/athlete-community-routes';
import type { CommunityFeedItem } from '@/lib/gofast-with-me/community-feed';
import type { AthleteCommunityPayload } from '@/lib/gofast-with-me/container-hub-service';
import AthleteCommunityFeed from '@/components/gofast-with-me/AthleteCommunityFeed';
import GoFastWithMeHubFeed from '@/components/gofast-with-me/GoFastWithMeHubFeed';
import ContainerHubRunsSection from '@/components/gofast-with-me/ContainerHubRunsSection';
import GoFastWithMeFollowersSection from '@/components/gofast-with-me/GoFastWithMeFollowersSection';

const TABS = [
  { id: 'feed', label: 'Feed', icon: <LayoutList className="h-5 w-5" /> },
  { id: 'runs', label: 'Runs', icon: <Route className="h-5 w-5" /> },
  { id: 'people', label: 'People', icon: <Users className="h-5 w-5" /> },
  { id: 'chatter', label: 'Chatter', icon: <MessageCircle className="h-5 w-5" /> },
] as const;

type Props = {
  activeTab: AthleteCommunityHubTab;
  onTabChange: (tab: AthleteCommunityHubTab) => void;
  community: AthleteCommunityPayload;
  firstName: string;
  displayAsOwner: boolean;
  canParticipate: boolean;
  handle: string;
  feedItems: CommunityFeedItem[];
};

export default function AthleteCommunityMobileTabs({
  activeTab,
  onTabChange,
  community,
  firstName,
  displayAsOwner,
  canParticipate,
  handle,
  feedItems,
}: Props) {
  return (
    <div className="lg:hidden">
      <MobileHubTabs
        tabs={[...TABS]}
        activeTab={activeTab}
        onTabChange={(id) => onTabChange(id as AthleteCommunityHubTab)}
      >
        {activeTab === 'feed' ? (
          <div className="space-y-4">
            <div className="px-1">
              <h2 className="text-lg font-bold text-gray-900">Feed</h2>
              <p className="text-sm text-gray-500 mt-1">
                Updates, tips, and runs from {firstName}.
              </p>
            </div>
            <AthleteCommunityFeed items={feedItems} hostFirstName={firstName} />
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

        {activeTab === 'chatter' ? (
          <section className="flex min-h-[calc(100dvh-11rem)] flex-col min-w-0 space-y-3">
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
      </MobileHubTabs>
    </div>
  );
}
