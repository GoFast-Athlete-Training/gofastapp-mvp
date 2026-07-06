'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import type { LeaderContextClub } from '@/lib/run-club-leader-context';
import { clubManagerClubPath, clubManagerHubPath } from '@/lib/club-manager-paths';

export default function ClubManagerHubPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [clubs, setClubs] = useState<LeaderContextClub[]>([]);
  const [isManagerPersona, setIsManagerPersona] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace(`/signup?mode=club-manager&redirect=${encodeURIComponent(clubManagerHubPath())}`);
        return;
      }

      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        router.replace('/welcome');
        return;
      }

      try {
        const profileRes = await api.get(`/athlete/${athleteId}`);
        const athlete = profileRes.data?.athlete;
        setIsManagerPersona(
          athlete?.role === 'CLUB_LEADER' || athlete?.leaderContext?.isClubLeader
        );
        setClubs(athlete?.leaderContext?.clubs ?? []);
      } catch {
        setClubs([]);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white text-lg">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600">
      <TopNav />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">Club Manager</h1>
          <p className="text-white/90 text-lg max-w-xl mx-auto">
            Manage clubs where you&apos;re an owner or admin. You&apos;re still a full GoFast athlete
            — switch back to training anytime.
          </p>
        </div>

        {clubs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">No clubs to manage yet</h2>
            <p className="text-gray-600 mb-6">
              {isManagerPersona
                ? 'Your manager access is ready, but GoFast still needs to connect your club. Ask staff to send a manager activation link or grant owner/admin membership.'
                : 'Ask GoFast staff for a manager activation link, or open the invite you received by email.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/gorun"
                className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Browse runs
              </Link>
              <Link
                href="/athlete-home"
                className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold"
              >
                Athlete home
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {clubs.map((club) => (
              <Link
                key={club.runClubId}
                href={clubManagerClubPath(club.runClubSlug ?? club.runClubId)}
                className="block bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center gap-4">
                  {club.logoUrl ? (
                    <img
                      src={club.logoUrl}
                      alt=""
                      className="w-14 h-14 rounded-lg object-contain bg-gray-50"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-orange-100 flex items-center justify-center text-2xl">
                      🏃
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-gray-900 truncate">{club.runClubName}</h2>
                    <p className="text-sm text-gray-500">
                      {[club.city, club.state].filter(Boolean).join(', ') || 'Location TBD'} ·{' '}
                      <span className="capitalize">{club.role}</span>
                    </p>
                  </div>
                  <span className="text-orange-600 font-semibold text-sm shrink-0">Manage →</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/runcrew/create"
            className="bg-white/15 backdrop-blur border border-white/25 rounded-xl p-5 text-white hover:bg-white/20 transition"
          >
            <p className="font-bold text-lg mb-1">Start a run crew</p>
            <p className="text-sm text-white/80">Build a smaller community inside GoFast</p>
          </Link>
          <Link
            href="/athlete-home"
            className="bg-white/15 backdrop-blur border border-white/25 rounded-xl p-5 text-white hover:bg-white/20 transition"
          >
            <p className="font-bold text-lg mb-1">Back to athlete mode</p>
            <p className="text-sm text-white/80">Training, goals, and your personal runs</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
