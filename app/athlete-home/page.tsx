'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LocalStorageAPI } from '@/lib/localstorage';
import AthleteHeader from '@/components/athlete/AthleteHeader';
import ProfileCallout from '@/components/athlete/ProfileCallout';
import TopNav from '@/components/shared/TopNav';

interface RunCrew {
  membershipId: string;
  runCrewId: string;
  runCrewName: string;
  role: 'MEMBER' | 'ADMIN';
}

export default function AthleteHomePage() {
  const router = useRouter();
  const [athleteProfile, setAthleteProfile] = useState<any>(null);
  const [runCrews, setRunCrews] = useState<RunCrew[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // Read directly from localStorage (no hook)
    const athlete = LocalStorageAPI.getAthleteProfile();
    const athleteId = LocalStorageAPI.getAthleteId();
    
    if (athlete) {
      setAthleteProfile(athlete);
    }

    // Resolve memberships from localStorage
    const model = LocalStorageAPI.getFullHydrationModel();
    const memberships = model?.runCrewMemberships || [];

    // Map memberships to RunCrew format with roles
    const crews: RunCrew[] = memberships.map((membership: any) => {
      // Use membership.role directly
      const role: 'MEMBER' | 'ADMIN' = membership.role === 'admin' ? 'ADMIN' : 'MEMBER';

      return {
        membershipId: membership.id,
        runCrewId: membership.runCrewId || membership.runCrew?.id,
        runCrewName: membership.runCrew?.name || 'Unknown Crew',
        role,
      };
    });

    setRunCrews(crews);
    setLoading(false);
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your account...</p>
        </div>
      </div>
    );
  }

  // Get primary crew ID and determine admin status from memberships
  const runCrewId = LocalStorageAPI.getMyCrew() || LocalStorageAPI.getRunCrewId();
  const primaryCrew = runCrews.find((crew) => crew.runCrewId === runCrewId);
  const isCrewAdmin = primaryCrew?.role === 'ADMIN';

  // Profile setup logic
  const profileIncomplete =
    !athleteProfile || !athleteProfile?.firstName || !athleteProfile?.lastName || !athleteProfile?.primarySport;

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {profileIncomplete && <ProfileCallout athlete={athleteProfile} />}

        {/* Primary Crew UI */}
        {!runCrewId && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No RunCrew</h2>
            <p className="text-gray-600 mb-6">You're not a member of any RunCrews yet.</p>
            <Link
              href="/runcrew/join"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold"
            >
              Join a RunCrew
            </Link>
          </div>
        )}

        {runCrewId && primaryCrew && !isCrewAdmin && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{primaryCrew.runCrewName}</h2>
            <Link
              href={`/runcrew/${runCrewId}/member`}
              className="block w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold transition text-center"
            >
              View as Member
            </Link>
          </div>
        )}

        {runCrewId && primaryCrew && isCrewAdmin && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{primaryCrew.runCrewName}</h2>
            <div className="flex gap-4">
              <Link
                href={`/runcrew/${runCrewId}/member`}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold transition text-center"
              >
                View as Member
              </Link>
              <Link
                href={`/runcrew/${runCrewId}/admin`}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-6 py-4 rounded-lg font-semibold transition text-center"
              >
                View as Admin
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
