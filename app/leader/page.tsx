'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import TopNav from '@/components/shared/TopNav';

/**
 * Welcome Run Club Leader – front door for users with CLUB_LEADER role
 *
 * Purpose: Different front door that checks role status and routes here from /welcome.
 * - Requires authentication
 * - Verifies role via hydrate; if not CLUB_LEADER, redirects to /welcome
 * - Shows "Welcome, Run Club Leader" UX and actions for club management
 */
export default function LeaderHubPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [clubName, setClubName] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/signup');
        return;
      }
      setIsAuthenticated(true);
      try {
        const res = await api.post('/athlete/hydrate');
        if (res.data?.success && res.data?.athlete) {
          const a = res.data.athlete;
          if (a.role !== 'CLUB_LEADER') {
            router.replace('/welcome');
            return;
          }
          if (a.runClub?.name) setClubName(a.runClub.name);
        } else {
          router.replace('/welcome');
          return;
        }
      } catch {
        router.replace('/welcome');
        return;
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 to-sky-600">
      <TopNav />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Welcome, Run Club Leader
          </h1>
          <p className="text-white text-xl opacity-90">
            {clubName
              ? `Manage ${clubName} and connect with your community`
              : 'Manage your run club and connect with your community'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Manage Club Content */}
          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-5xl mb-4 text-center">📝</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">
              Manage Club Content
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              Update your club's information, description, and branding
            </p>
            <button
              onClick={() => {
                // Placeholder - will navigate to content management
                alert('Club content management coming soon!');
              }}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              Manage Content
            </button>
          </div>

          {/* Manage Runs */}
          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-5xl mb-4 text-center">🏃</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">
              Manage Runs
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              Create and schedule runs for your club members
            </p>
            <button
              onClick={() => {
                // Placeholder - will navigate to run management
                alert('Run management coming soon!');
              }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              Manage Runs
            </button>
          </div>

          {/* Start a Run Crew */}
          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-5xl mb-4 text-center">👥</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">
              Start a Run Crew
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              Create a new run crew for your community
            </p>
            <button
              onClick={() => {
                router.push('/runcrew/create');
              }}
              className="w-full bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              Create Run Crew
            </button>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-12 bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
          <h3 className="text-2xl font-bold text-white mb-4 text-center">
            Your front door
          </h3>
          <p className="text-white/90 text-center max-w-2xl mx-auto">
            You’re signed in as a run club leader. Use the options above to manage your club’s content, organize runs, and build your running community.
          </p>
        </div>
      </div>
    </div>
  );
}
