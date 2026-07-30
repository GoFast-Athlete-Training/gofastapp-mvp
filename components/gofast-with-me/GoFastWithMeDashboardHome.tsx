'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Globe, Target, Users } from 'lucide-react';
import { STUDIO_CENTRAL_LABEL, type StudioSection } from '@/components/gofast-with-me/studio-sections';
import GoFastWithMeUrlEditor from '@/components/profile/GoFastWithMeUrlEditor';

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

const MY_PAGE_STATUS_LABELS: Record<SetupStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  ready: 'Ready',
};

const MY_PAGE_STATUS_HINTS: Record<SetupStatus, string> = {
  not_started: 'Finish welcome, bio, photo on My Page',
  in_progress: 'Almost there — finish welcome, bio, and run image',
  ready: 'Your page is ready to share',
};

const MY_PAGE_STATUS_STYLES: Record<SetupStatus, string> = {
  not_started: 'border-red-200 bg-red-50/60',
  in_progress: 'border-amber-200 bg-amber-50/60',
  ready: 'border-emerald-200 bg-emerald-50/60',
};

export default function GoFastWithMeDashboardHome({
  metrics,
  visitorHeadline,
  onOpenWorkspace,
  onUrlUpdated,
}: Props) {
  const [inviteCopied, setInviteCopied] = useState(false);
  const pageStatus = myPageSetupStatus(metrics.landingComplete, metrics.publishReady);
  const memberCount = metrics.followerCount ?? 0;
  const hasMembers = memberCount > 0;
  const planLive = metrics.planPublished === true;

  const copyInvite = async () => {
    try {
      const url =
        typeof window !== 'undefined'
          ? `${window.location.origin}${metrics.invitePath}`
          : metrics.invitePath;
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{STUDIO_CENTRAL_LABEL}</h2>
        <p className="text-sm text-gray-600 mt-1">
          Set up your page, personal community, plan, and content — then share so others can join.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Your setup</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onOpenWorkspace('page')}
            className={`rounded-xl border p-4 text-left transition-colors hover:opacity-90 ${MY_PAGE_STATUS_STYLES[pageStatus]}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">My Page</p>
            <p className="text-[11px] text-gray-500 mt-0.5">public page</p>
            <div className="mt-2 flex items-center gap-2">
              <StatusDot level={pageStatus} />
              <p className="text-xl font-bold text-gray-900">{MY_PAGE_STATUS_LABELS[pageStatus]}</p>
              {pageStatus === 'ready' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
              ) : null}
            </div>
            <p className="mt-1 text-xs text-gray-600">{MY_PAGE_STATUS_HINTS[pageStatus]}</p>
          </button>

          <button
            type="button"
            onClick={() => onOpenWorkspace('community')}
            className={`rounded-xl border p-4 text-left hover:opacity-90 transition-colors ${
              hasMembers
                ? 'border-emerald-200 bg-emerald-50/60'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              My Community
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">personal community</p>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {memberCount} follower{memberCount === 1 ? '' : 's'}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              {hasMembers
                ? 'Messages and follower list in your community'
                : 'Post journey messages and see who follows you'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onOpenWorkspace('plan')}
            className={`rounded-xl border p-4 text-left hover:opacity-90 transition-colors ${
              planLive ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">My Plan</p>
            <p className="text-[11px] text-gray-500 mt-0.5">publish</p>
            <div className="mt-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-600 shrink-0" aria-hidden />
              <p className="text-xl font-bold text-gray-900">
                {planLive ? 'Published' : 'Not published'}
              </p>
              {planLive ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
              ) : null}
            </div>
            <p className="mt-1 text-xs text-gray-600">
              {planLive && metrics.planName
                ? `${metrics.planName} · followers see your training week`
                : planLive
                  ? 'Followers see your training week in the hub'
                  : 'Publish your GoFast plan for followers'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onOpenWorkspace('content')}
            className="rounded-xl border border-gray-200 bg-white p-4 text-left hover:bg-gray-50 hover:opacity-90 transition-colors"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">My Content</p>
            <p className="text-[11px] text-gray-500 mt-0.5">cms</p>
            <p className="mt-2 text-xl font-bold text-gray-900">Coming soon</p>
            <p className="mt-1 text-xs text-gray-600">Tips, routes, and blog posts for your hub</p>
          </button>
        </div>

        {pageStatus !== 'ready' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-3">
            <span>
              Set up <strong>My Page</strong> first — welcome, bio, what visitors will see, and a run
              image. Then publish your plan under <strong>My Plan</strong> and invite followers from{' '}
              <strong>My Community</strong>.
            </span>
            <button
              type="button"
              onClick={() => onOpenWorkspace('page')}
              className="shrink-0 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
            >
              Open My Page
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Followers</h3>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          {hasMembers ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {memberCount} {memberCount === 1 ? 'follower' : 'followers'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    They see your training week and journey messages in My Community.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenWorkspace('community')}
                className="shrink-0 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
              >
                Open My Community
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">None yet — invite your first one</p>
                <p className="text-xs text-gray-600 mt-1">
                  Share your page so others can join your personal community.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyInvite()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800 hover:bg-orange-100"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {inviteCopied ? 'Link copied' : 'Invite'}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Share your page
        </h3>
        <p className="text-xs text-gray-600 -mt-1">
          Share your page with others so they can join your personal community.
        </p>
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Globe className="h-4 w-4 text-orange-600 shrink-0" />
              <span>
                Public headline: <strong>{visitorHeadline}</strong>
              </span>
            </div>
            <a
              href={metrics.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
              View public page
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <GoFastWithMeUrlEditor
            gofastHandle={metrics.gofastHandle}
            publicSlug={metrics.publicSlug}
            slugUsesHandle={metrics.slugUsesHandle}
            publicUrl={metrics.liveUrl}
            onUpdated={(slug, usesHandle) => onUrlUpdated?.(slug, usesHandle)}
          />
        </div>
      </section>
    </div>
  );
}

function StatusDot({ level }: { level: SetupStatus }) {
  const colors: Record<SetupStatus, string> = {
    not_started: 'bg-red-500',
    in_progress: 'bg-amber-400',
    ready: 'bg-emerald-500',
  };
  return (
    <span
      className={`h-3 w-3 rounded-full shrink-0 ${colors[level]}`}
      aria-hidden
    />
  );
}
