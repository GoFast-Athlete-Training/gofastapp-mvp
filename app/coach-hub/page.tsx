'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import CoachTopNav from '@/components/coach/CoachTopNav';

export default function CoachHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [coachName, setCoachName] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/coach-signup');
        return;
      }
      try {
        const token = await user.getIdToken();
        localStorage.setItem('firebaseToken', token);
        const res = await api.get('/coach/me');
        if (!res.data?.success || !res.data?.coachId) {
          router.replace('/coach-signup');
          return;
        }
        LocalStorageAPI.setCoachId(res.data.coachId);
        const c = res.data.coach as {
          firstName?: string | null;
          lastName?: string | null;
        };
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
        setCoachName(name || user.displayName || null);
      } catch {
        router.replace('/coach-signup');
        return;
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p>Loading coach hub…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-500 to-orange-700">
      <CoachTopNav />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {coachName ? `Welcome, ${coachName}` : 'Coach hub'}
          </h1>
          <p className="text-white/90 text-lg max-w-2xl mx-auto">
            Manage your training groups and assign workouts for athletes preparing for their race.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Link
            href="/coach-hub/profile"
            className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow block text-left"
          >
            <div className="text-4xl mb-4 text-center">👤</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Your profile</h2>
            <p className="text-gray-600 text-center">
              Update your name, bio, specialty, and location
            </p>
          </Link>

          <Link
            href="/coach-hub/groups"
            className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow block text-left"
          >
            <div className="text-4xl mb-4 text-center">🏃</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Training groups</h2>
            <p className="text-gray-600 text-center">
              Groups you coach for race training — members and upcoming workouts
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
