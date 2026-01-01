import { redirect } from 'next/navigation';
import { getAthleteIdFromCookie } from '@/lib/server/cookies';
import { hydrateCrew, getCrewById } from '@/lib/domain-runcrew';
import { prisma } from '@/lib/prisma';

/**
 * Member Page - PHASE 1
 * 
 * Route: /runcrew/:runCrewId/member
 * 
 * Behavior:
 * - Fetch RunCrew by runCrewId
 * - Fetch membership for current athlete + runCrew
 * - Determine role server-side
 * - Render basic member view
 */
export default async function RunCrewMemberPage({
  params,
}: {
  params: Promise<{ runCrewId: string }>;
}) {
  const { runCrewId } = await params;

  // Get athleteId from cookie
  const athleteId = await getAthleteIdFromCookie();
  if (!athleteId) {
    redirect('/welcome');
  }

  // Fetch RunCrew
  const crew = await getCrewById(runCrewId);
  if (!crew) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">RunCrew Not Found</h2>
          <p className="text-gray-600">The RunCrew you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Check membership
  const membership = await prisma.runCrewMembership.findUnique({
    where: {
      runCrewId_athleteId: {
        runCrewId,
        athleteId,
      },
    },
  });

  if (!membership) {
    redirect('/athlete');
  }

  // Get crew with full context for display
  const crewWithContext = await hydrateCrew(runCrewId, athleteId);
  if (!crewWithContext) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">Failed to load RunCrew data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{crew.name}</h1>
              {crew.description && (
                <p className="text-gray-600 mt-2">{crew.description}</p>
              )}
            </div>
            <a
              href="/athlete"
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to RunCrews
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Member View</h2>
          <p className="text-gray-600">
            This is the member view for {crew.name}. More features coming soon.
          </p>
        </div>

        {/* Basic member view - placeholder for Phase 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Announcements */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Announcements</h3>
            {crewWithContext.announcements && crewWithContext.announcements.length > 0 ? (
              <div className="space-y-4">
                {crewWithContext.announcements.map((announcement: any) => (
                  <div key={announcement.id} className="border-b pb-4 last:border-0">
                    <div className="font-medium text-gray-900">{announcement.title}</div>
                    <div className="text-sm text-gray-600 mt-1">{announcement.content}</div>
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(announcement.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No announcements yet.</p>
            )}
          </div>

          {/* Members */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Members</h3>
            {crewWithContext.memberships && crewWithContext.memberships.length > 0 ? (
              <div className="space-y-2">
                {crewWithContext.memberships.slice(0, 10).map((membership: any) => (
                  <div key={membership.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                    <div>
                      <div className="text-sm font-medium">
                        {membership.athlete.firstName} {membership.athlete.lastName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No members yet.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

