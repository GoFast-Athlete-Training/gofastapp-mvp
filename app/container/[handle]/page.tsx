'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { legacyContainerRedirectTarget } from '@/lib/gofast-with-me/athlete-community-routes';

/** Legacy route — redirects to `/u/{handle}/community`. */
export default function LegacyContainerRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const handle = (params?.handle as string)?.trim() || '';

  useEffect(() => {
    if (!handle) return;
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const query = searchParams.toString();
    const target = legacyContainerRedirectTarget(
      handle,
      hash,
      query ? `?${query}` : null
    );
    router.replace(target);
  }, [handle, router, searchParams]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
    </div>
  );
}
