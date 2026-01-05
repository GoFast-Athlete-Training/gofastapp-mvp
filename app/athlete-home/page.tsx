'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * DEPRECATED: Athlete Home Page
 * 
 * This page is deprecated and redirects to /runcrew (general RunCrew landing page).
 * 
 * Current flow:
 * - /runcrew = General RunCrew landing page (join/create)
 * - /profile = Profile edit
 * 
 * This page will be re-implemented in the future with more robust features.
 */

export default function AthleteHomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to /runcrew (general RunCrew landing page)
    router.replace('/runcrew');
  }, [router]);

  // Show loading state during redirect
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
