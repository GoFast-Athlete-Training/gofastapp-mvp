'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Calendar, Clock, MapPin } from 'lucide-react';
import useHydratedAthlete from '@/hooks/useHydratedAthlete';

interface CrewHeroProps {
  crew: any;
  nextRun: any;
  nextRunAttendees: any[];
  isCrewAdmin: boolean;
  runCrewId: string | null;
}

export default function CrewHero({ crew, nextRun, nextRunAttendees, isCrewAdmin, runCrewId }: CrewHeroProps) {
  const router = useRouter();
  const [showCrewSelector, setShowCrewSelector] = useState(false);
  const [adminCrews, setAdminCrews] = useState<any[]>([]);
  
  // READ-ONLY: Get identity data from hook (NO API calls)
  const { athlete } = useHydratedAthlete();

  // Determine admin status from prop (passed from parent)
  const actualIsAdmin = isCrewAdmin;

  const handleGoToCrew = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    console.log('🔵 View Crew button clicked - navigating (NO hydration)');
    
    // NAVIGATION ONLY - No API calls, no hydration
    // Route pages will handle crew context hydration
    
    if (!runCrewId) {
      console.log('🔵 No runCrewId, navigating to /runcrew');
      router.push('/runcrew');
      return;
    }

    // Check if user is admin/manager from identity data (already in localStorage)
    const crews = athlete?.runCrewMemberships || [];
    const adminCrewsList = crews
      .map((membership: any) => {
        const managerRole = (athlete.runCrewManagers || []).find(
          (m: any) => m.runCrewId === membership.runCrewId
        );
        return {
          ...membership.runCrew,
          role: managerRole?.role || 'member',
        };
      })
      .filter((c: any) => c.role === 'admin' || c.role === 'manager');

    console.log('🔵 Admin/Manager crews found:', adminCrewsList.length);

    if (adminCrewsList.length === 0) {
      // No admin crews, go to regular crew page
      router.push(`/runcrew/${runCrewId}`);
    } else if (adminCrewsList.length === 1) {
      // Single admin crew, go directly to admin page
      const adminCrew = adminCrewsList[0];
      router.push(`/runcrew/${adminCrew.id}/admin`);
    } else {
      // Multiple admin crews, show selector
      setAdminCrews(adminCrewsList);
      setShowCrewSelector(true);
    }
  };

  const handleSelectCrew = (selectedCrewId: string) => {
    // NAVIGATION ONLY - Route page will hydrate crew context
    router.push(`/runcrew/${selectedCrewId}/admin`);
    setShowCrewSelector(false);
  };

  if (crew && runCrewId) {
    return (
      <div className="bg-gradient-to-r from-sky-500 to-sky-600 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{crew.name || 'Your Run Crew'}</h1>
            {crew.description && <p className="text-sky-50/90 text-lg">{crew.description}</p>}
          </div>
          {crew.icon && <span className="text-5xl">{crew.icon}</span>}
        </div>

        {/* Next Run */}
        {nextRun ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Next Run</h2>
            </div>
            <div className="space-y-2 text-sky-50">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="font-medium">
                  {nextRun.date
                    ? new Date(nextRun.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Date TBD'}
                  {nextRun.time || nextRun.startTime
                    ? ` · ${nextRun.time || nextRun.startTime}`
                    : ''}
                </span>
              </div>
              {nextRun.meetUpPoint && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{nextRun.meetUpPoint}</span>
                </div>
              )}
              {nextRunAttendees.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex -space-x-2">
                    {nextRunAttendees.map((attendee, idx) => (
                      <div
                        key={idx}
                        className="w-8 h-8 rounded-full bg-white/20 border-2 border-white flex items-center justify-center text-white text-xs font-semibold"
                      >
                        {attendee.photoURL ? (
                          <img
                            src={attendee.photoURL}
                            alt={attendee.firstName}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          (attendee.firstName?.[0] || 'A').toUpperCase()
                        )}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm text-sky-50/80">
                    {nextRun.rsvps?.filter((r: any) => r.status === 'going').length ||
                      nextRunAttendees.length}{' '}
                    going
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-4">
            <p className="text-sky-50/80">No upcoming runs scheduled</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoToCrew}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition shadow-lg"
        >
          View Crew →
        </button>

        {/* Crew Selector Modal */}
        {showCrewSelector && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Select Crew to Manage
              </h2>
              <p className="text-gray-600 mb-6">
                You're an admin/manager of multiple crews. Which one would you like to manage?
              </p>
              <div className="space-y-2 mb-6">
                {adminCrews.map((adminCrew) => (
                  <button
                    key={adminCrew.id}
                    onClick={() => handleSelectCrew(adminCrew.id)}
                    className="w-full text-left p-4 border-2 border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {adminCrew.name || 'Unnamed Crew'}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          Role: {adminCrew.role}
                        </div>
                      </div>
                      {adminCrew.icon && (
                        <span className="text-3xl">{adminCrew.icon}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowCrewSelector(false)}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Empty state: No crew
  return (
    <div className="bg-white rounded-2xl shadow-lg p-12 text-center border-2 border-orange-200">
      <Users className="h-16 w-16 text-orange-500 mx-auto mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Join or Create a Run Crew</h2>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        Join or create a Run Crew to get the most out of GoFast. Connect with other runners,
        coordinate runs, and stay accountable.
      </p>
      <button
        type="button"
        onClick={() => router.push('/runcrew')}
        className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold transition shadow-md"
      >
        Get Started →
      </button>
    </div>
  );
}

