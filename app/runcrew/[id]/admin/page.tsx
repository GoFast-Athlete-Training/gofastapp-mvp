'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';
import useHydratedAthlete from '@/hooks/useHydratedAthlete';

export default function RunCrewAdminPage() {
  const params = useParams();
  const router = useRouter();
  const crewId = params.id as string;
  const { athlete: hydratedAthlete } = useHydratedAthlete();
  
  // LOCAL-FIRST: Load from localStorage only - but defer until client-side to avoid hydration mismatch
  const [crew, setCrew] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  
  const [showRunForm, setShowRunForm] = useState(false);
  const [runForm, setRunForm] = useState({
    title: '',
    date: '',
    startTime: '',
    meetUpPoint: '',
    meetUpAddress: '',
    totalMiles: '',
    pace: '',
    description: '',
  });

  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const showToast = (message: string) => {
    setToast(message);
    if (message) {
      setTimeout(() => {
        setToast(null);
      }, 2400);
    }
  };

  // Load crew from localStorage
  useEffect(() => {
    setIsClient(true);
    const loadedCrew = LocalStorageAPI.getPrimaryCrew() || LocalStorageAPI.getRunCrewData();
    setCrew(loadedCrew);
    if (loadedCrew?.runs) {
      setRuns(loadedCrew.runs);
    }
    if (loadedCrew?.announcements) {
      setAnnouncements(loadedCrew.announcements);
    }
  }, []);

  // Load announcements from API
  const loadAnnouncements = useCallback(async () => {
    if (!crewId) return;
    
    try {
      setLoadingAnnouncements(true);
      setAnnouncementsError(null);
      
      const response = await api.get(`/runcrew/${crewId}/announcements`);
      
      if (response.data?.success && Array.isArray(response.data.announcements)) {
        setAnnouncements(response.data.announcements);
      } else {
        throw new Error(response.data?.error || 'Failed to load announcements');
      }
    } catch (error: any) {
      console.error('Failed to load announcements:', error);
      setAnnouncementsError(error.response?.data?.error || error.message || 'Failed to load announcements');
    } finally {
      setLoadingAnnouncements(false);
    }
  }, [crewId]);

  // Load runs from API
  const loadRuns = useCallback(async () => {
    if (!crewId) return;
    
    try {
      setLoadingRuns(true);
      setRunsError(null);
      
      const response = await api.get(`/runcrew/${crewId}/runs`);
      
      if (response.data?.success && Array.isArray(response.data.runs)) {
        setRuns(response.data.runs);
      } else {
        throw new Error(response.data?.error || 'Failed to load runs');
      }
    } catch (error: any) {
      console.error('Failed to load runs:', error);
      setRunsError(error.response?.data?.error || error.message || 'Failed to load runs');
    } finally {
      setLoadingRuns(false);
    }
  }, [crewId]);

  // Load data on mount
  useEffect(() => {
    if (isClient && crewId) {
      loadAnnouncements();
      loadRuns();
    }
  }, [isClient, crewId, loadAnnouncements, loadRuns]);

  const handleResync = useCallback(async () => {
    if (!crewId) {
      showToast('Missing crew context');
      return;
    }

    try {
      setSyncing(true);
      
      await Promise.all([
        loadAnnouncements(),
        loadRuns()
      ]);
      
      showToast('Crew data refreshed');
    } catch (error) {
      console.error('Failed to sync crew:', error);
      showToast('Failed to refresh crew data');
    } finally {
      setSyncing(false);
    }
  }, [crewId, loadAnnouncements, loadRuns]);

  // Don't render until client-side hydration is complete
  if (!isClient) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center space-y-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-gray-600 text-sm">Loading crew data...</p>
        </div>
      </main>
    );
  }

  // Verify user is an admin/manager before allowing access
  const isAdmin = crew?.userRole === 'admin' || crew?.userRole === 'manager';
  
  // NO REDIRECTS - Just render what we have, even if incomplete
  // If crew doesn't exist or ID doesn't match, show error
  if (!crew || crew.id !== crewId) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-red-800 font-semibold mb-2">Failed to Load Crew</h3>
            <p className="text-red-700 text-sm mb-4">
              Crew not found in localStorage. Please navigate from your crew page.
            </p>
            <button
              onClick={() => router.push('/runcrew')}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Go to Crew List
            </button>
          </div>
        </div>
      </main>
    );
  }
  
  // If not admin, show message instead of redirecting
  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full bg-white border border-gray-200 rounded-xl shadow-sm p-8 space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-red-800 font-semibold mb-2">Access Denied</h3>
            <p className="text-red-700 text-sm mb-4">
              You must be an admin to access this page.
            </p>
            <button
              onClick={() => router.push(`/runcrew/${crewId}`)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              Go to Crew Page
            </button>
          </div>
        </div>
      </main>
    );
  }

  const handleCreateRun = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await api.post(`/runcrew/${crewId}/runs`, {
        ...runForm,
        date: new Date(runForm.date).toISOString(),
        totalMiles: runForm.totalMiles ? parseFloat(runForm.totalMiles) : undefined,
      });
      
      if (response.data.success) {
        setShowRunForm(false);
        setRunForm({
          title: '',
          date: '',
          startTime: '',
          meetUpPoint: '',
          meetUpAddress: '',
          totalMiles: '',
          pace: '',
          description: '',
        });
        showToast('Run created successfully');
        await loadRuns();
      }
    } catch (error: any) {
      console.error('Error creating run:', error);
      showToast(error.response?.data?.error || 'Failed to create run');
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedTitle = announcementTitle.trim();
    const trimmedContent = announcementContent.trim();
    
    if (!trimmedTitle || !trimmedContent) {
      showToast('Please provide both title and content');
      return;
    }

    try {
      const response = await api.post(`/runcrew/${crewId}/announcements`, {
        title: trimmedTitle,
        content: trimmedContent,
      });
      
      if (response.data.success) {
        setAnnouncementTitle('');
        setAnnouncementContent('');
        showToast('Announcement posted successfully');
        await loadAnnouncements();
      }
    } catch (error: any) {
      console.error('Error posting announcement:', error);
      showToast(error.response?.data?.error || 'Failed to post announcement');
    }
  };

  const memberships = crew?.memberships || [];
  const inviteCode = crew?.joinCode || null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {toast && (
        <div className="fixed top-6 right-6 bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg z-30">
          {toast}
        </div>
      )}

      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.push(`/runcrew/${crewId}`)}
              className="text-gray-600 hover:text-gray-900"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{crew.name || 'RunCrew Admin'}</h1>
              <p className="text-sm text-gray-500">{currentDate}</p>
              <p className="mt-2 text-base text-gray-700">
                Welcome back{hydratedAthlete?.firstName ? `, ${hydratedAthlete.firstName}` : ''}! You're managing everything for this crew.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResync}
              disabled={syncing}
              className="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-sky-700 transition disabled:opacity-60"
            >
              {syncing ? 'Syncing…' : 'Re-sync Crew Data'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-10">
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
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {memberships.map((membership: any) => {
                    const athlete = membership.athlete || membership;
                    const managerRecord = Array.isArray(crew.managers)
                      ? crew.managers.find((manager: any) => manager.athleteId === athlete?.id && manager.role === 'admin')
                      : null;

                    return (
                      <div key={athlete?.id || membership.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                        {athlete?.photoURL ? (
                          <img
                            src={athlete.photoURL}
                            alt={`${athlete.firstName} ${athlete.lastName}`}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-semibold text-sm">
                            {(athlete?.firstName?.[0] || 'A').toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {athlete?.firstName || 'Athlete'} {athlete?.lastName || ''}
                            {managerRecord && <span className="text-orange-600 text-xs font-bold ml-1">Admin</span>}
                          </p>
                          {athlete?.email && (
                            <p className="text-xs text-gray-500 truncate">{athlete.email}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Invite Code Section */}
              {inviteCode && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Invite Code</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-lg font-bold text-gray-900 text-center">{inviteCode}</p>
                  </div>
                </div>
              )}
            </section>
          </aside>

          {/* MAIN CONTENT: Announcements, Runs */}
          <div className="lg:col-span-6 space-y-6">
            {/* Announcements */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Announcements</h2>
                  <p className="text-sm text-gray-500">Share updates with your crew</p>
                </div>
              </div>

              <form onSubmit={handlePostAnnouncement} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="Announcement title"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 mb-3"
                  />
                  <textarea
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    placeholder="What's happening next?"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-[100px]"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loadingAnnouncements || !announcementTitle.trim() || !announcementContent.trim()}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    {loadingAnnouncements ? 'Posting...' : 'Post Announcement'}
                  </button>
                </div>
              </form>

              {loadingAnnouncements && (
                <div className="text-center py-4 text-sm text-gray-500">Loading announcements...</div>
              )}

              {announcementsError && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-yellow-800 text-sm mb-2">{announcementsError}</p>
                  <button 
                    onClick={loadAnnouncements}
                    className="text-yellow-600 text-sm underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {!loadingAnnouncements && !announcementsError && announcements.length === 0 && (
                  <p className="text-sm text-gray-500">No announcements yet. Be the first to post one.</p>
                )}
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
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
                    <p className="text-sm text-gray-800 whitespace-pre-line">{announcement.content || announcement.text}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Runs Module */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Upcoming Runs</h3>
                  <button
                    onClick={() => setShowRunForm(!showRunForm)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm hover:shadow flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {showRunForm ? 'Cancel' : 'Create Run'}
                  </button>
                </div>

                {showRunForm && (
                  <form onSubmit={handleCreateRun} className="border border-gray-200 rounded-xl p-6 bg-gray-50 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Run Title"
                        required
                        value={runForm.title}
                        onChange={(e) => setRunForm({ ...runForm, title: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      />
                      <input
                        type="date"
                        required
                        value={runForm.date}
                        onChange={(e) => setRunForm({ ...runForm, date: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Start Time (e.g., 6:30 AM)"
                        required
                        value={runForm.startTime}
                        onChange={(e) => setRunForm({ ...runForm, startTime: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      />
                      <input
                        type="text"
                        placeholder="Meet-up Point"
                        required
                        value={runForm.meetUpPoint}
                        onChange={(e) => setRunForm({ ...runForm, meetUpPoint: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Address (optional)"
                      value={runForm.meetUpAddress}
                      onChange={(e) => setRunForm({ ...runForm, meetUpAddress: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Total Miles (optional)"
                        value={runForm.totalMiles}
                        onChange={(e) => setRunForm({ ...runForm, totalMiles: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      />
                      <input
                        type="text"
                        placeholder="Pace (optional)"
                        value={runForm.pace}
                        onChange={(e) => setRunForm({ ...runForm, pace: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      />
                    </div>
                    <textarea
                      placeholder="Description (optional)"
                      value={runForm.description}
                      onChange={(e) => setRunForm({ ...runForm, description: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      rows={3}
                    />
                    <button
                      type="submit"
                      className="w-full py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold transition"
                    >
                      Create Run
                    </button>
                  </form>
                )}

                {runs.length === 0 && !showRunForm && (
                  <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-500">
                    <p className="mb-2">No runs yet.</p>
                    <p>Click "Create Run" above to schedule the first run.</p>
                  </div>
                )}
                <div className="space-y-3">
                  {runs.map((run) => {
                    const formatRunDate = (run: any) => {
                      const candidate = run.date || run.scheduledAt || null;
                      if (!candidate) return 'Date TBD';
                      try {
                        return new Date(candidate).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        });
                      } catch (error) {
                        return candidate;
                      }
                    };

                    const rsvpCount = run.rsvps?.length || run._count?.rsvps || 0;
                    const goingCount = run.rsvps?.filter((r: any) => r.status === 'going').length || rsvpCount;
                    
                    return (
                      <div key={run.id} className="border border-gray-200 rounded-xl bg-gray-50 overflow-hidden">
                        <div className="px-4 py-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{run.title || 'Untitled Run'}</p>
                              <p className="text-xs text-gray-500">{formatRunDate(run)}</p>
                              {run.meetUpPoint && (
                                <p className="text-xs text-gray-500 mt-1">📍 {run.meetUpPoint}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                {goingCount} going
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT SIDEBAR: Stats */}
          <aside className="lg:col-span-3 space-y-6">
            {/* Crew Stats */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Crew Stats</h3>
              <div className="space-y-3">
                <div className="border border-gray-200 rounded-xl p-4 bg-gradient-to-br from-emerald-50 to-emerald-100">
                  <p className="text-xs uppercase tracking-wide text-gray-600 font-semibold">Upcoming Runs</p>
                  <p className="text-3xl font-bold text-emerald-700 mt-1">{runs.length}</p>
                  <p className="text-xs text-gray-600 mt-1">Keep the calendar full</p>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 bg-gradient-to-br from-blue-50 to-blue-100">
                  <p className="text-xs uppercase tracking-wide text-gray-600 font-semibold">Announcements</p>
                  <p className="text-3xl font-bold text-blue-700 mt-1">{announcements.length}</p>
                  <p className="text-xs text-gray-600 mt-1">Crew updates</p>
                </div>
              </div>
            </section>

            {/* Recent Messages */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Recent Messages</h3>
              {crew?.messages && crew.messages.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {crew.messages.slice(0, 5).map((message: any) => (
                    <div key={message.id} className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-900">
                          {message.athlete?.firstName || 'User'} {message.athlete?.lastName || ''}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(message.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-700">{message.content}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No messages</p>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
