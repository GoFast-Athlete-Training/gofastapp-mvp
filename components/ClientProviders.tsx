'use client';

import { useEffect } from 'react';
import DataSyncBanner from './DataSyncBanner';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silently fail if service worker registration fails
      });
    }
  }, []);

  return (
    <>
      <DataSyncBanner />
      {children}
    </>
  );
}

