'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function RunCrewSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const crewId = params.id as string;
  
  const [crew, setCrew] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    loadCrew();
  }, [crewId]);

  const loadCrew = async () => {
    try {
      const response = await api.post('/runcrew/hydrate', { runCrewId: crewId });
      
      if (response.data.success) {
        const crewData = response.data.runCrew;
        setCrew(crewData);
        setFormData({
          name: crewData.name,
          description: crewData.description || '',
        });
      }
    } catch (error) {
      console.error('Error loading crew:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Implement update crew endpoint
    alert('Update crew functionality coming soon');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push(`/runcrew/${crewId}`)}
          className="mb-4 text-blue-600 hover:text-blue-700"
        >
          ← Back to Crew
        </button>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Crew Settings</h1>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Crew Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Join Code
            </label>
            <div className="mt-1 p-3 bg-gray-100 rounded-md">
              {crew?.joinCode}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save Changes
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

