'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import api from '@/lib/api';

export default function CreateCrewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    joinCode: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Crew name is required');
      return;
    }
    
    if (!formData.joinCode.trim()) {
      setError('Join code is required');
      return;
    }

    const normalizedCode = formData.joinCode.toUpperCase().trim();
    if (normalizedCode.length < 3) {
      setError('Join code must be at least 3 characters');
      return;
    }
    if (normalizedCode.length > 20) {
      setError('Join code must be 20 characters or less');
      return;
    }
    if (!/^[A-Z0-9-_]+$/.test(normalizedCode)) {
      setError('Join code can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/runcrew/create', {
        ...formData,
        joinCode: normalizedCode,
      });
      
      if (response.data.success) {
        router.push(`/runcrew/${response.data.runCrew.id}`);
      }
    } catch (error: any) {
      console.error('Error creating crew:', error);
      setError(error.response?.data?.error || error.response?.data?.message || 'Failed to create crew');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-sky-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => router.push('/runcrew')} 
              className="text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center space-x-2">
              <Image 
                src="/logo.jpg" 
                alt="GoFast" 
                width={24}
                height={24}
                className="w-6 h-6 rounded-full"
              />
              <span className="font-bold text-gray-900">GoFast</span>
            </div>
            <div></div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your RunCrew</h1>
          <p className="text-gray-600 mb-3">
            This is your crew — your friends, your accountability partners, your running family.
          </p>
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 text-left">
            <p className="text-sm text-sky-800 font-medium mb-1">💡 Make it fun and memorable!</p>
            <p className="text-xs text-sky-700">
              Choose a name and join code that your crew will remember. This is how you'll recognize each other and build your running community.
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Crew Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                setError(null);
              }}
              className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
              placeholder="e.g. Morning Warriors, Trail Runners, Weekend Warriors"
              disabled={loading}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Pick something your crew will remember and get excited about</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                setError(null);
              }}
              rows={3}
              className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition resize-none"
              placeholder="What makes your crew special? What are your goals? (optional)"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">Help your crew understand what you're all about</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Join Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.joinCode}
              onChange={(e) => {
                setFormData({ ...formData, joinCode: e.target.value.toUpperCase() });
                setError(null);
              }}
              className="w-full p-4 border-2 border-gray-300 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
              placeholder="FAST123"
              maxLength={20}
              disabled={loading}
              required
            />
            <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-900 mb-1">🔑 What is a Join Code?</p>
              <p className="text-xs text-blue-800">
                This is how your friends will join your crew. Share this code with them, and they can enter it to join. 
                Make it something easy to remember — like your crew name initials or a fun word!
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              3-20 characters, letters and numbers only (no spaces)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !formData.name.trim() || !formData.joinCode.trim()}
            className="w-full bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-bold py-4 rounded-lg transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Crew...
              </span>
            ) : (
              'Create RunCrew'
            )}
          </button>

          <button
            type="button"
            onClick={() => router.push('/runcrew')}
            className="w-full text-gray-600 hover:text-gray-800 text-sm font-medium py-2 transition-colors"
            disabled={loading}
          >
            ← Back to RunCrew
          </button>
        </form>
      </div>
    </div>
  );
}

