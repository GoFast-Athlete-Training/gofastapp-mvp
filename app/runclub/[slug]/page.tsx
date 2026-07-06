'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import TopNav from '@/components/shared/TopNav';
import UpcomingRunsList, { UpcomingRun } from '@/components/runclub/UpcomingRunsList';
import RecentRunsStrip, { RecentRun } from '@/components/runclub/RecentRunsStrip';
import ClubAnnouncementsList, {
  ClubAnnouncement,
} from '@/components/runclub/ClubAnnouncementsList';
import ClubEventsList, { ClubEvent } from '@/components/runclub/ClubEventsList';
import { Globe, Instagram, Route, MapPin, ArrowLeft, Users, UserPlus, UserCheck } from 'lucide-react';

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
  websiteUrl: string | null;
  instagramUrl: string | null;
  stravaUrl: string | null;
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
  recentRuns: RecentRun[];
}

/**
 * Authenticated app club hub — membership, announcements, events, upcoming runs.
 * Not the public SEO discovery page (see gofast-contentpublic ClubPublicDiscoveryView).
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
      fetchClub();
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
          upcomingRuns: res.data.upcomingRuns,
          recentRuns: res.data.recentRuns,
        });
      } else {
        setError('Run club not found');
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
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

  const { club, memberCount, membership, announcements, upcomingEvents, upcomingRuns, recentRuns } =
    data;
  const isMember = membership?.isMember ?? false;
  const locationParts = [club.neighborhood, club.city, club.state].filter(Boolean);
  const locationText = locationParts.join(', ');

  const instagramHandle = club.instagramUrl
    ? club.instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\/?/, '').replace(/\/$/, '')
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />

      {/* Club Banner */}
      <div className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {club.logoUrl ? (
                <div className="bg-white rounded-xl p-2 shadow-lg flex-shrink-0">
                  <img
                    src={club.logoUrl}
                    alt={`${club.name} logo`}
                    className="w-16 h-16 md:w-20 md:h-20 object-contain"
                  />
                </div>
              ) : (
                <div className="bg-white rounded-xl p-2 shadow-lg w-16 h-16 md:w-20 md:h-20 flex items-center justify-center flex-shrink-0">
                  <Route className="w-10 h-10 text-orange-500" />
                </div>
              )}

              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                  {club.name}
                </h1>
                {locationText && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-orange-100 text-sm">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{locationText}</span>
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2 text-orange-100 text-sm">
                  <Users className="w-4 h-4" />
                  <span>
                    {memberCount} member{memberCount === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  {club.websiteUrl && (
                    <a
                      href={
                        club.websiteUrl.startsWith('http')
                          ? club.websiteUrl
                          : `https://${club.websiteUrl}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-orange-100 hover:text-white text-xs transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Website
                    </a>
                  )}
                  {instagramHandle && (
                    <a
                      href={`https://instagram.com/${instagramHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-orange-100 hover:text-white text-xs transition-colors"
                    >
                      <Instagram className="w-3.5 h-3.5" />
                      @{instagramHandle}
                    </a>
                  )}
                  {club.stravaUrl && (
                    <a
                      href={club.stravaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-orange-100 hover:text-white text-xs transition-colors"
                    >
                      <Route className="w-3.5 h-3.5" />
                      Strava
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <button
                onClick={handleJoinToggle}
                disabled={joinLoading}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  isMember
                    ? 'bg-white/15 text-white border border-white/30 hover:bg-white/25'
                    : 'bg-white text-orange-600 hover:bg-orange-50'
                }`}
              >
                {isMember ? (
                  <>
                    <UserCheck className="h-4 w-4" />
                    Joined
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Join Club
                  </>
                )}
              </button>
              <div className="hidden sm:flex items-center gap-2">
                <img
                  src="/logo.jpg"
                  alt="GoFast"
                  className="h-10 w-10 rounded-full object-cover border-2 border-white"
                />
                <span className="text-white font-semibold text-sm">GoFast</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {(club.description || club.allRunsDescription) && (
          <div>
            {club.description && (
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">{club.description}</p>
            )}
            {club.allRunsDescription && club.allRunsDescription !== club.description && (
              <p className="text-gray-500 text-sm mt-2 leading-relaxed whitespace-pre-line">
                {club.allRunsDescription}
              </p>
            )}
          </div>
        )}

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Announcements</h2>
            <p className="text-sm text-gray-500">
              Club updates for members. Join the club to see member-only posts.
            </p>
          </div>
          <ClubAnnouncementsList announcements={announcements} />
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Club Events</h2>
            <p className="text-sm text-gray-500">
              Socials, clinics, and sponsor activations beyond weekly runs.
            </p>
          </div>
          <ClubEventsList events={upcomingEvents} />
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Upcoming Runs</h2>
            <p className="text-sm text-gray-500">
              RSVP to individual runs separately — joining the club does not auto-RSVP you.
            </p>
          </div>
          <UpcomingRunsList runs={upcomingRuns} />
        </section>

        {recentRuns.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Runs</h2>
            <RecentRunsStrip runs={recentRuns} />
          </section>
        )}

        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={() => router.push('/gorun')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Browse all runs
          </button>
        </div>
      </div>
    </div>
  );
}
