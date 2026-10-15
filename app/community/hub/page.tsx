'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';
import { communityHubPathForHandle } from '@/lib/athlete/community-nav';
import TopNav from '@/components/shared/TopNav';

export default function CommunityHubRedirectPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const id = LocalStorageAPI.getAthleteId();
    if (!id) {
      router.replace('/welcome');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/athlete/${id}`);
        const handle = res.data?.athlete?.gofastHandle?.trim();
        if (!handle) {
          if (!cancelled) {
            setMessage('Set your GoFast handle in profile to open your community hub.');
          }
          return;
        }
        if (!cancelled) {
          router.replace(communityHubPathForHandle(handle));
        }
      } catch {
        if (!cancelled) {
          setMessage('Could not load your profile. Try again from home.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 items-center justify-center px-4">
        {message ? (
          <p className="text-sm text-gray-700 text-center max-w-md">{message}</p>
        ) : (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        )}
      </div>
    </div>
  );
}
