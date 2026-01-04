'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';
import MessageFeed from '@/components/RunCrew/MessageFeed';
import { Copy, Check, Link as LinkIcon } from 'lucide-react';

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
  const [copiedCode, setCopiedCode] = useState(false);

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

        console.log(`✅ MEMBER PAGE: Crew loaded successfully: ${crewData.meta?.name}`);
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
            href="/athlete-home"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Home
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
            href="/athlete-home"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Home
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
            href="/athlete-home"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to Home
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
  const joinCode = crew.meta?.joinCode || '';
  const inviteUrl = joinCode ? `${typeof window !== 'undefined' ? window.location.origin : ''}/runcrew/join?code=${joinCode}` : '';

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
      // Fallback: select the input text
      const input = document.querySelector('input[value*="runcrew/join"]') as HTMLInputElement;
      if (input) {
        input.select();
        input.setSelectionRange(0, 99999);
      }
    }
  };

  const handleCopyCode = async () => {
    if (!joinCode) return;
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(joinCode);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = joinCode;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
      // Fallback: select the input text
      const input = document.querySelector(`input[value="${joinCode}"]`) as HTMLInputElement;
      if (input) {
        input.select();
        input.setSelectionRange(0, 99999);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {crew.meta?.logo ? (
                <img
                  src={crew.meta.logo}
                  alt={crew.meta?.name || 'RunCrew'}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-gray-200 flex-shrink-0"
                />
              ) : crew.meta?.icon ? (
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl sm:text-3xl border-2 border-gray-200 flex-shrink-0">
                  {crew.meta.icon}
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{crew.meta?.name}</h1>
                {crew.meta?.description && (
                  <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">{crew.meta.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 sm:gap-4 flex-shrink-0">
              <Link
                href={`/runcrew/${runCrewId}/settings`}
                className="text-sm sm:text-base text-gray-600 hover:text-gray-900 px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 whitespace-nowrap flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </Link>
              {isAdmin && (
                <Link
                  href={`/runcrew/${runCrewId}/admin`}
                  className="text-sm sm:text-base text-gray-600 hover:text-gray-900 px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 whitespace-nowrap"
                >
                  View as Admin
                </Link>
              )}
              <Link
                href="/welcome"
                className="text-sm sm:text-base text-gray-600 hover:text-gray-900 px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 whitespace-nowrap"
              >
                ← Back to RunCrews
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* 3-Column Layout: Members (Left) | Main Content (Center) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* LEFT SIDEBAR: Members */}
          <aside className="lg:col-span-3 space-y-6 min-w-0">
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
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {memberships.map((membershipItem: any) => {
                    const athlete = membershipItem.athlete || {};
                    return (
                      <div key={membershipItem.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded hover:bg-gray-50 transition">
                        {athlete.photoURL ? (
                          <img
                            src={athlete.photoURL}
                            alt={`${athlete.firstName} ${athlete.lastName}`}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-semibold text-xs">
                            {(athlete.firstName?.[0] || 'A').toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {athlete.firstName || 'Athlete'} {athlete.lastName || ''}
                            {membershipItem.role === 'admin' && <span className="text-orange-600 text-xs font-bold ml-1">Admin</span>}
                            {membershipItem.role === 'manager' && <span className="text-blue-600 text-xs font-bold ml-1">Manager</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Invite Section */}
            {joinCode && (
              <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 sticky top-6 mt-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Invite Teammates</h2>
                
                <div className="space-y-4">
                  {/* Invite URL */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Invite URL
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
                    <p className="text-xs text-gray-500 mt-1">Share this URL to invite members</p>
                  </div>

                  {/* Join Code */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Join Code
                    </label>
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="text"
                        value={joinCode}
                        readOnly
                        className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 font-mono font-bold text-center truncate"
                      />
                      <button
                        onClick={handleCopyCode}
                        className="px-3 sm:px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-1 sm:gap-2 flex-shrink-0"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Or share just the code</p>
                  </div>
                </div>
              </section>
            )}
          </aside>

          {/* MAIN CONTENT: Announcements First (Important!), then Messages */}
          <div className="lg:col-span-8 space-y-6 min-w-0">
            {/* Announcements Section - TOP PRIORITY */}
            <section className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border-2 border-orange-200 shadow-md p-4 sm:p-5 space-y-4 overflow-hidden">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{crew.meta?.name} Announcements</h2>
                <p className="text-xs text-gray-600 font-medium">
                  Official updates from your crew
                </p>
              </div>

              <div className="space-y-3">
                {crew.announcementsBox?.announcements && crew.announcementsBox.announcements.length > 0 ? (
                  crew.announcementsBox.announcements.map((announcement: any) => (
                    <div key={announcement.id} className="border border-orange-200 rounded-lg px-3 py-2 bg-white shadow-sm">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>
                          {announcement.author?.firstName
                            ? `${announcement.author.firstName}${announcement.author.lastName ? ` ${announcement.author.lastName}` : ''}`
                            : 'Admin'}
                        </span>
                        <span>
                          {announcement.createdAt
                            ? new Date(announcement.createdAt).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })
                            : 'Just now'}
                        </span>
                      </div>
                      {announcement.title && (
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">{announcement.title}</h4>
                      )}
                      <p className="text-xs text-gray-800 whitespace-pre-line">{announcement.content || announcement.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="border border-dashed border-orange-300 rounded-lg p-6 text-center bg-white/50">
                    <p className="text-xs text-gray-600 font-medium">No announcements yet.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Messages Section */}
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-5 overflow-hidden">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">RunCrew Chatter</h2>
                <p className="text-xs text-gray-500">Chat with your crew</p>
              </div>
              <MessageFeed 
                crewId={runCrewId}
                topics={crew.meta?.messageTopics || ['general', 'runs', 'social']}
                selectedTopic="general"
                isAdmin={isAdmin}
              />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
