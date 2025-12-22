'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

const PENDING_CREW_ID_KEY = 'pendingCrewId';

function JoinCrewPageContent() {
  const params = useParams();
  const router = useRouter();
  const crewId = params.crewId as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crew, setCrew] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication status
  useEffect(() => {
    const checkAuth = () => {
      const user = auth.currentUser;
      setIsAuthenticated(!!user);
    };

    checkAuth();
    const unsubscribe = auth.onAuthStateChanged(checkAuth);
    return () => unsubscribe();
  }, []);

  // Fetch crew metadata on mount
  useEffect(() => {
    if (!crewId) {
      setError('Invalid crew ID');
      setFetching(false);
      return;
    }

    const fetchCrewMetadata = async () => {
      try {
        setFetching(true);
        setError(null);

        // Use fetch directly since this is a public endpoint (no auth required)
        const response = await fetch(`/api/runcrew/public/${crewId}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Crew not found');
        }

        setCrew(data.runCrew);
        
        // Store crewId in localStorage for signup flow
        if (typeof window !== 'undefined') {
          localStorage.setItem(PENDING_CREW_ID_KEY, crewId);
        }
      } catch (err: any) {
        console.error('Error fetching crew metadata:', err);
        setError(err.message || 'Failed to load crew information');
      } finally {
        setFetching(false);
      }
    };

    fetchCrewMetadata();
  }, [crewId]);

  const handleJoin = async () => {
    if (!crewId) {
      setError('Invalid crew ID');
      return;
    }

    // Check if user is authenticated
    const user = auth.currentUser;
    
    if (!user) {
      // Not authenticated - redirect to signup with pendingCrewId already in localStorage
      router.push('/signup');
      return;
    }

    // User is authenticated - join immediately
    setLoading(true);
    setError(null);

    try {
      // Get fresh token
      const token = await user.getIdToken();
      
      const response = await api.post('/runcrew/join', { crewId });
      
      if (response.data.success) {
        // Clear pending crew ID from localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem(PENDING_CREW_ID_KEY);
        }
        
        // Redirect to crew page
        router.push(`/runcrew/${response.data.runCrew.id}`);
      }
    } catch (err: any) {
      console.error('Error joining crew:', err);
      setError(
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to join crew. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading crew information...</p>
        </div>
      </div>
    );
  }

  if (error && !crew) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-md mx-auto px-6 py-12">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
              <h2 className="text-xl font-bold text-red-900 mb-2">Crew Not Found</h2>
              <p className="text-red-700">{error}</p>
            </div>
            <button
              onClick={() => router.push('/runcrew')}
              className="text-orange-600 hover:text-orange-800 font-medium"
            >
              ← Back to RunCrew
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-6 py-4">
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

      <div className="max-w-md mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Join RunCrew</h2>
          <p className="text-gray-600">You've been invited to join</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Crew Preview Card */}
        {crew && (
          <div className="bg-white border-2 border-orange-200 rounded-lg p-6 mb-6">
            <div className="space-y-4">
              {crew.logo && (
                <div className="flex justify-center">
                  <Image
                    src={crew.logo}
                    alt={crew.name}
                    width={80}
                    height={80}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                </div>
              )}
              
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{crew.name}</h3>
                {crew.description && (
                  <p className="text-gray-600">{crew.description}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Join Button */}
        <button
          onClick={handleJoin}
          disabled={loading || !crew}
          className="w-full bg-orange-500 text-white py-4 rounded-lg font-bold text-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors mb-4"
        >
          {loading ? 'Joining...' : isAuthenticated ? 'Join Crew' : 'Sign Up to Join'}
        </button>

        {!isAuthenticated && (
          <p className="text-sm text-gray-500 text-center">
            You'll need to sign up or sign in to join this crew
          </p>
        )}

        <button
          onClick={() => router.push('/runcrew')}
          className="w-full text-gray-600 py-2 hover:text-gray-800 transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

export default function JoinCrewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <JoinCrewPageContent />
    </Suspense>
  );
}

