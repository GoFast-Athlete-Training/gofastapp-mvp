'use client';

export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * MVP1: Settings page deprecated - redirecting to profile edit
 * 
 * Profile management is now done via the profile icon in navigation.
 * The settings page was redundant (just showed profile info and linked to edit).
 * 
 * All Garmin connection code has been preserved in git history (commit 7c0244d).
 * To restore for MVP2, check git history for the full implementation.
 */
export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to profile edit since settings is redundant
    router.replace('/athlete-edit-profile');
  }, [router]);

  return null;
}
