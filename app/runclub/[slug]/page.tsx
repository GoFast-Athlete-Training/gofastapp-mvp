'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import TopNav from '@/components/shared/TopNav';
import UpcomingRunsList, { UpcomingRun } from '@/components/runclub/UpcomingRunsList';
import ClubNextRunHero, { type NextRunHeroRun } from '@/components/runclub/ClubNextRunHero';
import ClubRunPhotoFeed, { type RunFeedItem } from '@/components/runclub/ClubRunPhotoFeed';
import ClubAnnouncementsList, {
  ClubAnnouncement,
} from '@/components/runclub/ClubAnnouncementsList';
import ClubEventsList, { ClubEvent } from '@/components/runclub/ClubEventsList';
import { Route, MapPin, ArrowLeft, UserPlus, UserCheck } from 'lucide-react';

interface RunClub {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  description: string | null;
  allRunsDescription: string | null;
}

interface MembershipState {
  isMember: boolean;
  role: string | null;
  status: string | null;
  joinedAt: string | null;
}

interface ContainerData {
  club: RunClub;
  memberCount: number;
  membership: MembershipState | null;
  announcements: ClubAnnouncement[];
  upcomingEvents: ClubEvent[];
  upcomingRuns: UpcomingRun[];
  runFeed: RunFeedItem[];
}

/**
 * Authenticated app club hub — next run, photo feed, secondary club programming.
 */
export default function AuthenticatedRunClubHubPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [data, setData] = useState<ContainerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user) {
        router.replace(`/signup?redirect=/runclub/${slug}`);
        return;
      }
      void fetchClub();
    });
  }, [slug]);

  const fetchClub = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/runclub/${slug}`);
      if (res.data.success) {
        setData({
          club: res.data.club,
          memberCount: res.data.memberCount ?? 0,
          membership: res.data.membership ?? null,
          announcements: res.data.announcements ?? [],
          upcomingEvents: res.data.upcomingEvents ?? [],
          upcomingRuns: res.data.upcomingRuns ?? [],
          runFeed: res.data.runFeed ?? [],
        });
      } else {
        setError('Run club not found');
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setError('Run club not found');
      } else {
        setError('Failed to load run club');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinToggle = async () => {
    if (!data) return;

    try {
      setJoinLoading(true);
      const isMember = data.membership?.isMember ?? false;
      const endpoint = isMember ? `/runclub/${slug}/leave` : `/runclub/${slug}/join`;
      const res = await api.post(endpoint);

      if (res.data.success) {
        await fetchClub();
      }
    } catch (err) {
      console.error('Failed to update club membership:', err);
    } finally {
      setJoinLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <div className="max-w-2xl mx-auto px-6 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{error ?? 'Run club not found'}</h1>
          <button
            onClick={() => router.push('/gorun')}
            className="text-orange-500 hover:text-orange-600 font-semibold"
          >
            ← Browse runs
          </button>
        </div>
      </div>
    );
  }

  const { club, membership, announcements, upcomingEvents, upcomingRuns, runFeed } = data;
  const isMember = membership?.isMember ?? false;
  const locationParts = [club.neighborhood, club.city, club.state].filter(Boolean);
  const locationText = locationParts.join(', ');

  const nextRun: NextRunHeroRun | null = upcomingRuns[0]
    ? { ...upcomingRuns[0], goingAthletes: upcomingRuns[0].goingAthletes ?? [] }
    : null;

  const moreUpcoming = upcomingRuns.slice(1);
  const hasSecondary =
    moreUpcoming.length > 0 || announcements.length > 0 || upcomingEvents.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />

      {/* Compact club chrome */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {club.logoUrl ? (
                <img
                  src={club.logoUrl}
                  alt=""
                  className="h-11 w-11 rounded-xl object-contain bg-gray-50 ring-1 ring-gray-100"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100">
                  <Route className="h-5 w-5 text-orange-600" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-gray-900">{club.name}</h1>
                {locationText ? (
                  <p className="flex items-center gap-1 text-xs text-gray-500 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {locationText}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              onClick={() => void handleJoinToggle()}
              disabled={joinLoading}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                isMember
                  ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {isMember ? (
                <>
                  <UserCheck className="h-3.5 w-3.5" />
                  Joined
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" />
                  Join
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <ClubNextRunHero run={nextRun} onRsvpChange={() => void fetchClub()} />

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
            From recent runs
          </h2>
          <ClubRunPhotoFeed items={runFeed} />
        </section>

        {hasSecondary ? (
          <div className="space-y-8 border-t border-gray-200 pt-8">
            {moreUpcoming.length > 0 ? (
              <section>
                <h2 className="mb-3 text-base font-bold text-gray-900">More upcoming</h2>
                <UpcomingRunsList runs={moreUpcoming} onRsvpChange={() => void fetchClub()} />
              </section>
            ) : null}

            {announcements.length > 0 ? (
              <section>
                <h2 className="mb-3 text-base font-bold text-gray-900">Announcements</h2>
                <ClubAnnouncementsList announcements={announcements} />
              </section>
            ) : null}

            {upcomingEvents.length > 0 ? (
              <section>
                <h2 className="mb-3 text-base font-bold text-gray-900">Club events</h2>
                <ClubEventsList events={upcomingEvents} />
              </section>
            ) : null}
          </div>
        ) : null}

        <button
          onClick={() => router.push('/gorun')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Browse all runs
        </button>
      </div>
    </div>
  );
}
