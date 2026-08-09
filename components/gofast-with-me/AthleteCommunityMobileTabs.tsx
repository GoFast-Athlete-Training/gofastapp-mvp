'use client';

import Link from 'next/link';
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
import AthleteCommunityUpdatesSection from '@/components/gofast-with-me/AthleteCommunityUpdatesSection';
import HubWeeklyRunStrip from '@/components/gofast-with-me/HubWeeklyRunStrip';

/** Journey leads; Chatter is last — weekly message → training → runs → join-me → tips. */
const TABS = [
  { id: 'journey', label: 'Journey', icon: <Target className="h-5 w-5" /> },
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
  const nextRun = community.upcomingRuns[0] ?? null;

  return (
    <MobileHubTabs
      tabs={[...TABS]}
      activeTab={activeTab}
      onTabChange={(id) => onTabChange(id as AthleteCommunityHubTab)}
    >
      {activeTab === 'journey' ? (
        <div className="space-y-6">
          <AthleteCommunityUpdatesSection
            messages={updateMessages}
            hostFirstName={firstName}
            isOwner={displayAsOwner}
          />

          {hasTrainingFor ? (
            <GoFastWithMeTrainingForCard
              trainingSummary={community.trainingFor.trainingSummary}
              primaryChasingGoal={community.trainingFor.primaryChasingGoal}
            />
          ) : null}

          <section className="space-y-3">
            <div className="px-1">
              <h2 className="text-lg font-bold text-gray-900">My next run</h2>
              <p className="text-sm text-gray-500 mt-1">
                {displayAsOwner
                  ? 'Hosted runs followers can join.'
                  : `Join ${firstName} on an upcoming run.`}
              </p>
            </div>
            {nextRun ? (
              <Link
                href={nextRun.gorunPath.startsWith('/') ? nextRun.gorunPath : `/${nextRun.gorunPath}`}
                className="block rounded-2xl border border-orange-200 bg-orange-50/60 p-4 hover:bg-orange-50 transition"
              >
                <p className="text-sm font-semibold text-gray-900">{nextRun.title}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {new Date(nextRun.date).toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {nextRun.meetUpPoint ? ` · ${nextRun.meetUpPoint}` : ''}
                </p>
                <span className="mt-2 inline-block text-xs font-semibold text-orange-700">
                  RSVP on GoRun →
                </span>
              </Link>
            ) : (
              <p className="text-sm text-gray-500 rounded-xl border border-dashed border-gray-200 bg-white p-5 text-center">
                {displayAsOwner
                  ? 'No upcoming hosted run yet — create one from studio.'
                  : `${firstName} has not scheduled a joinable run yet.`}
              </p>
            )}
            <HubWeeklyRunStrip runs={community.upcomingRuns} />
            <button
              type="button"
              onClick={() => onTabChange('runs')}
              className="text-xs font-semibold text-orange-600 hover:underline px-1"
            >
              All runs →
            </button>
          </section>

          {community.publishedPlan ? (
            <GoFastWithMePlanStripSection
              publishedPlan={community.publishedPlan}
              hostFirstName={firstName}
              isHost={displayAsOwner}
            />
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900">Join me</h2>
              <p className="text-sm text-gray-600 mt-2">
                {displayAsOwner
                  ? 'Publish your plan in Runs & Training so followers can train with you here.'
                  : `${firstName} hasn't shared a public plan yet.`}
              </p>
            </div>
          )}

          <AthleteTipsSection
            tips={community.tips}
            hostFirstName={firstName}
            isOwner={displayAsOwner}
            instagramUsername={community.host.instagramUsername}
          />
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
  );
}
