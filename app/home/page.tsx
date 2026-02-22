'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/**
 * Home Page - Redirects to athlete-home
 * 
 * This route exists to match the requirement: ATHLETE → /home
 * It redirects to /athlete-home which is the actual athlete dashboard
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Not authenticated - redirect to signup
        console.warn('// REDIRECT DISABLED: /signup');
        return;
      }
      // Redirect to athlete-home (the actual athlete dashboard)
      router.replace('/athlete-home');
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white text-lg">Loading...</p>
      </div>
    </div>
  );
}
