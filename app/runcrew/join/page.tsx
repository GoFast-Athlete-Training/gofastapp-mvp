'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function JoinCrewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/runcrew/join', { joinCode });
      
      if (response.data.success) {
        router.push(`/runcrew/${response.data.runCrew.id}`);
      }
    } catch (error: any) {
      console.error('Error joining crew:', error);
      alert(error.response?.data?.error || 'Failed to join crew');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Join RunCrew</h1>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label htmlFor="joinCode" className="block text-sm font-medium text-gray-700">
              Join Code *
            </label>
            <input
              type="text"
              id="joinCode"
              required
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter join code"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Joining...' : 'Join Crew'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-2 px-4 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

