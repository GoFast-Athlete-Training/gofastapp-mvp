'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import AthleteAppShell from '@/components/athlete/AthleteAppShell';
import GoFastWithMeTrainingForCard from '@/components/gofast-with-me/GoFastWithMeTrainingForCard';
import GoFastWithMePlanStripSection from '@/components/gofast-with-me/GoFastWithMePlanStripSection';
import GoFastWithMeHubMessagesSection from '@/components/gofast-with-me/GoFastWithMeHubMessagesSection';
import GoFastWithMeThinkingSection from '@/components/gofast-with-me/GoFastWithMeThinkingSection';
import GoFastWithMeFollowersSection from '@/components/gofast-with-me/GoFastWithMeFollowersSection';
import GoFastWithMeMyRunsV2Section from '@/components/gofast-with-me/GoFastWithMeMyRunsV2Section';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';

export default function ContainerHubPage() {
  const router = useRouter();
  const params = useParams();
  const handle = (params?.handle as string)?.trim() || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hub, setHub] = useState<ContainerHubPayload | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const myId = LocalStorageAPI.getAthleteId();

  const loadHub = useCallback(async (hid: string) => {
    const res = await api.get(`/athlete/${hid}/container/hub`);
    if (res.data?.success && res.data.hub) {
      setHub(res.data.hub as ContainerHubPayload);
    } else {
      throw new Error(res.data?.error || 'Hub unavailable');
    }
  }, []);

  useEffect(() => {
    if (!handle) {
      setError('Missing handle');
      setLoading(false);
      return;
    }
    if (!myId) {
      LocalStorageAPI.setGwmFollowIntentHandle(handle);
      router.replace(`/gofast-with/${encodeURIComponent(handle)}`);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const pubRes = await fetch(`/api/athlete/public/${encodeURIComponent(handle)}`);
        const pub = (await pubRes.json()) as {
          success?: boolean;
          error?: string;
          hostAthleteId?: string;
          isGoFastContainer?: boolean;
        };
        if (!pubRes.ok || !pub.success || !pub.hostAthleteId) {
          if (!cancelled) setError(pub.error || 'Page not found');
          return;
        }
        if (!pub.isGoFastContainer) {
          if (!cancelled) setError('This athlete has not opened GoFast With Me yet.');
          return;
        }
        if (!cancelled) setHostId(pub.hostAthleteId);
        await loadHub(pub.hostAthleteId);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handle, myId, router, loadHub]);

  const handleFollow = async () => {
    if (!handle) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.post(`/follow/${encodeURIComponent(handle)}`);
      if (!res.data?.success) throw new Error(res.data?.error || 'Could not follow');
      if (hostId) await loadHub(hostId);
      else router.refresh();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setError(e.response?.data?.error || e.message || 'Could not follow.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!hostId || hub?.isHost) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.post(`/athlete/${hostId}/container/leave`);
      setHub((prev) =>
        prev
          ? {
              ...prev,
              isMember: false,
              canAccessFeed: false,
              messages: [],
            }
          : prev
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not unfollow.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AthleteAppShell>
        <div className="flex min-h-[40vh] items-center justify-center px-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
        </div>
      </AthleteAppShell>
    );
  }

  if (error && !hub) {
    return (
      <AthleteAppShell>
        <div className="max-w-lg mx-auto px-4 py-10">
          <Link href="/athlete-home" className="text-sm font-medium text-orange-600 hover:text-orange-700">
            ← Home
          </Link>
          <p className="mt-6 text-gray-700">{error || 'Not available'}</p>
          <Link href={`/gofast-with/${encodeURIComponent(handle)}`} className="mt-4 inline-block text-orange-600 font-semibold">
            Follow {handle}
          </Link>
        </div>
      </AthleteAppShell>
    );
  }

  if (!hub || !hostId) {
    return (
      <AthleteAppShell>
        <div className="max-w-lg mx-auto px-4 py-10">
          <p className="text-gray-700">Hub unavailable.</p>
        </div>
      </AthleteAppShell>
    );
  }

  const displayName =
    [hub.host.firstName, hub.host.lastName].filter(Boolean).join(' ') ||
    (hub.host.gofastHandle ? `@${hub.host.gofastHandle}` : 'Athlete');
  const firstName = hub.host.firstName?.trim() || displayName;
  const hasTrainingFor =
    hub.trainingFor.trainingSummary != null || hub.trainingFor.primaryChasingGoal != null;

  return (
    <AthleteAppShell>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">
        <Link href="/athlete-home" className="text-sm font-medium text-orange-600 hover:text-orange-700">
          ← Home
        </Link>

        <header className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">
              GoFast With Me
            </p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{displayName}</h1>
            <p className="text-sm text-gray-600 mt-1">@{handle}</p>
            <p className="text-sm text-gray-600 mt-2">
              {hub.memberCount} follower{hub.memberCount === 1 ? '' : 's'}
            </p>
          </div>

          {hasTrainingFor ? (
            <GoFastWithMeTrainingForCard
              trainingSummary={hub.trainingFor.trainingSummary}
              primaryChasingGoal={hub.trainingFor.primaryChasingGoal}
            />
          ) : (
            <p className="text-sm text-gray-600 rounded-xl border border-orange-100 bg-white/60 px-4 py-3">
              {hub.isHost
                ? 'Set a goal race or chasing goal so followers know what you are training for.'
                : `${firstName} has not surfaced a training goal yet.`}
            </p>
          )}

          {hub.isHost ? (
            <p className="text-sm font-semibold text-orange-800">You are the host</p>
          ) : hub.canAccessFeed ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-emerald-800 font-medium">Following</span>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void handleLeave()}
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

        {hub.canAccessFeed ? (
          <div className="space-y-8">
            {hub.publishedPlan ? (
              <GoFastWithMePlanStripSection
                publishedPlan={hub.publishedPlan}
                hostFirstName={firstName}
                isHost={hub.isHost}
              />
            ) : hub.isHost ? (
              <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-5">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Plan strip
                </h2>
                <p className="text-sm text-gray-600 mt-2">
                  Surface your GoFast plan so followers see your training week here.
                </p>
                <Link
                  href="/gofast-with-others"
                  className="mt-3 inline-flex text-sm font-semibold text-orange-600 hover:underline"
                >
                  Open GoFast With Me studio → Surface my plan
                </Link>
              </section>
            ) : (
              <section className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <p className="text-sm text-gray-600">
                  {firstName} has not surfaced a public plan yet.
                </p>
              </section>
            )}

            <GoFastWithMeHubMessagesSection
              hostId={hostId}
              isHost={hub.isHost}
              canAccessFeed={hub.canAccessFeed}
              hub={hub}
            />

            <GoFastWithMeThinkingSection
              memberCount={hub.memberCount}
              isHost={hub.isHost}
            />

            <GoFastWithMeFollowersSection hub={hub} handle={handle} />

            <GoFastWithMeMyRunsV2Section runs={hub.upcomingRuns} isHost={hub.isHost} />
          </div>
        ) : (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
            <p className="text-sm text-gray-700">
              Follow {firstName} to see their plan strip, journey messages, and train alongside them.
            </p>
            <Link
              href={`/u/${encodeURIComponent(handle)}`}
              className="inline-flex text-sm font-semibold text-orange-600 hover:underline"
            >
              View public door →
            </Link>
            <Link
              href={`/gofast-with/${encodeURIComponent(handle)}`}
              className="inline-flex rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Follow {firstName}
            </Link>
          </section>
        )}
      </div>
    </AthleteAppShell>
  );
}
