'use client';


import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import TopNav from '@/components/shared/TopNav';
import CrewHero from '@/components/athlete/CrewHero';
import WeeklyStats from '@/components/athlete/WeeklyStats';
import LatestActivityCard from '@/components/athlete/LatestActivityCard';
import { 
  Home, 
  Users, 
  Activity, 
  Settings, 
  User
} from 'lucide-react';
import Image from 'next/image';
import api from '@/lib/api';

export default function AthleteHomePage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<any>(null);
  const [runCrewId, setRunCrewId] = useState<string | null>(null);
  const [runCrew, setRunCrew] = useState<any>(null);
  const [weeklyActivities, setWeeklyActivities] = useState<any[]>([]);
  const [weeklyTotals, setWeeklyTotals] = useState<any>(null);
  const [garminConnected, setGarminConnected] = useState(false);
  const [connectingGarmin, setConnectingGarmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // First, check localStorage for athlete data (fastest check)
    const model = LocalStorageAPI.getFullHydrationModel();
    
    if (!model?.athlete) {
      // No athlete data - redirect to welcome for hydration
      console.log('⚠️ Athlete Home: No athlete data in localStorage, redirecting to /welcome');
      router.replace('/welcome');
      return;
    }

    // We have athlete data - set it up
    setAthlete(model.athlete);
    setRunCrewId(model.athlete.MyCrew || LocalStorageAPI.getMyCrew());
    setWeeklyActivities(model.weeklyActivities || []);
    setWeeklyTotals(model.weeklyTotals || null);
    
    // Get crew data
    const crewData = LocalStorageAPI.getRunCrewData();
    if (crewData) {
      setRunCrew(crewData);
    } else if (model.athlete.runCrewMemberships) {
      // Find primary crew from memberships
      const primaryCrewId = model.athlete.MyCrew || LocalStorageAPI.getMyCrew();
      const membership = model.athlete.runCrewMemberships.find(
        (m: any) => m.runCrew?.id === primaryCrewId
      );
      if (membership?.runCrew) {
        setRunCrew(membership.runCrew);
      }
    }

    // Check Garmin connection (from hydrated model first, then localStorage fallback)
    const garminFromModel = model.athlete.garmin_is_connected;
    const garminFromStorage = localStorage.getItem('garminConnected') === 'true';
    setGarminConnected(garminFromModel || garminFromStorage);

    // Check Firebase auth (but don't redirect immediately - we already have athlete data)
    const unsubscribe = auth.onAuthStateChanged((user) => {
      // Only redirect if no user AND we've confirmed there's no localStorage data
      // (This prevents race conditions where Firebase hasn't initialized yet)
      if (!user) {
        const currentModel = LocalStorageAPI.getFullHydrationModel();
        if (!currentModel?.athlete) {
          console.log('⚠️ Athlete Home: No Firebase user and no localStorage data, redirecting to /signup');
          router.replace('/signup');
        }
        // If we have localStorage data, keep showing the page (user might be in popup context)
      }
    });

    setLoading(false);
    return () => unsubscribe();
  }, [router]);


  // Calculate next run
  const nextRun = useMemo(() => {
    if (!runCrew?.runs) return null;
    const now = new Date();
    const upcoming = runCrew.runs
      .filter((run: any) => {
        if (!run.date) return false;
        const runDate = new Date(run.date);
        return runDate >= now;
      })
      .sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
    return upcoming[0] || null;
  }, [runCrew]);

  // Calculate next run attendees
  const nextRunAttendees = useMemo(() => {
    if (!nextRun?.rsvps) return [];
    return nextRun.rsvps
      .filter((rsvp: any) => rsvp.status === 'going')
      .slice(0, 3)
      .map((rsvp: any) => rsvp.athlete);
  }, [nextRun]);

  // Calculate latest activity
  const latestActivity = useMemo(() => {
    if (!weeklyActivities || weeklyActivities.length === 0) return null;
    return weeklyActivities[0];
  }, [weeklyActivities]);

  // Check if user is crew admin
  const isCrewAdmin = useMemo(() => {
    if (!athlete?.runCrewMemberships || !runCrewId) return false;
    const membership = athlete.runCrewMemberships.find(
      (m: any) => m.runCrew?.id === runCrewId
    );
    return membership?.role === 'admin' || membership?.role === 'manager';
  }, [athlete, runCrewId]);


  const handleGoToCrew = () => {
    if (!runCrewId) {
      router.push('/runcrew-discovery');
      return;
    }
    if (isCrewAdmin) {
      router.push(`/runcrew/${runCrewId}/admin`);
    } else {
      router.push(`/runcrew/${runCrewId}`);
    }
  };

  // Direct Garmin OAuth flow (like gofastfrontend-mvp1)
  const handleConnectGarmin = async () => {
    // Get athleteId from localStorage (most reliable)
    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      alert('Please sign in to connect Garmin');
      return;
    }

    setConnectingGarmin(true);
    try {
      // Get Firebase token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert('Please sign in to connect Garmin');
        setConnectingGarmin(false);
        return;
      }
      const firebaseToken = await currentUser.getIdToken();
      
      // Call authorize endpoint to get auth URL (with athleteId and popup flag)
      const response = await fetch(`/api/auth/garmin/authorize?athleteId=${athleteId}&popup=true`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${firebaseToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get auth URL');
      }

      const data = await response.json();
      if (!data.authUrl) {
        throw new Error(data.error || 'Invalid response from server');
      }

      // Open popup window for OAuth
      const popup = window.open(
        data.authUrl,
        'garmin-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        alert('Popup blocked. Please allow popups for this site.');
        setConnectingGarmin(false);
        return;
      }

      // Listen for popup to close
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          setConnectingGarmin(false);
          // Refresh page to check connection status
          window.location.reload();
        }
      }, 500);

      // Listen for postMessage from callback
      const messageHandler = (event: MessageEvent) => {
        // Security: only accept messages from same origin
        if (event.origin !== window.location.origin) {
          console.warn('⚠️ Ignoring message from different origin:', event.origin);
          return;
        }
        
        console.log('📨 Received message from callback:', event.data);
        
        if (event.data.type === 'GARMIN_OAUTH_SUCCESS') {
          console.log('✅ Garmin OAuth success!');
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setConnectingGarmin(false);
          setGarminConnected(true);
          // Update localStorage
          localStorage.setItem('garminConnected', 'true');
          // Refresh to show updated status
          window.location.reload();
          window.removeEventListener('message', messageHandler);
        } else if (event.data.type === 'GARMIN_OAUTH_ERROR') {
          console.error('❌ Garmin OAuth error:', event.data.error);
          clearInterval(checkPopup);
          if (!popup.closed) popup.close();
          setConnectingGarmin(false);
          alert('Failed to connect Garmin: ' + (event.data.error || 'Unknown error'));
          window.removeEventListener('message', messageHandler);
        }
      };
      window.addEventListener('message', messageHandler);

    } catch (error: any) {
      console.error('Error connecting Garmin:', error);
      alert('Failed to connect Garmin: ' + (error.message || 'Unknown error'));
      setConnectingGarmin(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to continue</p>
          <button
            onClick={() => router.push('/signup')}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <Image
                src="/logo.jpg"
                alt="GoFast"
                width={32}
                height={32}
                className="w-8 h-8 rounded-full"
              />
              <span className="text-lg font-bold text-gray-900">GoFast</span>
            </div>
            <p className="text-xs text-gray-500">Athlete Home</p>
          </div>

          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {/* Home - Active */}
            <button
              onClick={() => router.push('/athlete-home')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200"
            >
              <Home className="h-5 w-5" />
              <span>Home</span>
            </button>

            {/* My RunCrews */}
            <button
              onClick={() => router.push('/my-runcrews')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <Users className="h-5 w-5" />
              <span>My RunCrews</span>
            </button>

            {/* Discover RunCrews */}
            <button
              onClick={() => router.push('/runcrew-discovery')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <Users className="h-5 w-5" />
              <span>Discover RunCrews</span>
            </button>

            {/* Activities */}
            <button
              onClick={() => router.push('/activities')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <Activity className="h-5 w-5" />
              <span>Activities</span>
            </button>

            {/* Race Events */}
            <button
              onClick={() => router.push('/race-events')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <Trophy className="h-5 w-5" />
              <span>Race Events</span>
            </button>

            {/* Profile */}
            <button
              onClick={() => router.push('/athlete-edit-profile')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <User className="h-5 w-5" />
              <span>Profile</span>
            </button>

            {/* Settings */}
            <button
              onClick={() => router.push('/settings')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Welcome Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {athlete.firstName}!
            </h1>
            <p className="text-gray-600">Here's what's happening with your RunCrews</p>
          </div>

          {/* Crew Hero Section */}
          <div className="mb-8">
            <CrewHero
              crew={runCrew}
              nextRun={nextRun}
              nextRunAttendees={nextRunAttendees}
              isCrewAdmin={isCrewAdmin}
              runCrewId={runCrewId}
            />
          </div>

          {/* Stats and Activities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Weekly Stats */}
            {garminConnected && weeklyTotals && (
              <WeeklyStats weeklyTotals={weeklyTotals} activities={weeklyActivities} />
            )}

            {/* Latest Activity */}
            {latestActivity && <LatestActivityCard latestActivity={latestActivity} />}
          </div>

          {/* Garmin Connection Prompt */}
          {!garminConnected && (
            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-orange-200 mb-8">
              <div className="flex items-center gap-4">
                <Image 
                  src="/Garmin_Connect_app_1024x1024-02.png" 
                  alt="Garmin Connect" 
                  width={48}
                  height={48}
                  className="rounded-lg flex-shrink-0"
                />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Connect Garmin to Track Activities
                  </h3>
                  <p className="text-gray-600">
                    Sync your runs automatically and see your stats on the leaderboard
                  </p>
                </div>
                <button
                  onClick={handleConnectGarmin}
                  disabled={connectingGarmin}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold transition disabled:opacity-50 whitespace-nowrap"
                >
                  {connectingGarmin ? 'Connecting...' : 'Connect →'}
                </button>
              </div>
            </div>
          )}

          {/* RSVP CTA */}
          {runCrew && nextRun && (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Your crew is running soon — RSVP now
                  </h3>
                  <p className="text-gray-600">
                    {nextRun.title || 'Upcoming run'} on{' '}
                    {nextRun.date
                      ? new Date(nextRun.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Date TBD'}
                  </p>
                </div>
                <button
                  onClick={handleGoToCrew}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  RSVP →
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
      </div>
    </div>
  );
}
