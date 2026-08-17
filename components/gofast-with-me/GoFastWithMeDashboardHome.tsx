'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Users } from 'lucide-react';
import { STUDIO_CENTRAL_LABEL, type StudioSection } from '@/components/gofast-with-me/studio-sections';
import GoFastWithMeUrlEditor from '@/components/profile/GoFastWithMeUrlEditor';
import {
  athleteCommunityPath,
  athleteCommunityPreviewPath,
} from '@/lib/gofast-with-me/athlete-community-routes';

export type DashboardMetrics = {
  followerCount: number | null;
  landingComplete: boolean;
  publishReady: boolean;
  planPublished: boolean | null;
  planName: string | null;
  liveUrl: string;
  invitePath: string;
  publicSlug: string;
  gofastHandle: string;
  slugUsesHandle: boolean;
};

type Props = {
  metrics: DashboardMetrics;
  visitorHeadline: string;
  onOpenWorkspace: (section: StudioSection) => void;
  onUrlUpdated?: (slug: string, usesHandle: boolean) => void;
};

type SetupStatus = 'not_started' | 'in_progress' | 'ready';

function myPageSetupStatus(landingComplete: boolean, publishReady: boolean): SetupStatus {
  if (landingComplete) return 'ready';
  if (publishReady) return 'in_progress';
  return 'not_started';
}

function pageHealthLabel(status: SetupStatus): string {
  if (status === 'ready') return 'Ready';
  if (status === 'in_progress') return 'Almost';
  return 'Needs work';
}

type Stoplight = 'green' | 'yellow' | 'red' | 'gray';

function pageStoplight(status: SetupStatus): Stoplight {
  if (status === 'ready') return 'green';
  if (status === 'in_progress') return 'yellow';
  return 'red';
}

function planStoplight(live: boolean): Stoplight {
  return live ? 'green' : 'yellow';
}

function stoplightDotClass(light: Stoplight): string {
  switch (light) {
    case 'green':
      return 'bg-emerald-500 ring-emerald-500/30';
    case 'yellow':
      return 'bg-amber-400 ring-amber-400/30';
    case 'red':
      return 'bg-red-500 ring-red-500/30';
    default:
      return 'bg-gray-300 ring-gray-300/30';
  }
}

export default function GoFastWithMeDashboardHome({
  metrics,
  visitorHeadline,
  onOpenWorkspace,
  onUrlUpdated,
}: Props) {
  const [inviteCopied, setInviteCopied] = useState(false);
  const pageStatus = myPageSetupStatus(metrics.landingComplete, metrics.publishReady);
  const memberCount = metrics.followerCount ?? 0;
  const planLive = metrics.planPublished === true;
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
    <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
      <div className="space-y-5 lg:col-span-7">
        <div className="space-y-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{STUDIO_CENTRAL_LABEL}</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Your community at a glance — setup status, followers, and invite link.
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2"
            role="group"
            aria-label="Setup status"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 shrink-0">
              Setup
            </span>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <StoplightChip
                label="Landing"
                light={pageStoplight(pageStatus)}
                hint={pageHealthLabel(pageStatus)}
                onClick={() => onOpenWorkspace('page')}
              />
              <StoplightChip
                label="Messages"
                light="green"
                hint="Live"
                onClick={() => onOpenWorkspace('community')}
              />
              <StoplightChip
                label="Runs/Training"
                light={planStoplight(planLive)}
                hint={planLive ? 'Public' : 'Private'}
                onClick={() => onOpenWorkspace('workouts')}
              />
              <StoplightChip
                label="Tips"
                light="gray"
                hint="Library"
                onClick={() => onOpenWorkspace('content')}
              />
            </div>
          </div>

          {pageStatus !== 'ready' ? (
            <p className="text-xs text-amber-800 px-1">
              Landing still needs work — use <strong>Landing page</strong> in the sidebar.
            </p>
          ) : null}
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
          </div>
        </section>

        <section className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Invite link</h3>
            <p className="text-xs text-gray-600 mt-0.5">
              Copy and share so people can follow you.
            </p>
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
            <a
              href={metrics.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-orange-800 hover:bg-orange-50"
            >
              View public page
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
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
      </div>

      <aside className="mt-5 space-y-3 rounded-xl border border-gray-200 bg-white p-5 lg:col-span-5 lg:mt-0 lg:sticky lg:top-6">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Arrange and see what your community sees</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Choose what shows up, then check how it looks to followers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={followerPreviewPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-800 hover:bg-orange-100"
          >
            See what followers see
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={publicCommunityPath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-100"
          >
            Open public community
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="grid gap-2">
          <ArrangeShortcutCard
            title="Daily log"
            description="How you're feeling today — spills into the member feed."
            action="Open Daily log"
            onClick={() => onOpenWorkspace('community')}
          />
          <ArrangeShortcutCard
            title="Topics"
            description="Publish tips and thinking by topic."
            action="Open Tips"
            onClick={() => onOpenWorkspace('content')}
          />
          <ArrangeShortcutCard
            title="Next blog"
            description="Longer posts live in Tips & Thinking."
            action="Open Tips"
            onClick={() => onOpenWorkspace('content')}
          />
          <ArrangeShortcutCard
            title="Next run"
            description="Pick the run or workout followers see on your community."
            action="Open Runs"
            onClick={() => onOpenWorkspace('workouts')}
          />
        </div>
      </aside>
    </div>
  );
}

function ArrangeShortcutCard({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-left transition hover:border-orange-200 hover:bg-orange-50"
    >
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-gray-600">{description}</p>
      <p className="mt-2 text-xs font-semibold text-orange-700">{action} →</p>
    </button>
  );
}

function StoplightChip({
  label,
  light,
  hint,
  onClick,
  muted,
}: {
  label: string;
  light: Stoplight;
  hint: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label}: ${hint}`}
      className={`inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-white/80 transition-colors ${
        muted ? 'opacity-70' : ''
      }`}
    >
      <span
        className={`h-2.5 w-2.5 rounded-full shrink-0 ring-2 ${stoplightDotClass(light)}`}
        aria-hidden
      />
      <span className="text-xs font-medium text-gray-800">{label}</span>
      <span className="text-[10px] text-gray-500 hidden sm:inline">{hint}</span>
    </button>
  );
}
