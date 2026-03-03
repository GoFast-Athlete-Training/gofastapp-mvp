'use client';


import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Image from 'next/image';

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

  useEffect(() => {
    // Check hostname directly (no cookie/middleware needed)
    setIsLeaderIntent(isLeaderSubdomain());
  }, []);

  useEffect(() => {
    // Check if user is authenticated
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      // Show logo for 2 seconds, then route
      const timer = setTimeout(() => {
        if (isAuthenticated) {
          // Hydrate and then land on athlete-home (welcome redirects there)
          router.replace('/welcome');
        } else {
          // Pass intent via URL param (simple, no cookie)
          const intentParam = isLeaderIntent ? '?intent=club-leader' : '';
          router.replace(`/signup${intentParam}`);
        }
      }, 1500); // Logo shows for 1.5 seconds, then route

      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, isLeaderIntent, router]);

  // Splash copy — pace group, train, PR
  const headline = isLeaderIntent
    ? 'Claim and manage your run club'
    : 'Find your pace group. Train hard. PR.';
  const ctaText = isLeaderIntent ? 'Get Started' : 'Join Now';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-white rounded-full mx-auto mb-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
      <div className="animate-fade-in text-center px-4">
        <Image 
          src="/logo.jpg" 
          alt="GoFast Logo" 
          width={192}
          height={192}
          className="w-48 h-48 rounded-full shadow-2xl mx-auto mb-6"
          priority
        />
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
          {headline}
        </h1>
        {!isLeaderIntent && (
          <p className="text-xl md:text-2xl text-white/90 mb-8">
            Find runs. Join crews. Race.
          </p>
        )}
        {!isAuthenticated && (
          <button
            onClick={() => router.replace(isLeaderIntent ? '/signup?intent=club-leader' : '/signup')}
            className="bg-white text-sky-600 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl hover:bg-sky-50 transition transform hover:scale-105"
          >
            {ctaText}
          </button>
        )}
      </div>
    </div>
  );
}
