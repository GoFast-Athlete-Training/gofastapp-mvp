'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';

export default function ClubOwnerEntryPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    LocalStorageAPI.setClubOwnerMode(true);

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setChecking(false);
        return;
      }

      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        router.replace('/signup?mode=club-owner');
        return;
      }

      try {
        const prof = await api.get(`/athlete/${athleteId}`);
        const athlete = prof.data?.athlete;
        if (!athlete?.gofastHandle) {
          router.replace('/athlete-create-profile');
          return;
        }
        router.replace('/welcome-club-owner');
      } catch {
        router.replace('/signup?mode=club-owner');
      }
    });

    return () => unsub();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Run club manager</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Manage your run club on GoFast</h1>
        <p className="mt-3 text-sm text-gray-600">
          Sign up or sign in with the email GoFast has on file for your club. After your athlete profile is
          ready, we&apos;ll connect you to your club manager tools.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/signup?mode=club-owner"
            className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Get started
          </Link>
          <Link
            href="/signup?mode=club-owner"
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            I already have an account — sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
