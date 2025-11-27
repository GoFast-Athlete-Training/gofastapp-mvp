'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { LocalStorageAPI } from '@/lib/localstorage';
import api from '@/lib/api';

export default function ProfilePage() {
  const [athlete, setAthlete] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = LocalStorageAPI.getAthlete();
    if (stored) {
      setAthlete(stored);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p>Please sign in</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">Name</div>
              <div className="font-medium">
                {athlete.firstName} {athlete.lastName}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Email</div>
              <div className="font-medium">{athlete.email}</div>
            </div>
            {athlete.city && (
              <div>
                <div className="text-sm text-gray-500">Location</div>
                <div className="font-medium">
                  {athlete.city}, {athlete.state}
                </div>
              </div>
            )}
            {athlete.primarySport && (
              <div>
                <div className="text-sm text-gray-500">Primary Sport</div>
                <div className="font-medium">{athlete.primarySport}</div>
              </div>
            )}
            {athlete.bio && (
              <div>
                <div className="text-sm text-gray-500">Bio</div>
                <div className="text-gray-700">{athlete.bio}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

