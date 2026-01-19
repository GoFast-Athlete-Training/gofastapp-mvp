'use client';


import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

/**
 * Join Success Page
 * 
 * Route: /runcrew/[runCrewId]/join-success
 * 
 * Purpose: Show success message after joining a RunCrew
 * - Displays "Success! You're joined - welcome"
 * - CTA button to go to member page
 */
export default function JoinSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const runCrewId = params.runCrewId as string;

  const [crew, setCrew] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runCrewId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/signup');
        return;
      }

      try {
        setLoading(true);
        const response = await api.get(`/runcrew/${runCrewId}`);
        
        if (response.data?.success && response.data?.runCrew) {
          setCrew(response.data.runCrew);
        }
        setLoading(false);
      } catch (err: any) {
        console.error('❌ JOIN SUCCESS: Error fetching crew:', err);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [runCrewId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <div className="text-center">
            {/* Success Icon */}
            <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-4xl">✅</span>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Success! You're joined - welcome
            </h1>
            {crew && (
              <p className="text-lg text-gray-600 mb-6">
                You're now a member of <strong>{crew.runCrewBaseInfo?.name || 'this crew'}</strong>
              </p>
            )}
            
            <button
              onClick={() => router.push(`/runcrew/${runCrewId}/member`)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold text-lg transition shadow-lg hover:shadow-xl"
            >
              Go see your crew
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

