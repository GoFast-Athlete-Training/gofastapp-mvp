'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Image from 'next/image';

/**
 * Detect if user is on coach subdomain (e.g. coach.gofastcrushgoals.com)
 */
function isCoachSubdomain(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('coach.');
}

/**
 * Detect if user is on leader subdomain
 * Simple hostname check - no cookies/middleware needed
 */
function isLeaderSubdomain(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.startsWith('leader.');
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
    if (!isLoading) {
      const timer = setTimeout(() => {
        if (isCoachIntent) {
          if (isAuthenticated) {
            router.replace('/coach-hub');
          } else {
            router.replace('/coach-signup');
          }
          return;
        }
        if (isAuthenticated) {
          router.replace('/welcome');
        } else {
          const intentParam = isLeaderIntent ? '?intent=club-leader' : '';
          router.replace(`/signup${intentParam}`);
        }
      }, 1500);

      return () => clearTimeout(timer);
    }
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

  if (isLoading) {
    return (
      <div
        className={`min-h-screen ${gradientClass} flex items-center justify-center`}
      >
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-white rounded-full mx-auto mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${gradientClass} flex items-center justify-center`}>
      <div className="animate-fade-in text-center px-4">
        <Image
          src="/logo.jpg"
          alt="GoFast Logo"
          width={192}
          height={192}
          className="w-48 h-48 rounded-full shadow-2xl mx-auto mb-6"
          priority
        />
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">{headline}</h1>
        {isCoachIntent && (
          <p className="text-xl md:text-2xl text-white/90 mb-8">{coachSub}</p>
        )}
        {!isCoachIntent && !isLeaderIntent && (
          <p className="text-xl md:text-2xl text-white/90 mb-8">
            Find runs. Join crews. Race.
          </p>
        )}
        {!isAuthenticated && (
          <button
            onClick={() => {
              if (isCoachIntent) router.replace('/coach-signup');
              else router.replace(isLeaderIntent ? '/signup?intent=club-leader' : '/signup');
            }}
            className={
              isCoachIntent
                ? 'bg-white text-amber-900 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl hover:bg-amber-50 transition transform hover:scale-105'
                : 'bg-white text-sky-600 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl hover:bg-sky-50 transition transform hover:scale-105'
            }
          >
            {ctaText}
          </button>
        )}
      </div>
    </div>
  );
}
