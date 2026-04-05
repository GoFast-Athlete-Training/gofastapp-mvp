'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import Link from 'next/link';
import MissingPaceBanner from '@/components/profile/MissingPaceBanner';

const RUNNER_BASE =
  process.env.NEXT_PUBLIC_RUNNER_PHOTO_URL?.replace(/\/$/, '') ||
  'https://runner.gofastcrushgoals.com';

type PublicGoalPayload = {
  trainingSummary: {
    planName: string;
    startDate: string;
    totalWeeks: number;
    raceName: string | null;
  } | null;
  primaryChasingGoal: {
    id: string;
    name: string | null;
    distance: string;
    goalTime: string | null;
    targetByDate: string;
    raceName: string | null;
    raceSlug: string | null;
  } | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [athleteProfile, setAthleteProfile] = useState<Record<string, unknown> | null>(null);
  const [publicExtras, setPublicExtras] = useState<PublicGoalPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = LocalStorageAPI.getAthleteId();
    if (!id) {
      router.replace('/welcome');
      setLoading(false);
      return;
    }
    api
      .get(`/athlete/${id}`)
      .then((res) => {
        if (res.data?.athlete) setAthleteProfile(res.data.athlete);
      })
      .catch(() => router.replace('/welcome'))
      .finally(() => setLoading(false));

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.replace('/signup');
    });

    return () => unsubscribe();
  }, [router]);

  const handle = typeof athleteProfile?.gofastHandle === 'string' ? athleteProfile.gofastHandle : '';

  useEffect(() => {
    if (!handle) {
      setPublicExtras(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/athlete/public/${encodeURIComponent(handle)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setPublicExtras({
          trainingSummary: data.trainingSummary ?? null,
          primaryChasingGoal: data.primaryChasingGoal ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setPublicExtras(null);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!athleteProfile) {
    return (
      <div className="py-12">
        <p className="text-gray-600">Please sign in</p>
      </div>
    );
  }

  const firstName = String(athleteProfile.firstName ?? '');
  const lastName = String(athleteProfile.lastName ?? '');
  const photoURL = athleteProfile.photoURL as string | undefined;
  const myBestRunPhotoURL = athleteProfile.myBestRunPhotoURL as string | undefined;
  const bio = athleteProfile.bio as string | undefined;
  const instagram = athleteProfile.instagram as string | undefined;
  const city = athleteProfile.city as string | undefined;
  const state = athleteProfile.state as string | undefined;
  const primarySport = athleteProfile.primarySport as string | undefined;
  const birthday = athleteProfile.birthday as string | Date | null | undefined;
  const gender = athleteProfile.gender as string | undefined;
  const phoneNumber = athleteProfile.phoneNumber as string | undefined;
  const email = athleteProfile.email as string | undefined;
  const fiveKPace = athleteProfile.fiveKPace as string | undefined;

  const calculateAge = (b: string | Date | null | undefined) => {
    if (!b) return null;
    const birthDate = new Date(b);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(birthday);
  const liveGoFastUrl = handle ? `${RUNNER_BASE}/${handle}` : null;

  const pill = (label: string, done: boolean) => (
    <span
      key={label}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        done ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {done ? '✓ ' : '○ '}
      {label}
    </span>
  );

  return (
    <div className="max-w-4xl">
      <Link
        href="/athlete-home"
        className="inline-block text-sm font-medium text-orange-600 hover:text-orange-700 mb-4"
      >
        ← Home
      </Link>
      <MissingPaceBanner fiveKPace={fiveKPace} />

      {/* Hero */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-10 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex-shrink-0">
          <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center overflow-hidden shadow-md ring-4 ring-orange-50">
            {photoURL ? (
              <img src={photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl sm:text-4xl text-white font-bold">
                {firstName ? firstName[0].toUpperCase() : '👤'}
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
            {firstName && lastName ? `${firstName} ${lastName}` : 'Your profile'}
          </h1>
          <p className="text-gray-600 mt-1">
            @{handle || 'set_handle'} · {city || state ? [city, state].filter(Boolean).join(', ') : 'Add location'}
          </p>
          {fiveKPace?.trim() ? (
            <p className="text-sm text-gray-500 mt-2">
              5K pace: <span className="font-semibold text-gray-800">{fiveKPace.trim()}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={() => router.push('/athlete-edit-profile')}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-orange-600 shadow-sm"
            >
              Edit profile
            </button>
            <button
              type="button"
              onClick={() => router.push('/athlete-edit-profile?tab=about-you')}
              className="border border-orange-200 text-orange-800 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-orange-50"
            >
              Build GoFast Page
            </button>
            {liveGoFastUrl ? (
              <a
                href={liveGoFastUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center border border-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-50"
              >
                View live page
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {/* GoFast Page crosswalk */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-4">
            <div className="flex-shrink-0">
              <div className="w-full sm:w-40 aspect-[21/9] sm:aspect-[4/3] rounded-lg bg-gray-100 overflow-hidden border border-gray-100">
                {myBestRunPhotoURL ? (
                  <img src={myBestRunPhotoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 px-2 text-center">
                    No banner yet
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900">On your GoFast Page</h2>
              <p className="text-sm text-gray-600 mt-1">
                These fields are visible on your public page. Everything under Account below stays in-app unless noted.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {pill('Banner', !!myBestRunPhotoURL)}
                {pill('Bio', !!(bio && bio.trim()))}
                {pill('Sport', !!primarySport)}
                {pill('Instagram', !!(instagram && instagram.trim()))}
                {pill('Location', !!(city || state))}
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => router.push('/profile/gofast-page')}
                  className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                >
                  In-app preview →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Goal / training (public API) */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Goal & training</h2>
          {!publicExtras && handle ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : publicExtras?.trainingSummary ? (
            <div className="text-sm text-gray-700 space-y-1">
              <p className="font-semibold text-gray-900">{publicExtras.trainingSummary.planName}</p>
              <p>
                {publicExtras.trainingSummary.totalWeeks} weeks · started{' '}
                {new Date(publicExtras.trainingSummary.startDate).toLocaleDateString()}
              </p>
              {publicExtras.trainingSummary.raceName ? (
                <p>Race: {publicExtras.trainingSummary.raceName}</p>
              ) : null}
            </div>
          ) : publicExtras?.primaryChasingGoal ? (
            <div className="text-sm text-gray-700 space-y-1">
              <p className="font-semibold text-gray-900">
                {publicExtras.primaryChasingGoal.name || 'Chasing goal'}
              </p>
              <p>
                {publicExtras.primaryChasingGoal.distance}
                {publicExtras.primaryChasingGoal.goalTime
                  ? ` · target ${publicExtras.primaryChasingGoal.goalTime}`
                  : ''}
              </p>
              <p>
                By {new Date(publicExtras.primaryChasingGoal.targetByDate).toLocaleDateString()}
                {publicExtras.primaryChasingGoal.raceName
                  ? ` · ${publicExtras.primaryChasingGoal.raceName}`
                  : ''}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              No active plan or chasing goal yet.{' '}
              <Link href="/goals" className="font-semibold text-orange-600 hover:text-orange-700">
                Set a goal
              </Link>
            </p>
          )}
        </section>

        {/* Account (private) */}
        <section className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Account</h2>
          <p className="text-xs text-gray-500 mb-3">Not shown on your public GoFast Page.</p>
          <dl className="text-sm divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {handle ? (
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-gray-500">Handle</dt>
                <dd className="text-gray-900 font-medium">@{handle}</dd>
              </div>
            ) : null}
            {birthday ? (
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-gray-500">Birthday</dt>
                <dd className="text-gray-900">
                  {new Date(birthday as string).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  {age ? ` (${age})` : ''}
                </dd>
              </div>
            ) : null}
            {gender ? (
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-gray-500">Gender</dt>
                <dd className="text-gray-900 capitalize">{gender}</dd>
              </div>
            ) : null}
            {phoneNumber ? (
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-gray-500">Phone</dt>
                <dd className="text-gray-900">{phoneNumber}</dd>
              </div>
            ) : null}
            {email ? (
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-900 break-all">{email}</dd>
              </div>
            ) : null}
            {(city || state) && (
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-gray-500">City, state</dt>
                <dd className="text-gray-900">{[city, state].filter(Boolean).join(', ')}</dd>
              </div>
            )}
          </dl>
        </section>

        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            onClick={() => router.push('/profile/training')}
            className="text-orange-600 font-semibold hover:text-orange-700"
          >
            Training & pace →
          </button>
        </div>
      </div>
    </div>
  );
}
