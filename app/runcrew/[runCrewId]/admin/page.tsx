'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';
import MessageFeed from '@/components/RunCrew/MessageFeed';
import TopNav from '@/components/shared/TopNav';
import GooglePlacesAutocomplete from '@/components/RunCrew/GooglePlacesAutocomplete';

/**
 * Admin Page - CLIENT-SIDE
 * 
 * Route: /runcrew/:runCrewId/admin
 * 
 * Pattern:
 * - runCrewId from URL PARAMS (not localStorage)
 * - athleteId from localStorage (authorization only)
 * - Fetch crew data via API
 * - Check role via API response
 */
export default function RunCrewAdminPage() {
  const params = useParams();
  const router = useRouter();
  const runCrewId = params.runCrewId as string;
  const hasFetchedRef = useRef(false);

  const [crew, setCrew] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Announcements state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState<any | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);

  // Runs state
  const [runs, setRuns] = useState<any[]>([]);
  const [showRunModal, setShowRunModal] = useState(false);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [runForm, setRunForm] = useState({
    title: '',
    date: '',
    time: '',
    meetUpPoint: '',
    meetUpAddress: '',
    totalMiles: '',
    pace: '',
    stravaMapUrl: '',
    description: '',
  });
  const [loadingRuns, setLoadingRuns] = useState(false);

  // Message Topics (read-only for MVP1 - fixed defaults, Slack-style with # prefix)
  const defaultTopics = ['#general', '#runs', '#training tips', '#myvictories', '#social'];

  const paceOptions = [
    '6:00-6:30', '6:30-7:00', '7:00-7:30', '7:30-8:00', '8:00-8:30', '8:30-9:00',
    '9:00-9:30', '9:30-10:00', '10:00-10:30', '10:30-11:00', '11:00+'
  ];

  const showToast = (message: string) => {
    setToast(message);
    if (message) {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const loadCrewData = useCallback(async () => {
    if (!runCrewId) return;

    const athleteId = LocalStorageAPI.getAthleteId();
    if (!athleteId) {
      router.push('/signup');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`🔍 ADMIN PAGE: Fetching crew ${runCrewId}...`);

      const response = await api.get(`/runcrew/${runCrewId}`);
      
      if (!response.data.success || !response.data.runCrew) {
        throw new Error('RunCrew not found');
      }

      const crewData = response.data.runCrew;
      setCrew(crewData);
      const announcementsList = crewData.announcementsBox?.announcements || [];
      setAnnouncements(announcementsList);
      // Only one active announcement per crew
      setActiveAnnouncement(announcementsList.length > 0 ? announcementsList[0] : null);
      setRuns(crewData.runsBox?.runs || []);
      // Topics are fixed defaults for MVP1 (no add/remove functionality)

      const currentMembership = crewData.membershipsBox?.memberships?.find(
        (m: any) => m.athleteId === athleteId
      );

      setMembership(currentMembership);
      
      // Set current user profile for header display
      const athlete = LocalStorageAPI.getAthlete();
      setCurrentUser(athlete);

      console.log(`✅ ADMIN PAGE: Crew loaded successfully: ${crewData.runCrewBaseInfo?.name}`);
      setLoading(false);
    } catch (err: any) {
      console.error('❌ ADMIN PAGE: Error fetching crew:', err);
      if (err.response?.status === 401) {
        // 401 is handled by API interceptor (redirects to signup)
        setError('unauthorized');
      } else if (err.response?.status === 404) {
        setError('not_found');
      } else if (err.response?.status === 403) {
        setError('not_authorized');
      } else {
        setError('error');
      }
      setLoading(false);
    }
  }, [runCrewId, router]);

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
        console.warn('⚠️ ADMIN PAGE: No Firebase user - redirecting to signup');
        router.push('/signup');
        return;
      }

      // Mark as fetched immediately to prevent re-runs
      hasFetchedRef.current = true;

      // Load crew data now that auth is ready
      await loadCrewData();
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, [runCrewId, router, loadCrewData]);

  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runCrewId || !announcementTitle.trim() || !announcementContent.trim()) {
      return;
    }

    try {
      setLoadingAnnouncements(true);
      
      if (editingAnnouncementId) {
        // Update existing announcement
        const response = await api.put(`/runcrew/${runCrewId}/announcements/${editingAnnouncementId}`, {
          title: announcementTitle.trim(),
          content: announcementContent.trim(),
        });

        if (response.data.success) {
          setAnnouncementTitle('');
          setAnnouncementContent('');
          setEditingAnnouncementId(null);
          await loadCrewData();
          showToast('Announcement updated successfully');
        }
      } else {
        // Create new announcement (will archive old one)
        const response = await api.post(`/runcrew/${runCrewId}/announcements`, {
          title: announcementTitle.trim(),
          content: announcementContent.trim(),
        });

        if (response.data.success) {
          setAnnouncementTitle('');
          setAnnouncementContent('');
          await loadCrewData();
          showToast('Announcement posted successfully');
        }
      }
    } catch (err: any) {
      console.error('Error saving announcement:', err);
      showToast(err.response?.data?.error || `Failed to ${editingAnnouncementId ? 'update' : 'post'} announcement`);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const handleEditAnnouncement = (announcement: any) => {
    setEditingAnnouncementId(announcement.id);
    setAnnouncementTitle(announcement.title || '');
    setAnnouncementContent(announcement.content || '');
  };

  const handleCancelEdit = () => {
    setEditingAnnouncementId(null);
    setAnnouncementTitle('');
    setAnnouncementContent('');
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!confirm('Are you sure you want to delete this announcement? It will be archived and can be retrieved later.')) {
      return;
    }

    try {
      setLoadingAnnouncements(true);
      const response = await api.delete(`/runcrew/${runCrewId}/announcements/${announcementId}`);
      
      if (response.data.success) {
        await loadCrewData();
        showToast('Announcement deleted successfully');
      }
    } catch (err: any) {
      console.error('Error deleting announcement:', err);
      showToast(err.response?.data?.error || 'Failed to delete announcement');
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const handleRunSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runCrewId || !runForm.title.trim() || !runForm.date || !runForm.time || !runForm.meetUpPoint.trim()) {
      showToast('Please fill in all required fields');
      return;
    }

    // Convert time from "6:30 AM" format to "06:30:00" (24-hour ISO format)
    const convertTimeTo24Hour = (timeStr: string) => {
      if (!timeStr) return '00:00:00';
      
      // If already in 24-hour format, return as-is
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr) && !timeStr.includes('AM') && !timeStr.includes('PM')) {
        return timeStr.includes(':') && timeStr.split(':').length === 2 ? `${timeStr}:00` : timeStr;
      }
      
      // Parse "6:30 AM" or "6:30 PM" format
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (!match) {
        console.warn('Invalid time format:', timeStr);
        return '00:00:00';
      }
      
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const period = match[3].toUpperCase();
      
      if (period === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }
      
      return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
    };

    const time24Hour = convertTimeTo24Hour(runForm.time);
    const isoDate = `${runForm.date}T${time24Hour}`;

    try {
      setLoadingRuns(true);
      
      if (editingRunId) {
        // Update existing run
        const response = await api.put(`/runcrew/${runCrewId}/runs/${editingRunId}`, {
          title: runForm.title.trim(),
          date: isoDate,
          startTime: runForm.time,
          meetUpPoint: runForm.meetUpPoint.trim(),
          meetUpAddress: runForm.meetUpAddress.trim() || null,
          totalMiles: runForm.totalMiles ? parseFloat(runForm.totalMiles) : null,
          pace: runForm.pace || null,
          stravaMapUrl: runForm.stravaMapUrl.trim() || null,
          description: runForm.description.trim() || null,
        });

        if (response.data.success) {
          setRunForm({
            title: '',
            date: '',
            time: '',
            meetUpPoint: '',
            meetUpAddress: '',
            totalMiles: '',
            pace: '',
            stravaMapUrl: '',
            description: '',
          });
          setEditingRunId(null);
          setShowRunModal(false);
          await loadCrewData(); // Reload to get updated runs
          showToast('Run updated successfully');
        }
      } else {
        // Create new run
        const response = await api.post(`/runcrew/${runCrewId}/runs`, {
          title: runForm.title.trim(),
          date: isoDate,
          startTime: runForm.time,
          meetUpPoint: runForm.meetUpPoint.trim(),
          meetUpAddress: runForm.meetUpAddress.trim() || null,
          totalMiles: runForm.totalMiles ? parseFloat(runForm.totalMiles) : null,
          pace: runForm.pace || null,
          stravaMapUrl: runForm.stravaMapUrl.trim() || null,
          description: runForm.description.trim() || null,
        });

        if (response.data.success) {
          setRunForm({
            title: '',
            date: '',
            time: '',
            meetUpPoint: '',
            meetUpAddress: '',
            totalMiles: '',
            pace: '',
            stravaMapUrl: '',
            description: '',
          });
          setShowRunModal(false);
          await loadCrewData(); // Reload to get updated runs
          showToast('Run created successfully');
        }
      }
    } catch (err: any) {
      console.error('Error saving run:', err);
      showToast(err.response?.data?.error || `Failed to ${editingRunId ? 'update' : 'create'} run`);
    } finally {
      setLoadingRuns(false);
    }
  };

  const formatRunDate = (run: any) => {
    const date = run.date || run.scheduledAt;
    if (!date) return 'Date TBD';
    try {
      return new Date(date).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return date;
    }
  };

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch {
      return '';
    }
  };

  const handleEditRun = (run: any) => {
    setEditingRunId(run.id);
    setRunForm({
      title: run.title || '',
      date: formatDateForInput(run.date || run.scheduledAt),
      time: run.startTime || '',
      meetUpPoint: run.meetUpPoint || '',
      meetUpAddress: run.meetUpAddress || '',
      totalMiles: run.totalMiles ? run.totalMiles.toString() : '',
      pace: run.pace || '',
      stravaMapUrl: run.stravaMapUrl || '',
      description: run.description || '',
    });
    setShowRunModal(true);
  };

  const handleDeleteRun = async (runId: string, runTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${runTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoadingRuns(true);
      const response = await api.delete(`/runcrew/${runCrewId}/runs/${runId}`);
      if (response.data.success) {
        showToast('Run deleted successfully');
        await loadCrewData(); // Reload to get updated runs
      }
    } catch (err: any) {
      console.error('Error deleting run:', err);
      showToast(err.response?.data?.error || 'Failed to delete run');
    } finally {
      setLoadingRuns(false);
    }
  };

  // Topic add/remove removed for MVP1 - using fixed defaults

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
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
            href="/runcrew"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to RunCrews
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'not_authorized') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Not Authorized</h2>
          <p className="text-gray-600 mb-4">
            You must be an admin to access this page.
          </p>
          <div className="flex gap-4">
            <Link
            href={`/runcrew/${runCrewId}/member`}
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Go to Member View
            </Link>
            <Link
              href="/runcrew"
              className="inline-block bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
            >
              Back to RunCrews
            </Link>
          </div>
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
            href="/runcrew"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to RunCrews
          </Link>
        </div>
      </div>
    );
  }

  const memberships = crew.membershipsBox?.memberships || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      {toast && (
        <div className="fixed top-6 right-6 bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{crew.runCrewBaseInfo?.name} - Admin</h1>
              {crew.runCrewBaseInfo?.description && (
                <p className="text-gray-600 mt-2">{crew.runCrewBaseInfo.description}</p>
              )}
            </div>
            <div className="flex gap-4">
              <Link
                href={`/runcrew/${runCrewId}/settings`}
                className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </Link>
              <Link
                href={`/runcrew/${runCrewId}/member`}
                className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Member View
              </Link>
              <Link
                href="/runcrew"
                className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* 3-Column Layout: Members (Left) | Main Content (Center) | Stats (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT SIDEBAR: Members */}
          <aside className="lg:col-span-3 space-y-6">
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-6">
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
                  {memberships.map((membership: any) => {
                    // API returns Athlete (capital A), not athlete
                    const athlete = membership.Athlete || membership.athlete || {};
                    const displayName = athlete.firstName && athlete.lastName
                      ? `${athlete.firstName} ${athlete.lastName}`
                      : athlete.firstName || athlete.gofastHandle || 'Athlete';
                    return (
                      <div key={membership.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded hover:bg-gray-50 transition">
                        {athlete.photoURL ? (
                          <img
                            src={athlete.photoURL}
                            alt={displayName}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-semibold text-xs">
                            {(athlete.firstName?.[0] || athlete.gofastHandle?.[0] || 'A').toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {displayName}
                            {membership.role === 'admin' && <span className="text-orange-600 text-xs font-bold ml-1">Admin</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>

          {/* MAIN CONTENT: Announcements, Runs, and Messages */}
          <div className="lg:col-span-8 space-y-6 min-w-0">
            {/* Announcements Section */}
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4 min-w-0">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Announcements</h2>
                <p className="text-xs text-gray-500">Share updates with your crew</p>
              </div>

              <form onSubmit={handleAnnouncementSubmit} className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="Announcement title"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 mb-2"
                  />
                  <textarea
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    placeholder="What's happening next?"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-[80px]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  {editingAnnouncementId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="border border-gray-300 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loadingAnnouncements || !announcementTitle.trim() || !announcementContent.trim()}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition"
                  >
                    {loadingAnnouncements ? (editingAnnouncementId ? 'Updating...' : 'Posting...') : (editingAnnouncementId ? 'Update' : 'Post')}
                  </button>
                </div>
              </form>

              {/* Active Announcement Display */}
              {activeAnnouncement ? (
                <div className="border border-gray-200 rounded-lg px-4 py-3 bg-gray-50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        {/* Author Profile Picture */}
                        {(activeAnnouncement.Athlete || activeAnnouncement.athlete) && (
                          <>
                            {(activeAnnouncement.Athlete || activeAnnouncement.athlete)?.photoURL ? (
                              <img
                                src={(activeAnnouncement.Athlete || activeAnnouncement.athlete).photoURL}
                                alt={(activeAnnouncement.Athlete || activeAnnouncement.athlete).firstName || 'Author'}
                                className="w-6 h-6 rounded-full object-cover border border-gray-200"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-semibold border border-gray-200">
                                {((activeAnnouncement.Athlete || activeAnnouncement.athlete)?.firstName?.[0] || 'A').toUpperCase()}
                              </div>
                            )}
                            <span>
                              {(activeAnnouncement.Athlete || activeAnnouncement.athlete)?.firstName
                                ? `${(activeAnnouncement.Athlete || activeAnnouncement.athlete).firstName}${(activeAnnouncement.Athlete || activeAnnouncement.athlete).lastName ? ` ${(activeAnnouncement.Athlete || activeAnnouncement.athlete).lastName}` : ''}`
                                : 'Admin'}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span>
                          {activeAnnouncement.createdAt
                            ? new Date(activeAnnouncement.createdAt).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })
                            : 'Just now'}
                        </span>
                      </div>
                      {activeAnnouncement.title && (
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">{activeAnnouncement.title}</h4>
                      )}
                      <p className="text-xs text-gray-800 whitespace-pre-line">{activeAnnouncement.content || activeAnnouncement.text}</p>
                    </div>
                    <div className="flex gap-2 ml-4 flex-shrink-0">
                      <button
                        onClick={() => handleEditAnnouncement(activeAnnouncement)}
                        className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-xs font-semibold transition"
                        disabled={loadingAnnouncements}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(activeAnnouncement.id)}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition"
                        disabled={loadingAnnouncements}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500">No active announcement. Post one above to share updates with your crew.</p>
              )}
            </section>

            {/* Runs Section */}
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Upcoming Runs</h2>
                  <p className="text-xs text-gray-500">Schedule and manage crew runs</p>
                </div>
                <button
                  onClick={() => setShowRunModal(true)}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Run
                </button>
              </div>

              <div className="space-y-3">
                {runs.length === 0 ? (
                  <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <p className="text-sm text-gray-500 mb-2">No runs scheduled yet.</p>
                    <button
                      onClick={() => setShowRunModal(true)}
                      className="text-orange-600 hover:text-orange-700 text-sm font-semibold"
                    >
                      Create your first run →
                    </button>
                  </div>
                ) : (
                  runs.map((run: any) => (
                    <div
                      key={run.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <Link
                          href={`/runcrew/${runCrewId}/runs/${run.id}`}
                          className="flex-1 min-w-0"
                        >
                          <h3 className="text-sm font-semibold text-gray-900 mb-1 hover:text-orange-600">{run.title || 'Untitled Run'}</h3>
                          {/* Creator Info */}
                          {run.athlete && (
                            <div className="flex items-center gap-2 mb-2">
                              {run.athlete.photoURL ? (
                                <img
                                  src={run.athlete.photoURL}
                                  alt={run.athlete.firstName || 'Creator'}
                                  className="w-5 h-5 rounded-full object-cover border border-gray-200"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-semibold border border-gray-200">
                                  {(run.athlete.firstName?.[0] || 'C').toUpperCase()}
                                </div>
                              )}
                              <span className="text-xs text-gray-500">
                                Created by {run.athlete.firstName || 'Admin'}
                              </span>
                            </div>
                          )}
                          <div className="text-xs text-gray-600 space-y-1">
                            <p className="flex items-center gap-1">
                              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="truncate">{formatRunDate(run)}</span>
                            </p>
                            {run.meetUpPoint && (
                              <p className="flex items-center gap-1">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="truncate">{run.meetUpPoint}</span>
                              </p>
                            )}
                            {run.meetUpAddress && (
                              <p className="flex items-center gap-1 text-gray-500">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="truncate">{run.meetUpAddress}</span>
                              </p>
                            )}
                            {(run.totalMiles || run.pace) && (
                              <p className="flex items-center gap-1">
                                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span className="truncate">
                                  {run.totalMiles ? `${run.totalMiles} miles` : ''}
                                  {run.totalMiles && run.pace ? ' • ' : ''}
                                  {run.pace ? `${run.pace} pace` : ''}
                                </span>
                              </p>
                            )}
                          </div>
                        </Link>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handleEditRun(run);
                            }}
                            className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-xs font-semibold transition"
                            disabled={loadingRuns}
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              handleDeleteRun(run.id, run.title);
                            }}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition"
                            disabled={loadingRuns}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Messages Management Section */}
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 min-w-0">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Crew Messages</h2>
                <p className="text-xs text-gray-500">View and manage all crew messages (admin can edit/delete any)</p>
              </div>
              <MessageFeed 
                crewId={runCrewId}
                topics={defaultTopics}
                selectedTopic="#general"
                isAdmin={true}
              />
            </section>

          </div>
        </div>
      </main>

      {/* Run Modal */}
      {showRunModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editingRunId ? 'Edit Run' : 'Create Run'}</h2>
              <button 
                onClick={() => {
                  setShowRunModal(false);
                  setEditingRunId(null);
                  setRunForm({
                    title: '',
                    date: '',
                    time: '',
                    meetUpPoint: '',
                    meetUpAddress: '',
                    totalMiles: '',
                    pace: '',
                    stravaMapUrl: '',
                    description: '',
                  });
                }} 
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleRunSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Title *</label>
                  <input
                    type="text"
                    value={runForm.title}
                    onChange={(e) => setRunForm({ ...runForm, title: e.target.value })}
                    placeholder="Saturday Sunrise Run"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Date *</label>
                  <input
                    type="date"
                    value={runForm.date}
                    onChange={(e) => setRunForm({ ...runForm, date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Start Time *</label>
                  <input
                    type="text"
                    value={runForm.time}
                    onChange={(e) => setRunForm({ ...runForm, time: e.target.value })}
                    placeholder="6:15 AM"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Meet-Up Point *</label>
                  <input
                    type="text"
                    value={runForm.meetUpPoint}
                    onChange={(e) => setRunForm({ ...runForm, meetUpPoint: e.target.value })}
                    placeholder="Central Park – Bethesda Terrace"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Meetup Address</label>
                <GooglePlacesAutocomplete
                  value={runForm.meetUpAddress}
                  onChange={(e) => {
                    // Always allow manual typing - this works whether autocomplete is enabled or not
                    setRunForm({ ...runForm, meetUpAddress: e.target.value });
                  }}
                  onPlaceSelected={(placeData) => {
                    // When place is selected from autocomplete dropdown, use the formatted address
                    // This is optional - manual typing still works
                    setRunForm({ ...runForm, meetUpAddress: placeData.address });
                  }}
                  placeholder="Type address or select from suggestions..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  disabled={loadingRuns}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Miles</label>
                  <input
                    type="number"
                    step="0.1"
                    value={runForm.totalMiles}
                    onChange={(e) => setRunForm({ ...runForm, totalMiles: e.target.value })}
                    placeholder="5.0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Pace (min/mile)</label>
                  <select
                    value={runForm.pace}
                    onChange={(e) => setRunForm({ ...runForm, pace: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="">Select pace...</option>
                    {paceOptions.map((pace) => (
                      <option key={pace} value={pace}>{pace}</option>
                    ))}
                  </select>
                      </div>
                    </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Strava Route URL</label>
                <input
                  type="url"
                  value={runForm.stravaMapUrl}
                  onChange={(e) => setRunForm({ ...runForm, stravaMapUrl: e.target.value })}
                  placeholder="https://www.strava.com/routes/..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Description</label>
                <textarea
                  value={runForm.description}
                  onChange={(e) => setRunForm({ ...runForm, description: e.target.value })}
                  placeholder="Tell your crew what to expect..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
                  </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowRunModal(false)}
                  className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingRuns}
                  className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {loadingRuns ? (editingRunId ? 'Updating...' : 'Creating...') : (editingRunId ? 'Update Run' : 'Create Run')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
