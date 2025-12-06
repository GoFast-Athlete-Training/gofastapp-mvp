'use client';

import DataSyncBanner from './DataSyncBanner';

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DataSyncBanner />
      {children}
    </>
  );
}

