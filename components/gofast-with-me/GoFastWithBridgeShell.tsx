'use client';

import Link from 'next/link';
import { getAppOpenUrl } from '@/lib/gofast-with-me/gofast-with-bridge';

export function GoFastWithAppAllusion() {
  const appUrl = getAppOpenUrl();
  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 space-y-2">
      <p className="text-sm text-gray-700">
        Once you GoFast with them here, you can keep going together in the{' '}
        <strong>GoFast app</strong> — training, runs, updates, and chatter.
      </p>
      <a
        href={appUrl}
        className="inline-flex text-sm font-semibold text-sky-700 hover:text-sky-900"
      >
        Get the app →
      </a>
    </div>
  );
}

export function GoFastWithBridgeShell({
  children,
  backHref,
  backLabel = 'Back',
}: {
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-orange-50 px-4 py-10">
      <div className="max-w-md mx-auto space-y-4">
        {backHref ? (
          <Link href={backHref} className="text-sm font-medium text-sky-700 hover:text-sky-900">
            ← {backLabel}
          </Link>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function GoFastWithTargetCard({
  target,
  headline,
}: {
  target: {
    displayName: string;
    firstName: string | null;
    gofastHandle: string | null;
    photoURL?: string | null;
  };
  headline: string;
}) {
  return (
    <div className="text-center mb-6">
      {target.photoURL ? (
        <img
          src={target.photoURL}
          alt=""
          className="w-16 h-16 rounded-full object-cover mx-auto mb-4 border-2 border-gray-200"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold">
          {(target.firstName?.[0] || target.displayName[0] || 'G').toUpperCase()}
        </div>
      )}
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">
        GoFast with Others
      </p>
      <h1 className="text-2xl font-bold text-gray-900 mt-2">{headline}</h1>
      {target.gofastHandle ? (
        <p className="text-sm text-gray-500 mt-1">@{target.gofastHandle}</p>
      ) : null}
    </div>
  );
}
