'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function RootPage() {
  const router = useRouter();
  const [startTime] = useState(Date.now());
  const [authState, setAuthState] = useState<{ user: any; ready: boolean } | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthState({ user, ready: true });
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!authState?.ready) return;

    const elapsed = Date.now() - startTime;
    const minDelay = 1500;
    const remaining = Math.max(0, minDelay - elapsed);

    const timeoutId = setTimeout(() => {
      if (authState.user === null) {
        router.replace('/signup');
      } else {
        router.replace('/athlete-welcome');
      }
    }, remaining);

    return () => clearTimeout(timeoutId);
  }, [authState, router, startTime]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-400 to-sky-600">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-white text-xl">Checking authentication...</p>
      </div>
    </div>
  );
}
