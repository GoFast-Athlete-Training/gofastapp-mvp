'use client';

import { useEffect } from 'react';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silently fail if service worker registration fails
      });
    }
  }, []);

  return <>{children}</>;
}

