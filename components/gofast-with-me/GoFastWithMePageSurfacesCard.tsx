'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import GoFastWithMeUrlEditor from '@/components/profile/GoFastWithMeUrlEditor';

type Props = {
  liveUrl: string;
  appUrl: string;
  publicSlug: string;
  gofastHandle: string;
  slugUsesHandle: boolean;
  isPublishReady: boolean;
  copyDone: boolean;
  onCopyAppUrl: () => void;
  onUrlUpdated: (slug: string, usesHandle: boolean) => void;
  onOpenCommunity?: () => void;
};

export default function GoFastWithMePageSurfacesCard({
  liveUrl,
  appUrl,
  publicSlug,
  gofastHandle,
  slugUsesHandle,
  isPublishReady,
  copyDone,
  onCopyAppUrl,
  onUrlUpdated,
  onOpenCommunity,
}: Props) {
  const memberHubPath = `/container/${encodeURIComponent(publicSlug)}`;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Your surfaces</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            {isPublishReady
              ? 'Public landing is the door; the container is where followers engage.'
              : 'Finish your landing page, then share your public URL.'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            isPublishReady
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-900'
          }`}
        >
          {isPublishReady ? 'Ready' : 'Draft'}
        </span>
      </div>

      <a
        href={liveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
      >
        View public page
        <ExternalLink className="h-3.5 w-3.5" />
      </a>

      <Link
        href={memberHubPath}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100"
      >
        View as member
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>

      {onOpenCommunity ? (
        <button
          type="button"
          onClick={onOpenCommunity}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
        >
          View as manager
        </button>
      ) : null}

      <GoFastWithMeUrlEditor
        gofastHandle={gofastHandle}
        publicSlug={publicSlug}
        slugUsesHandle={slugUsesHandle}
        publicUrl={liveUrl}
        onUpdated={onUrlUpdated}
      />

      <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
        <p className="text-xs text-gray-500">In-app preview</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="text-xs text-gray-800 truncate flex-1">{appUrl}</code>
          <button
            type="button"
            onClick={onCopyAppUrl}
            className="text-xs font-medium text-orange-600 hover:text-orange-700"
          >
            {copyDone ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </section>
  );
}
