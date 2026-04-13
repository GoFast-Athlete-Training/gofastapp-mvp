'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import TopNav from '@/components/shared/TopNav';
import UpcomingRunsList, { UpcomingRun } from '@/components/runclub/UpcomingRunsList';
import RecentRunsStrip, { RecentRun } from '@/components/runclub/RecentRunsStrip';
import { Globe, Instagram, Route, MapPin, ArrowLeft } from 'lucide-react';

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

interface ContainerData {
  club: RunClub;
  upcomingRuns: UpcomingRun[];
  recentRuns: RecentRun[];
}

export default function RunClubContainerPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [data, setData] = useState<ContainerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user) {
        // Redirect unauthenticated users to sign in, preserving destination
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

  const { club, upcomingRuns, recentRuns } = data;
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo */}
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

              {/* Name + location */}
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                  {club.name}
                </h1>
                {locationText && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-orange-100 text-sm">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{locationText}</span>
                  </div>
                )}
                {/* Social links */}
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  {club.websiteUrl && (
                    <a
                      href={club.websiteUrl.startsWith('http') ? club.websiteUrl : `https://${club.websiteUrl}`}
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

            {/* GoFast branding */}
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

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

        {/* About */}
        {(club.description || club.allRunsDescription) && (
          <div>
            {club.description && (
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                {club.description}
              </p>
            )}
            {club.allRunsDescription && club.allRunsDescription !== club.description && (
              <p className="text-gray-500 text-sm mt-2 leading-relaxed whitespace-pre-line">
                {club.allRunsDescription}
              </p>
            )}
          </div>
        )}

        {/* Upcoming Runs */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Upcoming Runs</h2>
          <UpcomingRunsList runs={upcomingRuns} />
        </section>

        {/* Recent Runs */}
        {recentRuns.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Runs</h2>
            <RecentRunsStrip runs={recentRuns} />
          </section>
        )}

        {/* Back link */}
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
