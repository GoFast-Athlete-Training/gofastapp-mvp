'use client';


import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Image from 'next/image';
import { getOnboardingIntentClient } from '@/lib/onboarding-intent';

export default function RootPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [intent, setIntent] = useState<'CLUB_LEADER' | 'ATHLETE'>('ATHLETE');

  useEffect(() => {
    // Get onboarding intent from cookie
    const detectedIntent = getOnboardingIntentClient();
    setIntent(detectedIntent);
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
          // Redirect based on intent
          if (intent === 'CLUB_LEADER') {
            router.replace('/leader');
          } else {
            router.replace('/home');
          }
        } else {
          router.replace('/signup');
        }
      }, 1500); // Logo shows for 1.5 seconds, then route

      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, intent, router]);

  // Determine copy based on intent
  const headline = intent === 'CLUB_LEADER' 
    ? 'Claim and manage your run club'
    : 'Find runs and join crews';
  
  const ctaText = intent === 'CLUB_LEADER'
    ? 'Get Started'
    : 'Join Now';

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
        <p className="text-xl md:text-2xl text-white/90 mb-8">
          Run with others. PR.
        </p>
        {!isAuthenticated && (
          <button
            onClick={() => router.push('/signup')}
            className="bg-white text-sky-600 px-8 py-4 rounded-xl font-bold text-lg shadow-2xl hover:bg-sky-50 transition transform hover:scale-105"
          >
            {ctaText}
          </button>
        )}
      </div>
    </div>
  );
}
