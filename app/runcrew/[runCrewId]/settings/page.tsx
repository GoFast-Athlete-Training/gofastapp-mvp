'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';
import { Settings, Users, Trash2, Save, ArrowLeft, Info, Archive } from 'lucide-react';
import SettingsAppShell from '@/components/RunCrew/SettingsAppShell';
import TopNav from '@/components/shared/TopNav';

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
  const [crewLogo, setCrewLogo] = useState('');
  
  // Original values for comparison (to show save buttons)
  const [originalName, setOriginalName] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');
  const [originalIcon, setOriginalIcon] = useState('');
  const [originalLogo, setOriginalLogo] = useState('');
  
  // Individual field saving states
  const [savingName, setSavingName] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  const [savingIcon, setSavingIcon] = useState(false);
  const [savingLogo, setSavingLogo] = useState(false);
  
  // RunCrew Graphic UX mode
  const [graphicMode, setGraphicMode] = useState<'view' | 'edit'>('view');
  
  // Settings navigation
  const [activeSection, setActiveSection] = useState<'info' | 'manager' | 'lifecycle'>('info');
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [deletedCrewName, setDeletedCrewName] = useState('');
  
  // Add Admin/Manager modal state
  const [showAddManagerModal, setShowAddManagerModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'manager'>('manager');
  const [isAddingManager, setIsAddingManager] = useState(false);

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

      // NEW CANON: athleteId from localStorage only
      const athleteId = LocalStorageAPI.getAthleteId();
      if (!athleteId) {
        router.push('/signup');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // NEW CANON: runCrewId from params, fetch crew scoped to that ID
        const response = await api.get(`/runcrew/${runCrewId}`);
        
        if (!response.data.success || !response.data.runCrew) {
          throw new Error('RunCrew not found');
        }

        const crewData = response.data.runCrew;
        
        // NEW CANON: Settings only scopes to basic info (meta level)
        // meta contains: name, description, icon, logo, joinCode, messageTopics
        setCrew(crewData);
        const name = crewData.runCrewBaseInfo?.name || '';
        const description = crewData.runCrewBaseInfo?.description || '';
        let icon = crewData.runCrewBaseInfo?.icon || '';
        let logo = crewData.runCrewBaseInfo?.logo || '';
        
        // Auto-hydrate default emoji if neither exists (legacy/bad data)
        if (!icon && !logo) {
          icon = '🏃';
        }
        
        setCrewName(name);
        setCrewDescription(description);
        setCrewIcon(icon);
        setCrewLogo(logo);
        
        // Set original values for comparison
        setOriginalName(name);
        setOriginalDescription(description);
        setOriginalIcon(icon);
        setOriginalLogo(logo);

        // Find membership to check admin status
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

  // Individual field save functions
  const handleSaveName = async () => {
    if (!crew) return;
    try {
      setSavingName(true);
      const response = await api.put(`/runcrew/${runCrewId}`, {
        name: crewName.trim(),
      });
      if (response.data.success) {
        showToast('Crew name saved');
        setOriginalName(crewName.trim());
        // Refresh crew data
        const refreshResponse = await api.get(`/runcrew/${runCrewId}`);
        if (refreshResponse.data.success) {
          const refreshedCrew = refreshResponse.data.runCrew;
          setCrew(refreshedCrew);
        }
      }
    } catch (err: any) {
      console.error('Error saving name:', err);
      showToast(err.response?.data?.error || 'Failed to save name');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveDescription = async () => {
    if (!crew) return;
    try {
      setSavingDescription(true);
      const response = await api.put(`/runcrew/${runCrewId}`, {
        description: crewDescription.trim() || null,
      });
      if (response.data.success) {
        showToast('Description saved');
        setOriginalDescription(crewDescription.trim() || '');
        // Refresh crew data
        const refreshResponse = await api.get(`/runcrew/${runCrewId}`);
        if (refreshResponse.data.success) {
          const refreshedCrew = refreshResponse.data.runCrew;
          setCrew(refreshedCrew);
        }
      }
    } catch (err: any) {
      console.error('Error saving description:', err);
      showToast(err.response?.data?.error || 'Failed to save description');
    } finally {
      setSavingDescription(false);
    }
  };

  const handleSaveIcon = async () => {
    if (!crew) return;
    try {
      setSavingIcon(true);
      // When saving emoji, also clear logo (fork: emoji replaces logo)
      const response = await api.put(`/runcrew/${runCrewId}`, {
        icon: crewIcon.trim() || null,
        logo: null, // Clear logo when emoji is set
      });
      if (response.data.success) {
        showToast('Graphic saved');
        setOriginalIcon(crewIcon.trim() || '');
        setOriginalLogo(''); // Logo is cleared
        // Refresh crew data
        const refreshResponse = await api.get(`/runcrew/${runCrewId}`);
        if (refreshResponse.data.success) {
          const refreshedCrew = refreshResponse.data.runCrew;
          setCrew(refreshedCrew);
          setCrewLogo(''); // Clear logo in state
        }
      }
    } catch (err: any) {
      console.error('Error saving icon:', err);
      showToast(err.response?.data?.error || 'Failed to save graphic');
    } finally {
      setSavingIcon(false);
    }
  };

  const handleSaveLogo = async () => {
    if (!crew) return;
    try {
      setSavingLogo(true);
      // When saving logo, also clear icon (fork: logo replaces icon)
      const response = await api.put(`/runcrew/${runCrewId}`, {
        logo: crewLogo.trim() || null,
        icon: null, // Clear icon when logo is set
      });
      if (response.data.success) {
        showToast('Graphic saved');
        setOriginalLogo(crewLogo.trim() || '');
        setOriginalIcon(''); // Icon is cleared
        // Refresh crew data
        const refreshResponse = await api.get(`/runcrew/${runCrewId}`);
        if (refreshResponse.data.success) {
          const refreshedCrew = refreshResponse.data.runCrew;
          setCrew(refreshedCrew);
          setCrewIcon(''); // Clear icon in state
        }
      }
    } catch (err: any) {
      console.error('Error saving logo:', err);
      showToast(err.response?.data?.error || 'Failed to save graphic');
    } finally {
      setSavingLogo(false);
    }
  };

  const handleDelete = async () => {
    if (!crew) return;

    try {
      setIsDeleting(true);
      const crewName = crew.runCrewBaseInfo?.name || 'RunCrew';
      const response = await api.delete(`/runcrew/${runCrewId}/delete`);
      if (response.data.success) {
        setDeletedCrewName(crewName);
        setShowDeleteConfirm(false);
        // Refresh localStorage to get updated crew list
        try {
          const hydrateRes = await api.post('/athlete/hydrate');
          if (hydrateRes.data?.success && hydrateRes.data?.athlete) {
            LocalStorageAPI.setFullHydrationModel({
              athlete: hydrateRes.data.athlete,
              weeklyActivities: hydrateRes.data.athlete.weeklyActivities || [],
              weeklyTotals: hydrateRes.data.athlete.weeklyTotals || null,
            });
          }
        } catch (hydrateErr) {
          console.error('Error refreshing data:', hydrateErr);
        }
        setShowDeleteSuccess(true);
      }
    } catch (err: any) {
      console.error('Error deleting crew:', err);
      showToast(err.response?.data?.error || 'Failed to delete crew');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLeave = async () => {
    if (!crew) return;

    if (!confirm('Are you sure you want to leave this crew? You can rejoin later using the invite link.')) {
      return;
    }

    try {
      const response = await api.post(`/runcrew/${runCrewId}/leave`);
      if (response.data.success) {
        showToast('You have left the crew');
        // Refresh localStorage to get updated crew list
        try {
          const hydrateRes = await api.post('/athlete/hydrate');
          if (hydrateRes.data?.success && hydrateRes.data?.athlete) {
            LocalStorageAPI.setFullHydrationModel({
              athlete: hydrateRes.data.athlete,
              weeklyActivities: hydrateRes.data.athlete.weeklyActivities || [],
              weeklyTotals: hydrateRes.data.athlete.weeklyTotals || null,
            });
          }
        } catch (hydrateErr) {
          console.error('Error refreshing data:', hydrateErr);
        }
        router.push('/my-runcrews');
      }
    } catch (err: any) {
      console.error('Error leaving crew:', err);
      showToast(err.response?.data?.error || 'Failed to leave crew');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50">
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
          <p className="text-gray-600 mb-4">Failed to load RunCrew settings.</p>
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

  // If user can access this page, they can edit (admin-only page)
  const memberships = crew.membershipsBox?.memberships || [];
  const currentAthleteId = membership?.athleteId;
  
  // Filter admins and managers
  const adminsAndManagers = memberships.filter((m: any) => 
    m.role === 'admin' || m.role === 'manager'
  );
  
  // Get available members (not already admin/manager) for the picker
  const availableMembers = memberships.filter((m: any) => 
    m.role === 'member' && m.athleteId !== currentAthleteId
  );
  
  // Handle adding admin/manager
  const handleAddManager = async () => {
    if (!selectedMemberId || !crew) return;
    
    try {
      setIsAddingManager(true);
      const membershipToPromote = memberships.find((m: any) => m.athleteId === selectedMemberId);
      if (!membershipToPromote) {
        showToast('Member not found');
        return;
      }
      
      const response = await api.put(`/runcrew/${runCrewId}/members/${membershipToPromote.id}/role`, {
        role: selectedRole,
      });
      
      if (response.data.success) {
        showToast(`${selectedRole === 'admin' ? 'Admin' : 'Manager'} added successfully`);
        // Refresh crew data
        const refreshResponse = await api.get(`/runcrew/${runCrewId}`);
        if (refreshResponse.data.success && refreshResponse.data.runCrew) {
          setCrew(refreshResponse.data.runCrew);
        }
        // Close modal and reset
        setShowAddManagerModal(false);
        setSelectedMemberId('');
        setSelectedRole('manager');
      }
    } catch (err: any) {
      console.error('Error adding admin/manager:', err);
      showToast(err.response?.data?.error || 'Failed to add admin/manager');
    } finally {
      setIsAddingManager(false);
    }
  };

  // Render crew graphic for sidebar
  const crewGraphic = crew.runCrewBaseInfo?.logo ? (
    <img
      src={crew.runCrewBaseInfo.logo}
      alt={crew.runCrewBaseInfo?.name || 'RunCrew'}
      className="w-12 h-12 rounded-xl object-cover border-2 border-gray-200 flex-shrink-0"
    />
  ) : (
    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl border-2 border-gray-200 flex-shrink-0">
      {crew.runCrewBaseInfo?.icon || '🏃'}
    </div>
  );

  // Render section content
  const renderSectionContent = () => {
    switch (activeSection) {
      case 'info':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Info</h1>
            
            {/* RunCrew Graphic */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                RunCrew Graphic
              </label>
              
              {graphicMode === 'view' ? (
                <div className="flex items-center gap-4">
                  {crewLogo ? (
                    <img
                      src={crewLogo}
                      alt={crew.runCrewBaseInfo?.name || 'RunCrew'}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-gray-200 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-3xl border-2 border-gray-200 flex-shrink-0">
                      {crewIcon || '🏃'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{crew.runCrewBaseInfo?.name || 'RunCrew'}</p>
                  </div>
                  <button
                    onClick={() => setGraphicMode('edit')}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition whitespace-nowrap"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600">Choose how your RunCrew appears</p>
                    <button
                      onClick={() => {
                        setGraphicMode('view');
                        setCrewIcon(originalIcon);
                        setCrewLogo(originalLogo);
                      }}
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                  </div>
                  
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Emoji</h3>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={crewIcon}
                        onChange={(e) => setCrewIcon(e.target.value)}
                        placeholder="🏃"
                        maxLength={2}
                        className="w-20 text-center px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-2xl flex-shrink-0"
                      />
                      <button
                        onClick={async () => {
                          setCrewLogo('');
                          await handleSaveIcon();
                          setGraphicMode('view');
                        }}
                        disabled={savingIcon || !crewIcon.trim()}
                        className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                      >
                        <Save className="w-3 h-3" />
                        {savingIcon ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Logo</h3>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          try {
                            setSavingLogo(true);
                            const formData = new FormData();
                            formData.append('file', file);
                            
                            const uploadResponse = await api.post('/upload', formData, {
                              headers: { 'Content-Type': 'multipart/form-data' },
                            });
                            
                            if (uploadResponse.data.success && uploadResponse.data.url) {
                              setCrewLogo(uploadResponse.data.url);
                              setCrewIcon('');
                              await handleSaveLogo();
                              setGraphicMode('view');
                            } else {
                              showToast('Failed to upload logo');
                              setSavingLogo(false);
                            }
                          } catch (err: any) {
                            console.error('Error uploading logo:', err);
                            showToast(err.response?.data?.error || 'Failed to upload logo');
                            setSavingLogo(false);
                          }
                          
                          e.target.value = '';
                        }}
                        disabled={savingLogo}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      {savingLogo && (
                        <span className="text-xs text-orange-600 whitespace-nowrap flex-shrink-0">Saving...</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Crew Name */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Crew Name
                </label>
                {crewName.trim() !== originalName && (
                  <button
                    onClick={handleSaveName}
                    disabled={savingName || !crewName.trim()}
                    className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-3 h-3" />
                    {savingName ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
                <input
                  type="text"
                  value={crewName}
                  onChange={(e) => setCrewName(e.target.value)}
                  className="w-full min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Enter crew name"
                />
            </div>

            {/* Description */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Description
                </label>
                {(crewDescription.trim() || '') !== originalDescription && (
                  <button
                    onClick={handleSaveDescription}
                    disabled={savingDescription}
                    className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-3 h-3" />
                    {savingDescription ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
                <textarea
                  value={crewDescription}
                  onChange={(e) => setCrewDescription(e.target.value)}
                  rows={4}
                  className="w-full min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-y"
                  placeholder="Enter crew description (optional)"
                />
            </div>
          </div>
        );

      case 'manager':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Manager</h1>
              <button
                onClick={() => setShowAddManagerModal(true)}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold transition"
              >
                <Users className="w-4 h-4" />
                Add Admin/Manager
              </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Admin/Managers ({adminsAndManagers.length})</h2>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {adminsAndManagers.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No admins or managers yet</p>
                ) : (
                  adminsAndManagers.map((membershipItem: any) => {
                    const athlete = membershipItem.athlete || {};
                    return (
                      <div key={membershipItem.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                        {athlete.photoURL ? (
                          <img
                            src={athlete.photoURL}
                            alt={`${athlete.firstName} ${athlete.lastName}`}
                            className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {(athlete.firstName?.[0] || 'A').toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {athlete.firstName || 'Athlete'} {athlete.lastName || ''}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {membershipItem.role === 'admin' && (
                              <span className="text-xs text-orange-600 font-bold">Admin</span>
                            )}
                            {membershipItem.role === 'manager' && (
                              <span className="text-xs text-blue-600 font-bold">Manager</span>
                            )}
                          </div>
                        </div>
                        {membershipItem.athleteId !== currentAthleteId && membership?.role === 'admin' && (
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                if (confirm(`Demote ${athlete.firstName} ${athlete.lastName} to member?`)) {
                                  try {
                                    const response = await api.put(`/runcrew/${runCrewId}/members/${membershipItem.id}/role`, {
                                      role: 'member',
                                    });
                                    if (response.data.success) {
                                      showToast(`${membershipItem.role === 'admin' ? 'Admin' : 'Manager'} demoted to member`);
                                      const crewResponse = await api.get(`/runcrew/${runCrewId}`);
                                      if (crewResponse.data.success && crewResponse.data.runCrew) {
                                        setCrew(crewResponse.data.runCrew);
                                      }
                                    }
                                  } catch (err: any) {
                                    console.error('Error demoting:', err);
                                    showToast(err.response?.data?.error || 'Failed to demote');
                                  }
                                }
                              }}
                              className="px-3 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded-lg whitespace-nowrap"
                            >
                              Demote to Member
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Remove ${athlete.firstName} ${athlete.lastName} from this crew?`)) {
                                  try {
                                    const response = await api.delete(`/runcrew/${runCrewId}/members/${membershipItem.id}`);
                                    if (response.data.success) {
                                      showToast(`${athlete.firstName} ${athlete.lastName} has been removed from the crew`);
                                      const crewResponse = await api.get(`/runcrew/${runCrewId}`);
                                      if (crewResponse.data.success && crewResponse.data.runCrew) {
                                        setCrew(crewResponse.data.runCrew);
                                      }
                                    }
                                  } catch (err: any) {
                                    console.error('Error removing member:', err);
                                    showToast(err.response?.data?.error || 'Failed to remove member');
                                  }
                                }
                              }}
                              className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg whitespace-nowrap"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );

      case 'lifecycle':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Advanced</h1>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="space-y-6">
                {/* Transfer Ownership */}
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Transfer Ownership</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Transfer ownership of this RunCrew to another member. You will become a regular member.
                  </p>
                  <select
                    value=""
                    onChange={async (e) => {
                      const newOwnerMembershipId = e.target.value;
                      if (!newOwnerMembershipId) return;
                      
                      const newOwner = memberships.find((m: any) => m.id === newOwnerMembershipId);
                      if (!newOwner) return;
                      
                      const athlete = newOwner.athlete || {};
                      if (confirm(`Transfer ownership to ${athlete.firstName} ${athlete.lastName}? You will become a regular member.`)) {
                        try {
                          const response = await api.post(`/runcrew/${runCrewId}/transfer-ownership`, {
                            newOwnerMembershipId,
                          });
                          if (response.data.success) {
                            showToast('Ownership transferred successfully');
                            router.push(`/runcrew/${runCrewId}/member`);
                          }
                        } catch (err: any) {
                          console.error('Error transferring ownership:', err);
                          showToast(err.response?.data?.error || 'Failed to transfer ownership');
                        }
                      }
                      e.target.value = '';
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 mb-2"
                  >
                    <option value="">Select a member...</option>
                    {memberships
                      .filter((m: any) => m.athleteId !== membership?.athleteId)
                      .map((m: any) => {
                        const athlete = m.athlete || {};
                        return (
                          <option key={m.id} value={m.id}>
                            {athlete.firstName} {athlete.lastName} {m.role === 'manager' ? '(Manager)' : ''}
                          </option>
                        );
                      })}
                  </select>
                </div>

                {/* Archive RunCrew */}
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Archive RunCrew</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Archive this RunCrew. Members can still view history, but no new activity can be created.
                  </p>
                  <button
                    onClick={async () => {
                      if (confirm(`Archive "${crew.runCrewBaseInfo?.name}"? Members can still view history, but no new runs, announcements, or messages can be created.`)) {
                        try {
                          const response = await api.post(`/runcrew/${runCrewId}/archive`);
                          if (response.data.success) {
                            showToast('RunCrew archived successfully');
                            // Refresh localStorage to get updated crew list
                            try {
                              const hydrateRes = await api.post('/athlete/hydrate');
                              if (hydrateRes.data?.success && hydrateRes.data?.athlete) {
                                LocalStorageAPI.setFullHydrationModel({
                                  athlete: hydrateRes.data.athlete,
                                  weeklyActivities: hydrateRes.data.athlete.weeklyActivities || [],
                                  weeklyTotals: hydrateRes.data.athlete.weeklyTotals || null,
                                });
                                // Check if user still has crews (including archived)
                                const memberships = hydrateRes.data.athlete.runCrewMemberships || [];
                                if (memberships.length > 0) {
                                  router.push('/my-runcrews');
                                } else {
                                  router.push('/runcrew-discovery');
                                }
                              } else {
                                router.push('/my-runcrews');
                              }
                            } catch (hydrateErr) {
                              console.error('Error refreshing data:', hydrateErr);
                              router.push('/my-runcrews');
                            }
                          }
                        } catch (err: any) {
                          console.error('Error archiving crew:', err);
                          showToast(err.response?.data?.error || 'Failed to archive RunCrew');
                        }
                      }
                    }}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold"
                  >
                    Archive RunCrew
                  </button>
                </div>

                {/* Leave Crew (for non-admins) */}
                {membership && membership.role !== 'admin' && (
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Leave Crew</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Leave this RunCrew. You can rejoin later using the invite link.
                    </p>
                    <button
                      onClick={handleLeave}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition"
                    >
                      Leave Crew
                    </button>
                  </div>
                )}

                {/* Delete RunCrew (admin only) */}
                {membership && membership.role === 'admin' && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete RunCrew</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Permanently delete this RunCrew. This action cannot be undone and all data will be lost.
                    </p>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete RunCrew
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      {toast && (
        <div className="fixed top-20 right-6 bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <SettingsAppShell
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        crewName={crew.runCrewBaseInfo?.name || 'RunCrew'}
        crewGraphic={crewGraphic}
        runCrewId={runCrewId}
      >
        {renderSectionContent()}
      </SettingsAppShell>

      {/* Add Admin/Manager Modal */}
      {showAddManagerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Admin/Manager</h3>
            <p className="text-gray-600 mb-6">
              Select a member to grant admin or manager permissions.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Member
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Choose a member...</option>
                  {availableMembers.map((membership: any) => {
                    const athlete = membership.athlete || {};
                    return (
                      <option key={membership.id} value={membership.athleteId}>
                        {athlete.firstName} {athlete.lastName}
                        {athlete.email ? ` (${athlete.email})` : ''}
                      </option>
                    );
                  })}
                </select>
                {availableMembers.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">
                    All members are already admins or managers.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'manager')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedRole === 'admin'
                    ? 'Admins have full control over the crew'
                    : 'Managers can help manage runs and announcements'}
                </p>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setShowAddManagerModal(false);
                  setSelectedMemberId('');
                  setSelectedRole('manager');
                }}
                disabled={isAddingManager}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddManager}
                disabled={isAddingManager || !selectedMemberId}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
              >
                {isAddingManager ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Delete RunCrew?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{crew.runCrewBaseInfo?.name}</strong>? This action cannot be undone and all data will be permanently deleted.
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

      {/* Delete Success Modal */}
      {showDeleteSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">RunCrew Deleted</h3>
              <p className="text-gray-600 mb-4">
                You've deleted <strong>{deletedCrewName}</strong>.
              </p>
              <p className="text-gray-700 font-medium mb-6">
                Thanks for starting {deletedCrewName} and leading other runners.
              </p>
            </div>
            <div className="space-y-3">
              {/* Check if user has other crews remaining */}
              {(() => {
                const model = LocalStorageAPI.getFullHydrationModel();
                const memberships = model?.athlete?.runCrewMemberships || [];
                const hasOtherCrews = memberships.length > 0;
                
                if (hasOtherCrews) {
                  return (
                    <button
                      onClick={() => router.push('/my-runcrews')}
                      className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition"
                    >
                      My RunCrews
                    </button>
                  );
                } else {
                  return (
                    <>
                      <button
                        onClick={() => router.push('/runcrew/create')}
                        className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition"
                      >
                        Create Another RunCrew
                      </button>
                      <button
                        onClick={() => router.push('/runcrew-discovery')}
                        className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
                      >
                        Join a RunCrew
                      </button>
                    </>
                  );
                }
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
