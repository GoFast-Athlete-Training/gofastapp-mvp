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

export default function ProfilePage() {
  const router = useRouter();
  const [athleteProfile, setAthleteProfile] = useState<any>(null);
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

  const calculateAge = (birthday: string | Date | null) => {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(athleteProfile.birthday);

  const hasPublicBits =
    !!(athleteProfile?.bio ||
    athleteProfile?.instagram ||
    athleteProfile?.city ||
    athleteProfile?.state ||
    athleteProfile?.primarySport);

  const liveGoFastUrl = athleteProfile?.gofastHandle
    ? `${RUNNER_BASE}/${athleteProfile.gofastHandle}`
    : null;

  const hasAccountBits = !!(
    athleteProfile?.gofastHandle ||
    athleteProfile?.birthday ||
    athleteProfile?.gender ||
    athleteProfile?.phoneNumber ||
    athleteProfile?.email
  );

  return (
    <div className="max-w-4xl">
      <Link
        href="/athlete-home"
        className="inline-block text-sm font-medium text-orange-600 hover:text-orange-700 mb-4"
      >
        ← Home
      </Link>
      <MissingPaceBanner fiveKPace={athleteProfile.fiveKPace} />

      <div className="text-center mb-8">
        <div className="relative inline-block mb-6">
          <div className="w-32 h-32 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full mx-auto flex items-center justify-center overflow-hidden shadow-lg ring-4 ring-white">
            {athleteProfile?.photoURL ? (
              <img
                src={athleteProfile.photoURL}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-5xl text-white font-bold">
                {athleteProfile?.firstName ? athleteProfile.firstName[0].toUpperCase() : '👤'}
              </span>
            )}
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
          {athleteProfile?.firstName && athleteProfile?.lastName
            ? `${athleteProfile.firstName} ${athleteProfile.lastName}`
            : 'Your Name'}
        </h1>
        <p className="text-lg text-gray-600 mb-2">@{athleteProfile?.gofastHandle || 'your_handle'}</p>
        {athleteProfile?.fiveKPace?.trim() ? (
          <p className="text-sm text-gray-500 mb-4">
            Current 5K pace: <span className="font-semibold text-gray-800">{athleteProfile.fiveKPace.trim()}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/athlete-edit-profile')}
            className="bg-orange-500 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-orange-600 transition-colors shadow-md"
          >
            Edit full profile
          </button>
          <button
            type="button"
            onClick={() => router.push('/profile/training')}
            className="border-2 border-orange-200 text-orange-800 px-6 py-2.5 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
          >
            Training & pace
          </button>
          <button
            type="button"
            onClick={() => router.push('/profile/runphoto-preview')}
            className="border-2 border-gray-200 text-gray-800 px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            GoFast Page preview
          </button>
          {liveGoFastUrl ? (
            <a
              href={liveGoFastUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center border-2 border-gray-200 text-gray-800 px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              View live GoFast Page
            </a>
          ) : null}
        </div>
      </div>

      <div className="space-y-10">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">
            On your GoFast Page
          </h2>
          {hasPublicBits ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {athleteProfile?.bio ? (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Bio</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">{athleteProfile.bio}</p>
                </div>
              ) : null}
              {athleteProfile?.city || athleteProfile?.state ? (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Location</h3>
                  <p className="text-gray-700 text-sm">
                    {[athleteProfile.city, athleteProfile.state].filter(Boolean).join(', ')}
                  </p>
                </div>
              ) : null}
              {athleteProfile?.primarySport ? (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Sport</h3>
                  <p className="text-gray-700 text-sm capitalize">{athleteProfile.primarySport}</p>
                </div>
              ) : null}
              {athleteProfile?.instagram ? (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Instagram</h3>
                  <a
                    href={`https://instagram.com/${athleteProfile.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                  >
                    {athleteProfile.instagram}
                  </a>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center">
              <p className="text-gray-600 text-sm mb-4">
                Add bio, location, sport, or Instagram so your public GoFast Page tells your story.
              </p>
              <button
                type="button"
                onClick={() => router.push('/athlete-edit-profile')}
                className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
              >
                Edit profile
              </button>
            </div>
          )}
        </section>

        {hasAccountBits ? (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">
              Account
            </h2>
            <dl className="rounded-xl border border-gray-200 bg-gray-50/80 divide-y divide-gray-200 text-sm">
              {athleteProfile?.gofastHandle ? (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-gray-500">Handle</dt>
                  <dd className="text-gray-900 font-medium">@{athleteProfile.gofastHandle}</dd>
                </div>
              ) : null}
              {athleteProfile?.birthday ? (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-gray-500">Birthday</dt>
                  <dd className="text-gray-900">
                    {new Date(athleteProfile.birthday).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                    {age ? ` (age ${age})` : ''}
                  </dd>
                </div>
              ) : null}
              {athleteProfile?.gender ? (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-gray-500">Gender</dt>
                  <dd className="text-gray-900 capitalize">{athleteProfile.gender}</dd>
                </div>
              ) : null}
              {athleteProfile?.phoneNumber ? (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="text-gray-900">{athleteProfile.phoneNumber}</dd>
                </div>
              ) : null}
              {athleteProfile?.email ? (
                <div className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="text-gray-900 break-all">{athleteProfile.email}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : null}
      </div>
    </div>
  );
}
