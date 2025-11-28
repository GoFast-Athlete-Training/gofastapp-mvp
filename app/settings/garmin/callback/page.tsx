'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function GarminCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setTimeout(() => {
        router.push('/settings/garmin');
      }, 3000);
      return;
    }

    if (code) {
      // The callback is handled by the API route
      // This page just shows a loading state and redirects
      setStatus('success');
      setTimeout(() => {
        router.push('/settings/garmin/success');
      }, 1000);
    } else {
      setStatus('error');
      setTimeout(() => {
        router.push('/settings/garmin');
      }, 3000);
    }
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Connecting Garmin...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-600 text-4xl mb-4">✓</div>
            <p className="text-gray-600">Successfully connected!</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-600 text-4xl mb-4">✗</div>
            <p className="text-gray-600">Failed to connect. Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
}

export default function GarminCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <GarminCallbackContent />
    </Suspense>
  );
}

