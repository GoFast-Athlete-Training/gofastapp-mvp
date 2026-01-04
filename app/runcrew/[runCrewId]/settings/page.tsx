'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';
import { Settings, Users, Trash2, Save, X } from 'lucide-react';

/**
 * RunCrew Settings Page - CLIENT-SIDE
 * 
 * Route: /runcrew/:runCrewId/settings
 * 
 * Purpose: Allow members to view and edit RunCrew settings
 * - View crew information
 * - Edit crew name, description, logo, icon (if admin)
 * - View members
 * - Leave crew (if not admin)
 * - Delete crew (admin only)
 */
export default function RunCrewSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const runCrewId = params.runCrewId as string;
  const hasFetchedRef = useRef(false);

  const [crew, setCrew] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Form state
  const [crewName, setCrewName] = useState('');
  const [crewDescription, setCrewDescription] = useState('');
  const [crewIcon, setCrewIcon] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    if (message) {
      setTimeout(() => setToast(null), 3000);
    }
  };

  useEffect(() => {
    if (!runCrewId) {
      setError('Missing runCrewId');
      setLoading(false);
      return;
    }

    if (hasFetchedRef.current) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (hasFetchedRef.current) {
        return;
      }

      if (!firebaseUser) {
        hasFetchedRef.current = true;
        router.push('/signup');
        return;
      }

      hasFetchedRef.current = true;

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
        setCrewName(crewData.name || '');
        setCrewDescription(crewData.description || '');
        setCrewIcon(crewData.meta?.icon || '');

        const currentMembership = crewData.membershipsBox?.memberships?.find(
          (m: any) => m.athleteId === athleteId
        );
        setMembership(currentMembership);

        setLoading(false);
      } catch (err: any) {
        console.error('❌ SETTINGS: Error fetching crew:', err);
        if (err.response?.status === 401) {
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

    return () => unsubscribe();
  }, [runCrewId, router]);

  const handleSave = async () => {
    if (!crew || !isAdmin) return;

    try {
      setIsSaving(true);
      const response = await api.put(`/runcrew/${runCrewId}`, {
        name: crewName.trim(),
        description: crewDescription.trim() || null,
        icon: crewIcon.trim() || null,
      });

      if (response.data.success) {
        showToast('Settings saved successfully');
        // Reload crew data
        const refreshResponse = await api.get(`/runcrew/${runCrewId}`);
        if (refreshResponse.data.success) {
          setCrew(refreshResponse.data.runCrew);
        }
      }
    } catch (err: any) {
      console.error('Error saving settings:', err);
      showToast(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!crew || !isAdmin) return;

    try {
      setIsDeleting(true);
      // TODO: Implement delete endpoint
      // const response = await api.delete(`/runcrew/${runCrewId}`);
      // if (response.data.success) {
      //   router.push('/welcome');
      // }
      showToast('Delete crew feature coming soon');
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error('Error deleting crew:', err);
      showToast(err.response?.data?.error || 'Failed to delete crew');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLeave = async () => {
    if (!crew || isAdmin) return; // Admins can't leave, must delete or transfer

    try {
      // TODO: Implement leave endpoint
      // const response = await api.post(`/runcrew/${runCrewId}/leave`);
      // if (response.data.success) {
      //   router.push('/welcome');
      // }
      showToast('Leave crew feature coming soon');
    } catch (err: any) {
      console.error('Error leaving crew:', err);
      showToast(err.response?.data?.error || 'Failed to leave crew');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error === 'unauthorized' || error === 'not_found' || error === 'forbidden') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {error === 'unauthorized' ? 'Authentication Required' : 
             error === 'not_found' ? 'RunCrew Not Found' : 'Access Denied'}
          </h2>
          <p className="text-gray-600 mb-4">
            {error === 'unauthorized' ? 'Please sign in to view settings.' :
             error === 'not_found' ? 'The RunCrew you\'re looking for doesn\'t exist.' :
             'You don\'t have access to this RunCrew.'}
          </p>
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

  if (error || !crew) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">Failed to load RunCrew settings.</p>
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

  const isAdmin = membership?.role === 'admin';
  const isManager = membership?.role === 'manager';
  const memberships = crew.membershipsBox?.memberships || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className="fixed top-6 right-6 bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {crew.meta?.logo ? (
                <img
                  src={crew.meta.logo}
                  alt={crew.name}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-gray-200 flex-shrink-0"
                />
              ) : crew.meta?.icon ? (
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl sm:text-3xl border-2 border-gray-200 flex-shrink-0">
                  {crew.meta.icon}
                </div>
              ) : null}
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-1">{crew.name}</p>
              </div>
            </div>
            <div className="flex gap-2 sm:gap-4 flex-shrink-0">
              <Link
                href={`/runcrew/${runCrewId}/member`}
                className="text-sm sm:text-base text-gray-600 hover:text-gray-900 px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-100 whitespace-nowrap"
              >
                ← Back to Crew
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-6">
          {/* General Settings */}
          <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-gray-600" />
              <h2 className="text-xl font-bold text-gray-900">General Settings</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Crew Name
                </label>
                <input
                  type="text"
                  value={crewName}
                  onChange={(e) => setCrewName(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={crewDescription}
                  onChange={(e) => setCrewDescription(e.target.value)}
                  disabled={!isAdmin}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Icon (Emoji)
                </label>
                <input
                  type="text"
                  value={crewIcon}
                  onChange={(e) => setCrewIcon(e.target.value)}
                  disabled={!isAdmin}
                  placeholder="🏃"
                  maxLength={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-2xl"
                />
                <p className="text-xs text-gray-500 mt-1">Single emoji character</p>
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}

              {!isAdmin && (
                <p className="text-sm text-gray-500 italic">Only admins can edit crew settings</p>
              )}
            </div>
          </section>

          {/* Members */}
          <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-gray-600" />
              <h2 className="text-xl font-bold text-gray-900">Members ({memberships.length})</h2>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {memberships.map((membershipItem: any) => {
                const athlete = membershipItem.athlete || {};
                return (
                  <div key={membershipItem.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    {athlete.photoURL ? (
                      <img
                        src={athlete.photoURL}
                        alt={`${athlete.firstName} ${athlete.lastName}`}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-semibold">
                        {(athlete.firstName?.[0] || 'A').toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {athlete.firstName || 'Athlete'} {athlete.lastName || ''}
                      </p>
                      {membershipItem.role === 'admin' && (
                        <span className="text-xs text-orange-600 font-bold">Admin</span>
                      )}
                      {membershipItem.role === 'manager' && (
                        <span className="text-xs text-blue-600 font-bold">Manager</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Danger Zone */}
          <section className="bg-white rounded-lg border-2 border-red-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-red-900 mb-6">Danger Zone</h2>

            <div className="space-y-4">
              {isAdmin ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Delete RunCrew</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Permanently delete this RunCrew. This action cannot be undone.
                    </p>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete RunCrew
                    </button>
                  </div>
                </>
              ) : (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Leave RunCrew</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Leave this RunCrew. You can rejoin later if you have the join code.
                  </p>
                  <button
                    onClick={handleLeave}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition"
                  >
                    Leave RunCrew
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Delete RunCrew?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{crew.name}</strong>? This action cannot be undone and all data will be permanently deleted.
            </p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

