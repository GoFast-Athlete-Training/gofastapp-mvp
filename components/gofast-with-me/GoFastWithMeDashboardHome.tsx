'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, Globe, Users } from 'lucide-react';
import { STUDIO_CENTRAL_LABEL, type StudioSection } from '@/components/gofast-with-me/studio-sections';

export type DashboardMetrics = {
  followerCount: number | null;
  landingComplete: boolean;
  publishReady: boolean;
  planPublished: boolean | null;
  planName: string | null;
  liveUrl: string;
  invitePath: string;
};

type Props = {
  metrics: DashboardMetrics;
  visitorHeadline: string;
  onOpenWorkspace: (section: StudioSection) => void;
};

type Stoplight = 'red' | 'yellow' | 'green';

function myPageStoplight(landingComplete: boolean, publishReady: boolean): Stoplight {
  if (landingComplete) return 'green';
  if (publishReady) return 'yellow';
  return 'red';
}

const STOPLIGHT_LABELS: Record<Stoplight, string> = {
  red: 'Not started',
  yellow: 'In progress',
  green: 'Complete',
};

const STOPLIGHT_HINTS: Record<Stoplight, string> = {
  red: 'Finish welcome, bio, photo on My Page',
  yellow: 'Almost there — finish welcome, bio, and run image',
  green: 'Your public door is ready',
};

const STOPLIGHT_STYLES: Record<Stoplight, string> = {
  red: 'border-red-200 bg-red-50/60',
  yellow: 'border-amber-200 bg-amber-50/60',
  green: 'border-emerald-200 bg-emerald-50/60',
};

export default function GoFastWithMeDashboardHome({
  metrics,
  visitorHeadline,
  onOpenWorkspace,
}: Props) {
  const [inviteCopied, setInviteCopied] = useState(false);
  const stoplight = myPageStoplight(metrics.landingComplete, metrics.publishReady);
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
          Goal and plan first — your public page, shared training plan, and the hub followers join.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Setup Progress
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onOpenWorkspace('page')}
            className={`rounded-xl border p-4 text-left transition-colors hover:opacity-90 ${STOPLIGHT_STYLES[stoplight]}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              My Page stoplight
            </p>
            <div className="mt-2 flex items-center gap-2">
              <StoplightDot level={stoplight} />
              <p className="text-xl font-bold text-gray-900">{STOPLIGHT_LABELS[stoplight]}</p>
              {stoplight === 'green' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
              ) : null}
            </div>
            <p className="mt-1 text-xs text-gray-600">{STOPLIGHT_HINTS[stoplight]}</p>
          </button>

          <button
            type="button"
            onClick={() => onOpenWorkspace('plan')}
            className={`rounded-xl border p-4 text-left hover:opacity-90 transition-colors ${
              planLive ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Plan strip
            </p>
            <p className="mt-2 text-xl font-bold text-gray-900">
              {planLive ? 'Shared' : 'Not shared yet'}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              {planLive && metrics.planName
                ? metrics.planName
                : 'Publish your GoFast plan so followers see your week'}
            </p>
          </button>
        </div>

        {stoplight !== 'green' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-3">
            <span>
              Set up <strong>My Page</strong> first — welcome, bio, what visitors will see, and a
              run image. Then share your plan and post journey <strong>Messages</strong>.
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
                    They see your plan strip and journey messages in GoFast With Me.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenWorkspace('followers')}
                className="shrink-0 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
              >
                Open Followers
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">None yet — invite your first one</p>
                <p className="text-xs text-gray-600 mt-1">
                  Share your follow link. When someone joins, they follow your goal, plan strip, and
                  messages.
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

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex flex-wrap items-center justify-between gap-3">
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
          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
        >
          View live page →
        </a>
      </div>
    </div>
  );
}

function StoplightDot({ level }: { level: Stoplight }) {
  const colors: Record<Stoplight, string> = {
    red: 'bg-red-500',
    yellow: 'bg-amber-400',
    green: 'bg-emerald-500',
  };
  return (
    <span
      className={`h-3 w-3 rounded-full shrink-0 ${colors[level]}`}
      aria-hidden
    />
  );
}
