'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Image from 'next/image';

function isCoachSubdomain(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('coach.');
}

function isLeaderSubdomain(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('leader.');
}

function SplashLogo({ pulse = false }: { pulse?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="GoFast Logo"
      width={128}
      height={128}
      className={`w-32 h-32 rounded-full shadow-xl object-cover ${pulse ? 'animate-pulse' : ''}`}
      priority
    />
  );
}

export default function RootPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLeaderIntent, setIsLeaderIntent] = useState(false);
  const [isCoachIntent, setIsCoachIntent] = useState(false);

  useEffect(() => {
    const coach = isCoachSubdomain();
    setIsCoachIntent(coach);
    if (!coach) {
      setIsLeaderIntent(isLeaderSubdomain());
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

    if (isCoachIntent) {
      router.replace(isAuthenticated ? '/coach-hub' : '/coach-signup');
      return;
    }
    if (isAuthenticated) {
      router.replace('/welcome');
      return;
    }
    if (isLeaderIntent) {
      router.replace('/signup?intent=club-leader');
      return;
    }
    router.replace('/explainer');
  }, [isLoading, isAuthenticated, isLeaderIntent, isCoachIntent, router]);

  const coachHeadline = 'Train your athletes. Build champions.';
  const coachSub = 'Manage race training groups and assign workouts.';
  const leaderHeadline = 'Claim and manage your run club';
  const defaultHeadline = 'Find your pace group. Train hard. PR.';

  const headline = isCoachIntent
    ? coachHeadline
    : isLeaderIntent
      ? leaderHeadline
      : defaultHeadline;

  const ctaText = isCoachIntent
    ? 'Get started as a coach'
    : isLeaderIntent
      ? 'Get Started'
      : 'Join Now';

  const gradientClass = isCoachIntent
    ? 'bg-gradient-to-br from-amber-500 to-orange-700'
    : 'bg-gradient-to-br from-sky-400 to-sky-600';

  const showIntentSplash = !isLoading && (isCoachIntent || isLeaderIntent) && !isAuthenticated;

  return (
    <div className={`min-h-screen ${gradientClass} flex items-center justify-center`}>
      {showIntentSplash ? (
        <div className="animate-fade-in text-center px-4">
          <SplashLogo />
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 mt-6">{headline}</h1>
          {isCoachIntent && (
            <p className="text-xl md:text-2xl text-white/90 mb-8">{coachSub}</p>
          )}
          {!isCoachIntent && !isLeaderIntent && (
            <p className="text-xl md:text-2xl text-white/90 mb-8">
              Find runs. Join crews. Race.
            </p>
          )}
          <button
            onClick={() => {
              if (isCoachIntent) router.replace('/coach-signup');
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
