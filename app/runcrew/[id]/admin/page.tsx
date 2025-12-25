'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';

export default function RunCrewAdminPage() {
  const params = useParams();
  const router = useRouter();
  const crewId = params.id as string;
  
  // LOCAL-FIRST: Load from localStorage only - no useEffect, no automatic API calls, NO REDIRECTS
  const crew = LocalStorageAPI.getPrimaryCrew() || LocalStorageAPI.getRunCrewData();
  
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

  // Verify user is an admin/manager before allowing access
  const isAdmin = crew?.userRole === 'admin' || crew?.userRole === 'manager';
  
  // NO REDIRECTS - Just render what we have, even if incomplete
  // If crew doesn't exist or ID doesn't match, show error
  if (!crew || crew.id !== crewId) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-red-600">Crew not found in localStorage. Please navigate from your crew page.</p>
          <button
            onClick={() => router.push('/runcrew')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Crew List
          </button>
        </div>
      </div>
    );
  }
  
  // If not admin, show message instead of redirecting
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-red-600">You must be an admin to access this page.</p>
          <button
            onClick={() => router.push(`/runcrew/${crewId}`)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Crew Page
          </button>
        </div>
      </div>
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
        // Reload page to get fresh data (or refresh localStorage)
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Error creating run:', error);
      alert(error.response?.data?.error || 'Failed to create run');
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;

    try {
      const response = await api.post(`/runcrew/${crewId}/announcements`, {
        title,
        content,
      });
      
      if (response.data.success) {
        (e.target as HTMLFormElement).reset();
        // Reload page to get fresh data (or refresh localStorage)
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Error posting announcement:', error);
      alert(error.response?.data?.error || 'Failed to post announcement');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push(`/runcrew/${crewId}`)}
            className="mb-4 text-blue-600 hover:text-blue-700"
          >
            ← Back to Crew
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Run */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Create Run</h2>
              <button
                onClick={() => setShowRunForm(!showRunForm)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {showRunForm ? 'Cancel' : 'New Run'}
              </button>
            </div>

            {showRunForm && (
              <form onSubmit={handleCreateRun} className="space-y-4">
                <input
                  type="text"
                  placeholder="Run Title"
                  required
                  value={runForm.title}
                  onChange={(e) => setRunForm({ ...runForm, title: e.target.value })}
                  className="w-full rounded-md border-gray-300"
                />
                <input
                  type="date"
                  required
                  value={runForm.date}
                  onChange={(e) => setRunForm({ ...runForm, date: e.target.value })}
                  className="w-full rounded-md border-gray-300"
                />
                <input
                  type="text"
                  placeholder="Start Time (e.g., 6:30 AM)"
                  required
                  value={runForm.startTime}
                  onChange={(e) => setRunForm({ ...runForm, startTime: e.target.value })}
                  className="w-full rounded-md border-gray-300"
                />
                <input
                  type="text"
                  placeholder="Meet-up Point"
                  required
                  value={runForm.meetUpPoint}
                  onChange={(e) => setRunForm({ ...runForm, meetUpPoint: e.target.value })}
                  className="w-full rounded-md border-gray-300"
                />
                <input
                  type="text"
                  placeholder="Address (optional)"
                  value={runForm.meetUpAddress}
                  onChange={(e) => setRunForm({ ...runForm, meetUpAddress: e.target.value })}
                  className="w-full rounded-md border-gray-300"
                />
                <input
                  type="number"
                  placeholder="Total Miles (optional)"
                  value={runForm.totalMiles}
                  onChange={(e) => setRunForm({ ...runForm, totalMiles: e.target.value })}
                  className="w-full rounded-md border-gray-300"
                />
                <input
                  type="text"
                  placeholder="Pace (optional)"
                  value={runForm.pace}
                  onChange={(e) => setRunForm({ ...runForm, pace: e.target.value })}
                  className="w-full rounded-md border-gray-300"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={runForm.description}
                  onChange={(e) => setRunForm({ ...runForm, description: e.target.value })}
                  className="w-full rounded-md border-gray-300"
                  rows={3}
                />
                <button
                  type="submit"
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create Run
                </button>
              </form>
            )}
          </div>

          {/* Post Announcement */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Post Announcement</h2>
            <form onSubmit={handlePostAnnouncement} className="space-y-4">
              <input
                type="text"
                name="title"
                placeholder="Title"
                required
                className="w-full rounded-md border-gray-300"
              />
              <textarea
                name="content"
                placeholder="Content"
                required
                rows={4}
                className="w-full rounded-md border-gray-300"
              />
              <button
                type="submit"
                className="w-full py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Post Announcement
              </button>
            </form>
          </div>

          {/* Member Roster */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Member Roster</h2>
            {crew?.memberships && crew.memberships.length > 0 ? (
              <div className="space-y-2">
                {crew.memberships.map((membership: any) => (
                  <div key={membership.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">
                        {membership.athlete.firstName} {membership.athlete.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{membership.athlete.email}</div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Joined {new Date(membership.joinedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No members</p>
            )}
          </div>

          {/* Messages */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Messages</h2>
            {crew?.messages && crew.messages.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {crew.messages.map((message: any) => (
                  <div key={message.id} className="border-b pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {message.athlete.firstName} {message.athlete.lastName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700">{message.content}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No messages</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

