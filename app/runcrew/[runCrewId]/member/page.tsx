'use client';


import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';
import MessageFeed from '@/components/RunCrew/MessageFeed';
import TopNav from '@/components/shared/TopNav';
import { Copy, Check, Link as LinkIcon } from 'lucide-react';
import { getRunCrewJoinLink } from '@/lib/domain-runcrew';
import MemberDetailCard from '@/components/RunCrew/MemberDetailCard';
import TrainingPanel from '@/components/RunCrew/TrainingPanel';

/**
 * Member Page - CLIENT-SIDE
 * 
 * Route: /runcrew/:runCrewId/member
 * 
 * Pattern:
 * - runCrewId from URL PARAMS (not localStorage)
 * - Wait for Firebase auth to be ready before making API calls
 * - Fetch crew data via API (API uses Firebase token from interceptor)
 */
export default function RunCrewMemberPage() {
  const params = useParams();
  const router = useRouter();
  const runCrewId = params.runCrewId as string;
  const hasFetchedRef = useRef(false);

  const [crew, setCrew] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Mock training week data (front-end only)
  const trainingWeek = {
    coach: {
      name: "Coach Sarah",
      avatarUrl: "/avatar.png",
    },
    coachAdvice: "Focus on consistency this week. If you miss a day, don't chase it. Listen to your body and adjust as needed.",
    weekOutlook: {
      focus: "Aerobic consistency",
      intensity: "Moderate",
      goal: "Finish the week feeling strong",
    },
    trainings: [
      {
        role: "Easy Run",
        title: "Easy Miles",
        miles: 5,
        effort: "Easy / Conversational",
        notes: "Keep it relaxed.",
      },
      {
        role: "Quality Workout",
        title: "Tempo Run",
        miles: 6,
        effort: "10K effort + 10 sec",
        notes: "Stay controlled.",
      },
      {
        role: "Long Run",
        title: "Long Run",
        miles: 10,
        effort: "Marathon effort",
        notes: "Finish smooth.",
      },
    ],
  };

  useEffect(() => {
    if (!runCrewId) {
      setError('Missing runCrewId');
      setLoading(false);
      return;
    }

    // Prevent multiple fetches
    if (hasFetchedRef.current) {
      return;
    }

    // Wait for Firebase auth to be ready before making API calls
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Already fetched, ignore
      if (hasFetchedRef.current) {
        return;
      }

      // No Firebase user - redirect to signup
      if (!firebaseUser) {
        hasFetchedRef.current = true;
        console.warn('⚠️ MEMBER PAGE: No Firebase user - redirecting to signup');
        router.push('/signup');
        return;
      }

      // Mark as fetched immediately to prevent re-runs
      hasFetchedRef.current = true;

      // Get athleteId from localStorage (for reference, but API uses Firebase token)
      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        console.warn('⚠️ MEMBER PAGE: No athleteId in localStorage - redirecting to signup');
        router.push('/signup');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log(`🔍 MEMBER PAGE: Fetching crew ${runCrewId}...`);

        // Fetch crew data via API (API uses Firebase token from interceptor)
        const response = await api.get(`/runcrew/${runCrewId}`);
        
        if (!response.data.success || !response.data.runCrew) {
          throw new Error('RunCrew not found');
        }

        const crewData = response.data.runCrew;
        setCrew(crewData);

        // Find current user's membership to check if they're admin
        const currentMembership = crewData.membershipsBox?.memberships?.find(
          (m: any) => m.athleteId === athleteId
        );
        setMembership(currentMembership);

        console.log(`✅ MEMBER PAGE: Crew loaded successfully: ${crewData.runCrewBaseInfo?.name}`);
        setLoading(false);
      } catch (err: any) {
        console.error('❌ MEMBER PAGE: Error fetching crew:', err);
        if (err.response?.status === 401) {
          // 401 is handled by API interceptor (redirects to signup)
          setError('unauthorized');
        } else if (err.response?.status === 404) {
          setError('not_found');
        } else if (err.response?.status === 403) {
          setError('forbidden');
        } else {
          setError('error');
        }
        setLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [runCrewId, router]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading crew...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (error === 'unauthorized') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please sign in to view this RunCrew.</p>
          <Link
            href="/signup"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">RunCrew Not Found</h2>
          <p className="text-gray-600 mb-4">The RunCrew you're looking for doesn't exist.</p>
          <Link
            href="/my-runcrews"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            My RunCrews
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'forbidden') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You don't have access to this RunCrew.</p>
          <Link
            href="/my-runcrews"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            My RunCrews
          </Link>
        </div>
      </div>
    );
  }

  if (error || !crew) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">Failed to load RunCrew data.</p>
          <Link
            href="/my-runcrews"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            My RunCrews
          </Link>
        </div>
      </div>
    );
  }

  // Check if user is admin or manager (can post announcements)
  const isAdmin = membership?.role === 'admin';
  const isManager = membership?.role === 'manager';
  const canPostAnnouncements = isAdmin || isManager;
  const memberships = crew.membershipsBox?.memberships || [];
  // Use handle-based join link (public front door)
  const handle = crew.runCrewBaseInfo?.handle || crew.handle;
  const inviteUrl = handle 
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${getRunCrewJoinLink(handle)}`
    : '';

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(inviteUrl);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = inviteUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <TopNav />
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {crew.runCrewBaseInfo?.logo ? (
                <img
                  src={crew.runCrewBaseInfo.logo}
                  alt={crew.runCrewBaseInfo?.name || 'RunCrew'}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-gray-200 flex-shrink-0"
                />
              ) : crew.runCrewBaseInfo?.icon ? (
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl sm:text-3xl border-2 border-gray-200 flex-shrink-0">
                  {crew.runCrewBaseInfo.icon}
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{crew.runCrewBaseInfo?.name}</h1>
                {crew.runCrewBaseInfo?.description && (
                  <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">{crew.runCrewBaseInfo.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 sm:gap-4 flex-shrink-0">
              {isAdmin && (
                <Link
                  href={`/runcrew/${runCrewId}/admin`}
                  className="text-sm sm:text-base text-gray-600 hover:text-gray-900 px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 whitespace-nowrap"
                >
                  View as Admin
                </Link>
              )}
              <Link
                href="/my-runcrews"
                className="text-sm sm:text-base text-gray-600 hover:text-gray-900 px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 whitespace-nowrap"
              >
                ← My RunCrews
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* 3-Column Layout: Members + Chatter (Left) | Training (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* LEFT SIDEBAR: Members + Chatter */}
          <aside className="lg:col-span-4 space-y-6 min-w-0">
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 sticky top-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Members</h2>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{memberships.length}</span>
              </div>

              {memberships.length === 0 ? (
                <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-500">
                  <p className="mb-2">No members yet.</p>
                  <p>Share your invite code to build the crew.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {memberships.map((membershipItem: any) => (
                    <MemberDetailCard
                      key={membershipItem.id}
                      member={{
                        id: membershipItem.id,
                        athleteId: membershipItem.athleteId,
                        role: membershipItem.role,
                        athlete: membershipItem.athlete || {},
                        joinedAt: membershipItem.joinedAt,
                      }}
                      showRole={true}
                      currentUserId={LocalStorageAPI.getAthleteId() ?? undefined}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Invite Section */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 sticky top-6 mt-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Invite Teammates</h2>
              
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                  Invite Link
                </label>
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="text"
                    value={inviteUrl}
                    readOnly
                    className="flex-1 min-w-0 px-3 py-2 text-xs border border-gray-300 rounded-lg bg-gray-50 font-mono truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 sm:px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-1 sm:gap-2 flex-shrink-0"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Share this link to invite members</p>
              </div>
            </section>

            {/* Messages Section - Moved to Left Sidebar */}
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-5 overflow-hidden min-w-0">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">RunCrew Chatter</h2>
                <p className="text-xs text-gray-500">Chat with your crew</p>
              </div>
              <MessageFeed 
                crewId={runCrewId}
                topics={crew.runCrewBaseInfo?.messageTopics || ['#general', '#runs', '#training tips', '#myvictories', '#social']}
                selectedTopic="#general"
                isAdmin={isAdmin}
              />
            </section>
          </aside>

          {/* RIGHT SIDE: Training Panel */}
          <div className="lg:col-span-8 space-y-6 min-w-0">
            <TrainingPanel trainingWeek={trainingWeek} />
          </div>
        </div>
      </main>
    </div>
  );
}
