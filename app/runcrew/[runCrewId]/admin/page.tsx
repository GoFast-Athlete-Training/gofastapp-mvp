'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';

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

  const [crew, setCrew] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Announcements state
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);

  // Runs state
  const [runs, setRuns] = useState<any[]>([]);
  const [showRunModal, setShowRunModal] = useState(false);
  const [runForm, setRunForm] = useState({
    title: '',
    date: '',
    time: '',
    meetUpPoint: '',
    meetUpAddress: '',
    totalMiles: '',
    pace: '',
    description: '',
  });
  const [loadingRuns, setLoadingRuns] = useState(false);

  const timeOptions = [
    '5:00 AM', '5:30 AM', '6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM',
    '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
    '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM'
  ];

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

      const response = await api.get(`/runcrew/${runCrewId}`);
      
      if (!response.data.success || !response.data.runCrew) {
        throw new Error('RunCrew not found');
      }

      const crewData = response.data.runCrew;
      setCrew(crewData);
      setAnnouncements(crewData.announcements || []);
      setRuns(crewData.runs || []);

      const currentMembership = crewData.memberships?.find(
        (m: any) => m.athleteId === athleteId
      );

      setMembership(currentMembership);

      if (!currentMembership || currentMembership.role !== 'admin') {
        setError('not_authorized');
        setLoading(false);
        return;
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching crew:', err);
      if (err.response?.status === 404) {
        setError('not_found');
      } else if (err.response?.status === 403) {
        setError('not_authorized');
      } else {
        setError('error');
      }
      setLoading(false);
    }
  }, [runCrewId, router]);

  const handleResync = useCallback(async () => {
    setSyncing(true);
    await loadCrewData();
    setSyncing(false);
    showToast('Crew data refreshed');
  }, [loadCrewData]);

  useEffect(() => {
    loadCrewData();
  }, [loadCrewData]);

  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runCrewId || !announcementTitle.trim() || !announcementContent.trim()) {
      return;
    }

    try {
      setLoadingAnnouncements(true);
      const response = await api.post(`/runcrew/${runCrewId}/announcements`, {
        title: announcementTitle.trim(),
        content: announcementContent.trim(),
      });

      if (response.data.success) {
        setAnnouncementTitle('');
        setAnnouncementContent('');
        await loadCrewData(); // Reload to get updated announcements
        showToast('Announcement posted successfully');
      }
    } catch (err: any) {
      console.error('Error posting announcement:', err);
      showToast(err.response?.data?.error || 'Failed to post announcement');
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
      const response = await api.post(`/runcrew/${runCrewId}/runs`, {
        title: runForm.title.trim(),
        date: isoDate,
        startTime: runForm.time,
        meetUpPoint: runForm.meetUpPoint.trim(),
        meetUpAddress: runForm.meetUpAddress.trim() || null,
        totalMiles: runForm.totalMiles ? parseFloat(runForm.totalMiles) : null,
        pace: runForm.pace || null,
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
          description: '',
        });
        setShowRunModal(false);
        await loadCrewData(); // Reload to get updated runs
        showToast('Run created successfully');
      }
    } catch (err: any) {
      console.error('Error creating run:', err);
      showToast(err.response?.data?.error || 'Failed to create run');
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
  if (error === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">RunCrew Not Found</h2>
          <p className="text-gray-600 mb-4">The RunCrew you're looking for doesn't exist.</p>
          <Link
            href="/welcome"
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
              href="/welcome"
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
            href="/welcome"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Back to RunCrews
          </Link>
        </div>
      </div>
    );
  }

  const memberships = crew.memberships || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className="fixed top-6 right-6 bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{crew.name} - Admin</h1>
              {crew.description && (
                <p className="text-gray-600 mt-2">{crew.description}</p>
              )}
            </div>
            <div className="flex gap-4">
              <Link
                href={`/runcrew/${runCrewId}/member`}
                className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                Member View
              </Link>
              <Link
                href="/welcome"
                className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100"
              >
                ← Back to RunCrews
              </Link>
              <button
                onClick={handleResync}
                disabled={syncing}
                className="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-sky-700 transition disabled:opacity-60"
              >
                {syncing ? 'Syncing…' : 'Re-sync Crew Data'}
              </button>
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
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {memberships.map((membership: any) => {
                    const athlete = membership.athlete || {};
                    return (
                      <div key={membership.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                        {athlete.photoURL ? (
                          <img
                            src={athlete.photoURL}
                            alt={`${athlete.firstName} ${athlete.lastName}`}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-semibold text-sm">
                            {(athlete.firstName?.[0] || 'A').toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {athlete.firstName || 'Athlete'} {athlete.lastName || ''}
                            {membership.role === 'admin' && <span className="text-orange-600 text-xs font-bold ml-1">Admin</span>}
                          </p>
                          {athlete.email && (
                            <p className="text-xs text-gray-500 truncate">{athlete.email}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {crew.joinCode && (
                <div className="mt-6 border border-dashed border-orange-300 rounded-xl px-4 py-3 bg-orange-50/60 text-sm text-gray-700">
                  <p className="font-semibold text-orange-600 mb-1">Invite Code:</p>
                  <code className="text-xs text-gray-600">{crew.joinCode}</code>
                </div>
              )}
            </section>
          </aside>

          {/* MAIN CONTENT: Announcements & Runs */}
          <div className="lg:col-span-6 space-y-6">
            {/* Announcements */}
            <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Announcements</h2>
                  <p className="text-sm text-gray-500">Share updates with your crew</p>
                </div>
              </div>

              <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
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

              <div className="space-y-4">
                {announcements.length === 0 && (
                  <p className="text-sm text-gray-500">No announcements yet. Be the first to post one.</p>
                )}
                {announcements.map((announcement: any) => (
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
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      setRunForm({
                        title: '',
                        date: tomorrow.toISOString().split('T')[0],
                        time: '',
                        meetUpPoint: '',
                        meetUpAddress: '',
                        totalMiles: '',
                        pace: '',
                        description: '',
                      });
                      setShowRunModal(true);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm hover:shadow flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Run
                  </button>
                </div>
                {runs.length === 0 && (
                  <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-500">
                    <p className="mb-2">No runs yet.</p>
                    <p>Click "Create Run" above to schedule the first run.</p>
                  </div>
                )}
                <div className="space-y-3">
                  {runs.map((run: any) => {
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
          </aside>
        </div>
      </main>

      {/* Run Modal */}
      {showRunModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Create Run</h2>
              <button 
                onClick={() => setShowRunModal(false)} 
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
                  <select
                    value={runForm.time}
                    onChange={(e) => setRunForm({ ...runForm, time: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    required
                  >
                    <option value="">Select time...</option>
                    {timeOptions.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
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
                <input
                  type="text"
                  value={runForm.meetUpAddress}
                  onChange={(e) => setRunForm({ ...runForm, meetUpAddress: e.target.value })}
                  placeholder="Start typing address..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
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
                  {loadingRuns ? 'Creating...' : 'Create Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
