'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LocalStorageAPI } from '@/lib/localstorage';
import { clubManagerActivatePath, clubManagerHubPath } from '@/lib/club-manager-paths';

/** Deprecated email-hunt path — redirect to token invite or Club Manager hub. */
export default function WelcomeClubOwnerRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const token = LocalStorageAPI.getClubManagerActivationToken();
    if (token) {
      router.replace(clubManagerActivatePath(token));
      return;
    }
    router.replace(clubManagerHubPath());
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <p className="text-sm text-gray-600">Redirecting to Club Manager…</p>
    </div>
  );
}
