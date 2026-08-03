'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import ClubManagerShell from '@/components/runclub/manager/ClubManagerShell';
import ClubProfileSetupCard from '@/components/runclub/manager/ClubProfileSetupCard';
import ClubRunsSetupCard from '@/components/runclub/manager/ClubRunsSetupCard';
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

  return (
    <ClubManagerShell
      clubName={club.name}
      clubSlug={slug}
      logoUrl={club.logoUrl}
      active="overview"
    >
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">Club Manager</p>
        <h2 className="text-2xl font-bold text-gray-900 mt-1">Get your club ready for members</h2>
        <p className="text-sm text-gray-600 mt-2 max-w-2xl">
          Start with club profile and weekly runs. Announcements come after the basics are in place.
        </p>
      </div>

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
        <ClubProfileSetupCard
          coreComplete={setup?.coreComplete ?? false}
          socialsComplete={setup?.socialsComplete ?? false}
          href={clubManagerClubPath(slug, 'content')}
        />
        <ClubRunsSetupCard
          hasSeries={setup?.hasSeries ?? false}
          hasUpcomingRuns={setup?.hasUpcomingRuns ?? false}
          runsNeedReview={setup?.runsNeedReview ?? 0}
          href={clubManagerClubPath(slug, 'runs')}
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
