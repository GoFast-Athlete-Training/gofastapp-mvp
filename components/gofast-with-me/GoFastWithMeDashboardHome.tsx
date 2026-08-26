'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Users } from 'lucide-react';
import { STUDIO_COMMUNITY_LABEL } from '@/components/gofast-with-me/studio-sections';
import GoFastWithMeUrlEditor from '@/components/profile/GoFastWithMeUrlEditor';
import {
  athleteCommunityPath,
  athleteCommunityPreviewPath,
} from '@/lib/gofast-with-me/athlete-community-routes';

export type DashboardMetrics = {
  followerCount: number | null;
  liveUrl: string;
  invitePath: string;
  publicSlug: string;
  gofastHandle: string;
  slugUsesHandle: boolean;
};

type Props = {
  metrics: DashboardMetrics;
  visitorHeadline: string;
  onOpenMembers?: () => void;
  onUrlUpdated?: (slug: string, usesHandle: boolean) => void;
};

export default function GoFastWithMeDashboardHome({
  metrics,
  visitorHeadline,
  onOpenMembers,
  onUrlUpdated,
}: Props) {
  const [inviteCopied, setInviteCopied] = useState(false);
  const memberCount = metrics.followerCount ?? 0;
  const publicCommunityPath = athleteCommunityPath(metrics.publicSlug);
  const followerPreviewPath = athleteCommunityPreviewPath(metrics.publicSlug);

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${metrics.invitePath}`
      : metrics.invitePath;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-5 max-w-3xl pb-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{STUDIO_COMMUNITY_LABEL}</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          Your follower feed — invite people, then preview what they see.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Followers</p>
        <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2 text-orange-700">
              <Users className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-4xl font-bold text-gray-900 tabular-nums leading-none">{memberCount}</p>
          </div>
          <div className="text-sm text-gray-600 pb-0.5">
            {memberCount === 0
              ? 'No followers yet.'
              : memberCount === 1
                ? '1 follower'
                : `${memberCount} followers`}
          </div>
          {onOpenMembers ? (
            <button
              type="button"
              onClick={onOpenMembers}
              className="text-sm font-semibold text-orange-600 hover:text-orange-700 pb-0.5"
            >
              Manage members →
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Invite link</h3>
          <p className="text-xs text-gray-600 mt-0.5">Copy and share so people can follow you.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
          >
            <Copy className="h-4 w-4 shrink-0" aria-hidden />
            {inviteCopied ? 'Link copied' : 'Copy invite link'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Headline: <strong className="text-gray-700">{visitorHeadline}</strong>
        </p>
        <details className="rounded-lg border border-gray-200 bg-white/80">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900">
            Edit public URL
          </summary>
          <div className="border-t border-gray-100 px-3 py-3">
            <GoFastWithMeUrlEditor
              gofastHandle={metrics.gofastHandle}
              publicSlug={metrics.publicSlug}
              slugUsesHandle={metrics.slugUsesHandle}
              publicUrl={metrics.liveUrl}
              onUpdated={(slug, usesHandle) => onUrlUpdated?.(slug, usesHandle)}
            />
          </div>
        </details>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Preview</p>
        <p className="text-xs text-gray-600">Check how your community looks to followers.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href={followerPreviewPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100"
          >
            See what followers see
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={publicCommunityPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-100"
          >
            Open public community
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>
    </div>
  );
}
