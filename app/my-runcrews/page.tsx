'use client';


import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';

interface RunCrewCard {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  icon?: string;
  role: 'admin' | 'member' | 'manager';
  membershipId: string;
}

/**
 * My RunCrews (Returner Page)
 *
 * Assumes athlete hydration already occurred in /welcome.
 * This page reads memberships from localStorage and renders navigation.
 * The "Create RunCrew" link is a simple Link to /runcrew/create.
 */
export default function MyRunCrewsPage() {
  const router = useRouter();
  const [runCrewCards, setRunCrewCards] = useState<RunCrewCard[]>([]);
  const [athlete, setAthlete] = useState<any>(null);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Read hydrated model from localStorage (hydration happened in /welcome)
    if (typeof window === 'undefined') return;

    const model = LocalStorageAPI.getFullHydrationModel();
    
    // Guard: If no athlete exists → redirect to welcome for hydration
    if (!model?.athlete) {
      router.replace('/welcome');
      return;
    }

    setAthlete(model.athlete);
    
    // Build RunCrew cards from memberships (already resolved in /welcome)
    const memberships = model.athlete.runCrewMemberships || [];
    const cards: RunCrewCard[] = memberships.map((membership: any) => {
      const runCrew = membership.runCrew || {};
      return {
        id: runCrew.id || membership.runCrewId,
        name: runCrew.name || 'Unknown Crew',
        description: runCrew.description,
        logo: runCrew.logo,
        icon: runCrew.icon,
        role: membership.role || 'member',
        membershipId: membership.id,
      };
    });

    setRunCrewCards(cards);
    setHasChecked(true);

    // Guard: If athlete exists but has zero runCrewMemberships → redirect to discovery
    if (cards.length === 0) {
      router.replace('/runcrew-discovery');
      return;
    }
  }, [router]);

  // Show nothing while checking (prevents flash)
  if (!hasChecked) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600">
      <TopNav />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Hey {athlete?.firstName || 'runner'} — which RunCrew do you want to check on?
          </h1>
        </div>

        {runCrewCards.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-2xl mx-auto">
            <div className="text-6xl mb-4">🏃</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">No RunCrews Yet</h2>
            <p className="text-xl text-gray-600 mb-8">
              It looks like you don't have any crews yet. Head over to our RunCrew directory to explore and find your crew.
            </p>
            <Link
              href="/runcrew-discovery"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition shadow-lg hover:shadow-xl"
            >
              Explore RunCrews
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {runCrewCards.map((crew) => (
              <div
                key={crew.id}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                {/* Crew Header with Logo/Icon */}
                <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100">
                  <div className="flex items-center gap-4 mb-4">
                    {crew.logo ? (
                      <img
                        src={crew.logo}
                        alt={crew.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                      />
                    ) : crew.icon ? (
                      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-3xl border-2 border-white shadow-md">
                        {crew.icon}
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-3xl text-white border-2 border-white shadow-md">
                        🏃
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900">{crew.name}</h3>
                      {crew.role === 'admin' && (
                        <span className="inline-block mt-1 px-2 py-1 bg-orange-500 text-white text-xs font-semibold rounded">
                          Admin
                        </span>
                      )}
                      {crew.role === 'manager' && (
                        <span className="inline-block mt-1 px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded">
                          Manager
                        </span>
                      )}
                    </div>
                  </div>
                  {crew.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{crew.description}</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="p-6 space-y-3">
                  <Link
                    href={`/runcrew/${crew.id}/member`}
                    className="block w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold text-center transition"
                  >
                    View as Member
                  </Link>
                  {crew.role === 'admin' || crew.role === 'manager' ? (
                    <Link
                      href={`/runcrew/${crew.id}/admin`}
                      className="block w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg font-semibold text-center transition"
                    >
                      View as Admin
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Options */}
        <div className="mt-12 text-center space-x-4">
          <Link
            href="/runcrew-discovery"
            className="inline-block bg-white hover:bg-gray-50 text-gray-900 px-6 py-3 rounded-lg font-semibold transition shadow-md"
          >
            Explore RunCrews
          </Link>
          <Link
            href="/runcrew/create"
            className="inline-block bg-white hover:bg-gray-50 text-gray-900 px-6 py-3 rounded-lg font-semibold transition shadow-md"
          >
            + Create RunCrew
          </Link>
        </div>
      </div>
    </div>
  );
}
