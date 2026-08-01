'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import type { AthleteCommunityPayload } from '@/lib/gofast-with-me/container-hub-service';
import {
  athleteCommunityPreviewPath,
  athletePublicPagePath,
  goFastWithConfirmPath,
  goFastWithSignupPath,
} from '@/lib/gofast-with-me/athlete-community-routes';
import { applyFollowerPreviewMode } from '@/lib/gofast-with-me/athlete-community-access';
import AthleteCommunitySectionNav, {
  parseAthleteCommunitySection,
} from '@/components/gofast-with-me/AthleteCommunitySectionNav';
import GoFastWithMeTrainingForCard from '@/components/gofast-with-me/GoFastWithMeTrainingForCard';
import GoFastWithMePlanStripSection from '@/components/gofast-with-me/GoFastWithMePlanStripSection';
import ContainerHubRunsSection from '@/components/gofast-with-me/ContainerHubRunsSection';
import GoFastWithMeHubFeed from '@/components/gofast-with-me/GoFastWithMeHubFeed';
import GoFastWithMeFollowersSection from '@/components/gofast-with-me/GoFastWithMeFollowersSection';

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
  const [activeSection, setActiveSection] = useState(
    parseAthleteCommunitySection(typeof window !== 'undefined' ? window.location.hash : '')
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
      setActiveSection(parseAthleteCommunitySection(window.location.hash));
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const scrollToSection = (section: NonNullable<ReturnType<typeof parseAthleteCommunitySection>>) => {
    setActiveSection(section);
    window.history.replaceState(null, '', `#${section}`);
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error && !community) {
    return (
      <div className="max-w-lg mx-auto py-10 space-y-4">
        <Link href={athletePublicPagePath(handle)} className="text-sm font-medium text-orange-600 hover:text-orange-700">
          ← Public page
        </Link>
        <p className="text-gray-700">{error}</p>
      </div>
    );
  }

  if (!community) {
    return <p className="text-gray-700">Community unavailable.</p>;
  }

  const hasTrainingFor =
    community.trainingFor.trainingSummary != null ||
    community.trainingFor.primaryChasingGoal != null;

  return (
    <div className="max-w-2xl mx-auto pb-24 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={athletePublicPagePath(handle)}
          className="text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          ← Public page
        </Link>
        {displayAsOwner ? (
          <div className="flex flex-wrap gap-2">
            {previewFollower ? null : (
              <>
                <Link
                  href={athleteCommunityPreviewPath(handle)}
                  className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-100"
                >
                  Preview follower view
                </Link>
                <Link
                  href="/gofast-with-others"
                  className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
                >
                  Manage in studio
                </Link>
              </>
            )}
            {previewFollower ? (
              <Link
                href={`${athletePublicPagePath(handle)}/community`}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              >
                Exit preview
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <header className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">
            GoFast With {firstName} · Community
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{displayName}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {community.memberCount} follower{community.memberCount === 1 ? '' : 's'}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Follow along for free — see their training, updates, and joinable GoRuns. Following is
            not training-plan enrollment.
          </p>
        </div>

        {hasTrainingFor ? (
          <GoFastWithMeTrainingForCard
            trainingSummary={community.trainingFor.trainingSummary}
            primaryChasingGoal={community.trainingFor.primaryChasingGoal}
          />
        ) : null}

        {previewFollower && community.isOwner ? (
          <p className="text-xs font-medium text-orange-800 rounded-lg bg-white/70 px-3 py-2">
            Previewing what followers see — owner controls hidden.
          </p>
        ) : displayAsOwner ? (
          <p className="text-sm font-semibold text-orange-800">You own this community</p>
        ) : displayAsFollower ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-emerald-800 font-medium">Following</span>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => void handleUnfollow()}
              className="text-sm text-gray-600 underline disabled:opacity-50"
            >
              Unfollow
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => void handleFollow()}
            className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            Follow {firstName}
          </button>
        )}
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <AthleteCommunitySectionNav
        activeSection={activeSection}
        onSectionChange={scrollToSection}
      />

      <div className="space-y-10">
        <section id="plan">
          {community.publishedPlan ? (
            <GoFastWithMePlanStripSection
              publishedPlan={community.publishedPlan}
              hostFirstName={firstName}
              isHost={displayAsOwner}
            />
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Plan</h2>
              <p className="text-sm text-gray-600 mt-2">
                {displayAsOwner
                  ? 'Publish your plan in My Workouts so followers can see your training week here.'
                  : `${firstName} hasn't shared a public plan yet.`}
              </p>
              {displayAsOwner ? (
                <Link
                  href="/gofast-with-others"
                  className="mt-3 inline-flex text-sm font-semibold text-orange-600 hover:underline"
                >
                  Open My Workouts →
                </Link>
              ) : null}
            </div>
          )}
        </section>

        <section id="updates" className="space-y-3">
          <div className="px-1">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Updates</h2>
            <p className="text-xs text-gray-500 mt-1">
              Journey announcements from {firstName} — race prep, milestones, what&apos;s next.
            </p>
          </div>
          {updateMessages.length > 0 ? (
            <ul className="space-y-2">
              {updateMessages.map((m) => (
                <li key={m.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                  <p className="text-gray-800 whitespace-pre-wrap">{m.body}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
              No updates yet.
            </p>
          )}
          {displayAsOwner ? (
            <Link
              href="/gofast-with-others"
              className="inline-flex text-xs font-semibold text-orange-600 hover:underline"
            >
              Post updates from My Community in studio →
            </Link>
          ) : null}
        </section>

        <ContainerHubRunsSection
            runs={community.upcomingRuns}
            hostFirstName={firstName}
            isHost={displayAsOwner}
          />

        <div id="chatter">
          <GoFastWithMeHubFeed
            hostId={community.host.id}
            isHost={displayAsOwner}
            canAccessFeed={canParticipate}
            upcomingRuns={community.upcomingRuns}
            publishedPlan={community.publishedPlan}
            initialMessages={community.messages.filter((m) => m.topic === 'chatter')}
            chatterMode
          />
        </div>

        <GoFastWithMeFollowersSection
          hub={{
            ...community,
            isHost: displayAsOwner,
          }}
          handle={handle}
        />
      </div>

      {!displayAsOwner && !displayAsFollower && !previewFollower ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <p className="text-sm text-gray-700">
            Follow {firstName} to join Chatter and get updates when they post.
          </p>
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
              href={athletePublicPagePath(handle)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
            >
              Back to public page
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
