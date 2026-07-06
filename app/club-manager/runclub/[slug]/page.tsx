'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import ClubManagerShell from '@/components/runclub/manager/ClubManagerShell';
import ManagerWizardCard from '@/components/runclub/leader/ManagerWizardCard';
import type { SetupCompleteness } from '@/lib/run-club-leader-setup';
import { clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';

interface DashboardData {
  club: {
    id: string;
    slug: string;
    name: string;
    city: string | null;
    description: string | null;
    allRunsDescription: string | null;
    logoUrl: string | null;
  };
  writeScope: {
    runClubId: string;
    runClubSlug: string | null;
    membershipRole: string;
  };
  setup: SetupCompleteness | null;
  memberCount: number;
  series: Array<{ id: string; name: string; dayOfWeek: string; workflowStatus: string }>;
  upcomingRuns: Array<{
    id: string;
    title: string;
    date: string;
    workflowStatus: string;
    rsvpCount: number;
  }>;
  announcementsSummary: {
    count: number;
    latest: { id: string; title: string | null; body: string; publishedAt: string } | null;
  };
  invites: {
    enabled: boolean;
    label: string;
    description: string;
  };
  membership: { role: string };
}

export default function ClubManagerOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/runclub/${slug}/leader`);
      if (res.data?.success) {
        setData(res.data);
      } else {
        setError('Could not load club dashboard');
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setError('You need owner or admin access to manage this club.');
      } else if (status === 404) {
        setError('Run club not found');
      } else {
        setError('Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace(
          `/signup?mode=club-manager&redirect=${encodeURIComponent(clubManagerClubPath(slug))}`
        );
        return;
      }
      load();
    });
    return () => unsub();
  }, [slug, router, load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error || !data?.club) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">{error ?? 'Error'}</h1>
          <button
            type="button"
            onClick={() => router.push(clubManagerHubPath())}
            className="text-orange-600 font-semibold hover:underline"
          >
            Back to Club Manager
          </button>
        </div>
      </div>
    );
  }

  const { club, setup, memberCount, series, upcomingRuns, announcementsSummary, invites } = data;
  const base = clubManagerClubPath(slug);

  const metaStatus = setup?.metaComplete
    ? 'Complete'
    : setup?.metaMissing.length
      ? `${setup.metaMissing.length} to fix`
      : 'Needs review';
  const metaTone = setup?.metaComplete ? 'complete' : 'attention';

  const runsStatus =
    setup?.hasSeries && setup?.hasUpcomingRuns
      ? setup.runsNeedReview > 0
        ? `${setup.runsNeedReview} need review`
        : 'Scheduled'
      : !setup?.hasSeries
        ? 'Add series'
        : 'Add runs';
  const runsTone =
    setup?.hasSeries && setup?.hasUpcomingRuns && setup.runsNeedReview === 0
      ? 'complete'
      : 'attention';

  return (
    <ClubManagerShell clubName={club.name} clubSlug={slug} active="overview">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">Club Manager</p>
        <h2 className="text-2xl font-bold text-gray-900 mt-1">Get your club ready for members</h2>
        <p className="text-sm text-gray-600 mt-2 max-w-2xl">
          Start with club profile and weekly runs. Announcements come after the basics are in place.
        </p>
      </div>

      {setup && !setup.readyForMembers ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">Setup in progress.</span>{' '}
          {setup.metaMissing.length > 0 ? `Still missing: ${setup.metaMissing.join(', ')}.` : null}
          {!setup.hasSeries ? ' Add at least one weekly series.' : null}
          {setup.hasSeries && !setup.hasUpcomingRuns ? ' Schedule upcoming runs.' : null}
        </div>
      ) : setup?.readyForMembers ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span className="font-semibold">Looking good.</span> Core club setup is complete — keep
          runs and announcements fresh.
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Members</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{memberCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Weekly series</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{series.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Upcoming runs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{upcomingRuns.length}</p>
        </div>
      </div>

      <div className="space-y-4 mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500">MVP1 — do first</p>
        <ManagerWizardCard
          priority="primary"
          title="Club profile"
          description="Description, all-runs blurb, logo, and social links — how members discover your club."
          href={clubManagerClubPath(slug, 'content')}
          statusLabel={metaStatus}
          statusTone={metaTone}
          detail={
            setup?.metaMissing.length
              ? `Missing: ${setup.metaMissing.slice(0, 3).join(', ')}${setup.metaMissing.length > 3 ? '…' : ''}`
              : club.description
                ? 'Profile copy is in place.'
                : undefined
          }
        />
        <ManagerWizardCard
          priority="primary"
          title="Runs"
          description="Weekly series and upcoming run instances — submit changes for GoFast review when ready."
          href={clubManagerClubPath(slug, 'runs')}
          statusLabel={runsStatus}
          statusTone={runsTone}
          detail={
            series.length > 0
              ? `${series.length} series · ${upcomingRuns.length} upcoming run${upcomingRuns.length === 1 ? '' : 's'}`
              : 'No series linked yet.'
          }
        />
      </div>

      <div className="space-y-4 mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400">Secondary</p>
        <ManagerWizardCard
          priority="secondary"
          title="Announcements"
          description="Post updates for members who follow your club in GoFast."
          href={clubManagerClubPath(slug, 'announcements')}
          statusLabel={
            announcementsSummary.count > 0 ? `${announcementsSummary.count} posted` : 'None yet'
          }
          statusTone="neutral"
          detail={
            announcementsSummary.latest
              ? `Latest: ${announcementsSummary.latest.title ?? announcementsSummary.latest.body.slice(0, 60)}…`
              : 'Share news after profile and runs are set.'
          }
        />
      </div>

      <div className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400">Coming later</p>
        <ManagerWizardCard
          priority="future"
          title={invites.label}
          description={invites.description}
          statusLabel="MVP2"
          statusTone="future"
          disabled={!invites.enabled}
        />
      </div>
    </ClubManagerShell>
  );
}
