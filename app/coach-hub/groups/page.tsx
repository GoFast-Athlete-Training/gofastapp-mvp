'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import CoachTopNav from '@/components/coach/CoachTopNav';

type GroupRow = {
  membershipId: string;
  role: string;
  joinedAt: string;
  group: {
    id: string;
    name: string;
    handle: string;
    description: string | null;
    city: string | null;
    state: string | null;
    isActive: boolean;
    memberCount: number;
    race: { id: string; name: string; raceDate: string | null } | null;
  };
};

export default function CoachGroupsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/coach-signup');
        return;
      }
      try {
        const token = await user.getIdToken();
        localStorage.setItem('firebaseToken', token);
        const me = await api.get('/coach/me');
        if (!me.data?.success) {
          router.replace('/coach-signup');
          return;
        }
        LocalStorageAPI.setCoachId(me.data.coachId);
        const res = await api.get('/coach/groups');
        if (res.data?.success && Array.isArray(res.data.groups)) {
          setGroups(res.data.groups as GroupRow[]);
        }
      } catch {
        setError('Could not load groups.');
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-500 to-orange-700">
      <CoachTopNav />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-white mb-2">Training groups</h1>
        <p className="text-white/85 mb-8">
          Race training groups where you are assigned as coach. Assign workouts for athletes in
          each group from here (coming next).
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-400/50 rounded-lg p-4 text-white mb-6">
            {error}
          </div>
        )}

        {groups.length === 0 ? (
          <div className="bg-white/95 rounded-xl p-8 text-center text-gray-700">
            <p className="mb-2">You are not a coach on any training group yet.</p>
            <p className="text-sm text-gray-500">
              When you are added as a coach on a race training group, it will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {groups.map((row) => (
              <li
                key={row.membershipId}
                className="bg-white rounded-xl shadow-lg p-6 border border-amber-100"
              >
                <h2 className="text-xl font-bold text-gray-900">{row.group.name}</h2>
                {row.group.race && (
                  <p className="text-amber-800 font-medium mt-1">{row.group.race.name}</p>
                )}
                {row.group.race?.raceDate && (
                  <p className="text-sm text-gray-600">
                    Race date:{' '}
                    {new Date(row.group.race.raceDate).toLocaleDateString(undefined, {
                      dateStyle: 'medium',
                    })}
                  </p>
                )}
                <p className="text-sm text-gray-600 mt-2">
                  {row.group.memberCount} member{row.group.memberCount === 1 ? '' : 's'}
                  {row.group.city || row.group.state
                    ? ` · ${[row.group.city, row.group.state].filter(Boolean).join(', ')}`
                    : ''}
                </p>
                {row.group.description && (
                  <p className="text-gray-700 mt-3 text-sm">{row.group.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
