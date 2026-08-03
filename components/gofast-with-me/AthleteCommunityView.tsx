'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { User } from 'lucide-react';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import type { AthleteCommunityPayload } from '@/lib/gofast-with-me/container-hub-service';
import {
  ATHLETE_COMMUNITY_TAB_PRIMARY_SECTION,
  athleteCommunityPreviewPath,
  athleteCommunitySectionToHubTab,
  athletePublicPagePath,
  goFastWithConfirmPath,
  goFastWithSignupPath,
  parseAthleteCommunitySection,
  type AthleteCommunityHubTab,
} from '@/lib/gofast-with-me/athlete-community-routes';
import { applyFollowerPreviewMode } from '@/lib/gofast-with-me/athlete-community-access';
import TopNav from '@/components/shared/TopNav';
import AthleteCommunityMobileTabs from '@/components/gofast-with-me/AthleteCommunityMobileTabs';
import GoFastWithMeTrainingForCard from '@/components/gofast-with-me/GoFastWithMeTrainingForCard';
import GoFastWithMePlanStripSection from '@/components/gofast-with-me/GoFastWithMePlanStripSection';
import ContainerHubRunsSection from '@/components/gofast-with-me/ContainerHubRunsSection';
import GoFastWithMeHubFeed from '@/components/gofast-with-me/GoFastWithMeHubFeed';
import GoFastWithMeFollowersSection from '@/components/gofast-with-me/GoFastWithMeFollowersSection';
import AthleteTipsSection from '@/components/gofast-with-me/AthleteTipsSection';
import AthleteCommunityUpdatesSection from '@/components/gofast-with-me/AthleteCommunityUpdatesSection';
import AthleteCommunityLatestUpdateBanner from '@/components/gofast-with-me/AthleteCommunityLatestUpdateBanner';

type Props = {
  handle: string;
};

export default function AthleteCommunityView({ handle }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const previewFollower = searchParams.get('preview') === 'follower';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [community, setCommunity] = useState<AthleteCommunityPayload | null>(null);
  const [activeTab, setActiveTab] = useState<AthleteCommunityHubTab>(() =>
    athleteCommunitySectionToHubTab(
      parseAthleteCommunitySection(typeof window !== 'undefined' ? window.location.hash : '')
    )
  );
  const [actionLoading, setActionLoading] = useState(false);

  const loadCommunity = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get(`/athlete/public/${encodeURIComponent(handle)}/community`);
      if (res.data?.success && res.data.community) {
        setCommunity(res.data.community as AthleteCommunityPayload);
      } else {
        throw new Error(res.data?.error || 'Community not found');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not load community');
    } finally {
      setLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    void loadCommunity();
  }, [loadCommunity]);

  useEffect(() => {
    const syncHash = () => {
      setActiveTab(
        athleteCommunitySectionToHubTab(parseAthleteCommunitySection(window.location.hash))
      );
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const selectTab = (tab: AthleteCommunityHubTab) => {
    setActiveTab(tab);
    const section = ATHLETE_COMMUNITY_TAB_PRIMARY_SECTION[tab];
    window.history.replaceState(null, '', `#${section}`);
  };

  const preview = applyFollowerPreviewMode(
    {
      isOwner: community?.isOwner ?? false,
      isFollowing: community?.isFollowing ?? false,
      canParticipate: community?.canParticipate ?? false,
    },
    previewFollower
  );
  const displayAsOwner = preview.displayAsOwner;
  const displayAsFollower = preview.displayAsFollower;
  const canParticipate = preview.canParticipate;

  const displayName = useMemo(() => {
    if (!community) return handle;
    return (
      [community.host.firstName, community.host.lastName].filter(Boolean).join(' ') ||
      (community.host.gofastHandle ? `@${community.host.gofastHandle}` : 'Athlete')
    );
  }, [community, handle]);

  const firstName = community?.host.firstName?.trim() || displayName;
  const updateMessages = useMemo(
    () => community?.messages.filter((m) => m.topic === 'updates') ?? [],
    [community?.messages]
  );
  const latestUpdate = updateMessages[0] ?? null;

  const handleFollow = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.post(`/follow/${encodeURIComponent(handle)}`);
      if (!res.data?.success) throw new Error(res.data?.error || 'Could not follow');
      await loadCommunity();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not follow.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!community?.host.id || displayAsOwner) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.post(`/athlete/${community.host.id}/container/leave`);
      await loadCommunity();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not unfollow.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading hub…</p>
        </div>
      </div>
    );
  }

  if (error && !community) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav showBack backUrl={athletePublicPagePath(handle)} backLabel="Public page" />
        <div className="max-w-lg mx-auto py-10 px-4 space-y-4">
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-gray-700">Community unavailable.</p>
      </div>
    );
  }

  const hasTrainingFor =
    community.trainingFor.trainingSummary != null ||
    community.trainingFor.primaryChasingGoal != null;
  const publicPagePath = athletePublicPagePath(handle);
  const initials = (community.host.firstName?.[0] || community.host.gofastHandle?.[0] || 'A').toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNav showBack backUrl={publicPagePath} backLabel="Public page" />

      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              {community.host.photoURL ? (
                <img
                  src={community.host.photoURL}
                  alt=""
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-gray-200 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white border-2 border-gray-200 flex-shrink-0">
                  <span className="text-lg sm:text-2xl font-bold">{initials}</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-orange-700">
                  GoFast With {firstName}
                </p>
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                  {displayName}
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                  {community.host.gofastHandle ? `@${community.host.gofastHandle} · ` : ''}
                  {community.memberCount} follower{community.memberCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              {previewFollower && community.isOwner ? (
                <Link
                  href={`${publicPagePath}/community`}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Exit preview
                </Link>
              ) : null}
              {displayAsOwner && !previewFollower ? (
                <>
                  <Link
                    href={athleteCommunityPreviewPath(handle)}
                    className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100"
                  >
                    See what followers see
                  </Link>
                  <Link
                    href="/gofast-with-others"
                    className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-100"
                  >
                    Studio
                  </Link>
                </>
              ) : null}
              {!displayAsOwner && displayAsFollower ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                    Following
                  </span>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void handleUnfollow()}
                    className="text-xs text-gray-600 underline disabled:opacity-50"
                  >
                    Unfollow
                  </button>
                </div>
              ) : null}
              {!displayAsOwner && !displayAsFollower ? (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void handleFollow()}
                  className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  Follow {firstName}
                </button>
              ) : null}
            </div>
          </div>

          {previewFollower && community.isOwner ? (
            <p className="mt-3 text-xs font-medium text-orange-800 rounded-lg bg-orange-50 px-3 py-2">
              You&apos;re seeing what followers see — your owner controls are hidden.
            </p>
          ) : null}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-10">
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <AthleteCommunityMobileTabs
          activeTab={activeTab}
          onTabChange={selectTab}
          community={community}
          firstName={firstName}
          displayAsOwner={displayAsOwner}
          canParticipate={canParticipate}
          handle={handle}
          updateMessages={updateMessages}
          hasTrainingFor={hasTrainingFor}
        />

        <div className="hidden lg:grid grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-6 space-y-6 min-w-0">
            {latestUpdate ? (
              <AthleteCommunityLatestUpdateBanner
                update={latestUpdate}
                hostFirstName={firstName}
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
              showHeading
            />
            <AthleteCommunityUpdatesSection
              messages={updateMessages}
              hostFirstName={firstName}
              isOwner={displayAsOwner}
            />
          </div>

          <aside className="lg:col-span-6 space-y-6 min-w-0 lg:sticky lg:top-6 lg:self-start">
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
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">Plan</h2>
                <p className="text-sm text-gray-600 mt-2">
                  {displayAsOwner
                    ? 'Publish your plan in Runs & Training so followers can see your training week here.'
                    : `${firstName} hasn't shared a public plan yet.`}
                </p>
                {displayAsOwner ? (
                  <Link
                    href="/gofast-with-others"
                    className="mt-3 inline-flex text-sm font-semibold text-orange-600 hover:underline"
                  >
                    Open Runs &amp; Training →
                  </Link>
                ) : null}
              </div>
            )}

            <ContainerHubRunsSection
              runs={community.upcomingRuns}
              hostFirstName={firstName}
              isHost={displayAsOwner}
            />

            <AthleteTipsSection
              tips={community.tips}
              hostFirstName={firstName}
              isOwner={displayAsOwner}
              instagramUsername={community.host.instagramUsername}
            />

            <GoFastWithMeFollowersSection
              hub={{
                ...community,
                isHost: displayAsOwner,
              }}
              handle={handle}
              variant="hub"
            />
          </aside>
        </div>

        {!displayAsOwner && !displayAsFollower && !previewFollower ? (
          <section className="mt-6 hidden lg:block rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-orange-100 p-2 text-orange-700">
                <User className="h-4 w-4" />
              </div>
              <p className="text-sm text-gray-700">
                Follow {firstName} to join Chatter and get updates when they post. Following is free —
                it is not training-plan enrollment.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  const athleteId = LocalStorageAPI.getAthleteId();
                  if (!athleteId) {
                    router.push(goFastWithSignupPath(handle));
                    return;
                  }
                  router.push(goFastWithConfirmPath(handle));
                }}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                Follow {firstName}
              </button>
              <Link
                href={publicPagePath}
                className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
              >
                Back to public page
              </Link>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
