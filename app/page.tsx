'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Image from 'next/image';
import { LocalStorageAPI } from '@/lib/localstorage';
import {
  resolveRootEntryPath,
  resolveRootHostIntent,
  type RootHostIntent,
} from '@/lib/product-host';

function SplashLogo({ pulse = false }: { pulse?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="GoFast Logo"
      width={256}
      height={256}
      className={`w-64 h-64 rounded-full shadow-xl object-cover ${pulse ? 'animate-pulse' : ''}`}
      priority
    />
  );
}

export default function RootPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hostIntent, setHostIntent] = useState<RootHostIntent>('default');

  useEffect(() => {
    const hostname = window.location.hostname;
    const intent = resolveRootHostIntent(hostname);
    setHostIntent(intent);
    if (intent === 'club-manager') {
      LocalStorageAPI.setClubManagerMode(true);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (typeof window === 'undefined') return;

    router.replace(
      resolveRootEntryPath({
        hostname: window.location.hostname,
        isAuthenticated,
      })
    );
  }, [isLoading, isAuthenticated, router]);

  const isCoachIntent = hostIntent === 'coach';
  const isLeaderIntent = hostIntent === 'leader';
  const isClubManagerIntent = hostIntent === 'club-manager';

  const coachHeadline = 'Train your athletes. Build champions.';
  const coachSub = 'Manage race training groups and assign workouts.';
  const leaderHeadline = 'Claim and manage your run club';
  const clubManagerHeadline = 'Manage your run club.';
  const clubManagerSub = 'Edit profile, runs, and announcements for your club.';
  const defaultHeadline = 'Find your pace group. Train hard. PR.';

  const headline = isCoachIntent
    ? coachHeadline
    : isClubManagerIntent
      ? clubManagerHeadline
      : isLeaderIntent
        ? leaderHeadline
        : defaultHeadline;

  const ctaText = isCoachIntent
    ? 'Get started as a coach'
    : isClubManagerIntent
      ? 'Continue to Club Manager'
      : isLeaderIntent
        ? 'Get Started'
        : 'Join Now';

  const gradientClass = isCoachIntent
    ? 'bg-gradient-to-br from-amber-500 to-orange-700'
    : 'bg-gradient-to-br from-sky-400 to-sky-600';

  const showIntentSplash =
    !isLoading &&
    (isCoachIntent || isLeaderIntent || isClubManagerIntent) &&
    !isAuthenticated;

  return (
    <div className={`min-h-screen ${gradientClass} flex items-center justify-center`}>
      {showIntentSplash ? (
        <div className="animate-fade-in text-center px-4">
          <SplashLogo />
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 mt-6">{headline}</h1>
          {isCoachIntent && (
            <p className="text-xl md:text-2xl text-white/90 mb-8">{coachSub}</p>
          )}
          {isClubManagerIntent && (
            <p className="text-xl md:text-2xl text-white/90 mb-8">{clubManagerSub}</p>
          )}
          {!isCoachIntent && !isLeaderIntent && !isClubManagerIntent && (
            <p className="text-xl md:text-2xl text-white/90 mb-8">
              Find runs. Join crews. Race.
            </p>
          )}
          <button
            onClick={() => {
              if (isCoachIntent) router.replace('/coach-signup');
              else if (isClubManagerIntent) router.replace('/welcome-clubmanager');
              else router.replace('/signup?intent=club-leader');
            }}
            className={
              isCoachIntent
                ? 'bg-white text-amber-900 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl hover:bg-amber-50 transition transform hover:scale-105'
                : 'bg-white text-sky-600 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl hover:bg-sky-50 transition transform hover:scale-105'
            }
          >
            {ctaText}
          </button>
        </div>
      ) : (
        <SplashLogo pulse={isLoading} />
      )}
    </div>
  );
}
