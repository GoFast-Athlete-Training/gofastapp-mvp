import { redirect } from 'next/navigation';
import { getAthleteIdFromCookie } from '@/lib/server/cookies';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

interface RunCrew {
  membershipId: string;
  runCrewId: string;
  runCrewName: string;
  role: 'MEMBER' | 'ADMIN';
}

/**
 * Athlete Home Page - PHASE 1
 * 
 * Route: /athlete/[athleteId]
 * 
 * Purpose: RunCrew Discovery
 * - Cookie: Used for persistent authorization (verify identity)
 * - Param: Used to call API/fetch data (athleteId from URL)
 * - Looks up and resolves memberships server-side using param
 * - Shows "View as Member" button for each
 * - Shows "View as Admin" button if role === 'ADMIN'
 */
export default async function AthletePage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;

  // Verify identity using cookie (authorization)
  const cookieAthleteId = await getAthleteIdFromCookie();
  if (!cookieAthleteId || cookieAthleteId !== athleteId) {
    redirect('/welcome');
  }

  // Use param to fetch athlete with memberships (same pattern as hydrate)
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: {
      runCrewMemberships: {
        include: {
          runCrew: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      runCrewManagers: {
        select: {
          runCrewId: true,
          role: true,
        },
      },
    },
  });

  if (!athlete) {
    redirect('/welcome');
  }

  // Resolve memberships with roles - explicitly set 'MEMBER' for all non-admin members
  const runCrews: RunCrew[] = (athlete.runCrewMemberships || []).map((membership) => {
    const managerRecord = (athlete.runCrewManagers || []).find(
      (m) => m.runCrewId === membership.runCrewId
    );
    
    // Explicitly set role: 'ADMIN' only if manager record exists AND role is 'admin', otherwise 'MEMBER'
    const role: 'MEMBER' | 'ADMIN' = (managerRecord && managerRecord.role === 'admin') 
      ? 'ADMIN' 
      : 'MEMBER';

    return {
      membershipId: membership.id,
      runCrewId: membership.runCrewId,
      runCrewName: membership.runCrew.name,
      role,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900">My RunCrews</h1>
          <p className="text-gray-600 mt-2">Choose a RunCrew to view</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {runCrews.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No RunCrews</h2>
            <p className="text-gray-600 mb-6">You're not a member of any RunCrews yet.</p>
            <Link
              href="/runcrew/join"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold"
            >
              Join a RunCrew
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {runCrews.map((runCrew) => (
              <div
                key={runCrew.runCrewId}
                className="bg-white rounded-lg shadow hover:shadow-md transition p-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {runCrew.runCrewName}
                </h2>

                <div className="space-y-2">
                  {/* Always show View as Member button */}
                  <Link
                    href={`/runcrew/${runCrew.runCrewId}/member`}
                    className="block w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold transition text-center"
                  >
                    View as Member
                  </Link>

                  {/* Show View as Admin button only if role === 'ADMIN' */}
                  {runCrew.role === 'ADMIN' && (
                    <Link
                      href={`/runcrew/${runCrew.runCrewId}/admin`}
                      className="block w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold transition text-center"
                    >
                      View as Admin
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

