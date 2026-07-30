'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronRight, Copy, ExternalLink, Users } from 'lucide-react';
import {
  STUDIO_BIN_LABELS,
  STUDIO_BIN_ORDER,
  STUDIO_CENTRAL_LABEL,
  type StudioSection,
} from '@/components/gofast-with-me/studio-sections';
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

function pageHealthLabel(status: SetupStatus): string {
  if (status === 'ready') return 'Ready';
  return 'Needs work';
}

function pageHealthClass(status: SetupStatus): string {
  if (status === 'ready') return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  return 'text-amber-800 bg-amber-50 border-amber-100';
}

function planHealthClass(live: boolean): string {
  return live
    ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
    : 'text-stone-600 bg-stone-50 border-stone-200';
}

export default function GoFastWithMeDashboardHome({
  metrics,
  visitorHeadline,
  onOpenWorkspace,
  onUrlUpdated,
}: Props) {
  const [inviteCopied, setInviteCopied] = useState(false);
  const [urlEditorOpen, setUrlEditorOpen] = useState(false);
  const pageStatus = myPageSetupStatus(metrics.landingComplete, metrics.publishReady);
  const memberCount = metrics.followerCount ?? 0;
  const planLive = metrics.planPublished === true;

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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{STUDIO_CENTRAL_LABEL}</h2>
        <p className="text-sm text-gray-600 mt-1">
          Check setup, invite people, and see who joined your community.
        </p>
      </div>

      {/* 1. Compact setup health strip */}
      <section className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-1 mb-2">
          Setup
        </p>
        <ul className="divide-y divide-gray-100">
          <HealthRow
            label="My Page"
            status={
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pageHealthClass(pageStatus)}`}
              >
                {pageStatus === 'ready' ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                ) : null}
                {pageHealthLabel(pageStatus)}
              </span>
            }
            onClick={() => onOpenWorkspace('page')}
          />
          <HealthRow
            label="My Plan"
            status={
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${planHealthClass(planLive)}`}
              >
                {planLive ? 'Public' : 'Not public'}
              </span>
            }
            onClick={() => onOpenWorkspace('plan')}
          />
          <HealthRow
            label="My Content"
            status={
              <span className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-semibold text-stone-500">
                Coming soon
              </span>
            }
            onClick={() => onOpenWorkspace('content')}
            muted
          />
        </ul>
      </section>

      {pageStatus !== 'ready' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-3">
          <span>
            Finish <strong>My Page</strong> first — welcome, bio, run image — then invite people below.
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

      {/* 2. Invite hero */}
      <section className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-5 space-y-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">Invite people to your community</h3>
          <p className="text-sm text-gray-600 mt-1">
            Share your invite link so others can follow you and join your personal community.
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
          Public headline: <strong className="text-gray-700">{visitorHeadline}</strong>
        </p>
        <details
          open={urlEditorOpen}
          onToggle={(e) => setUrlEditorOpen((e.target as HTMLDetailsElement).open)}
          className="rounded-lg border border-gray-200 bg-white/80"
        >
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

      {/* 3. Followers metric */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-orange-100 p-2 text-orange-700">
              <Users className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Followers
              </p>
              <p className="text-3xl font-bold text-gray-900 tabular-nums leading-tight mt-0.5">
                {memberCount}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {memberCount === 0
                  ? 'Nobody yet — copy your invite link above to get your first follower.'
                  : memberCount === 1
                    ? 'One person in your community.'
                    : `${memberCount} people in your community.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenWorkspace('community')}
            className="shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Open My Community
          </button>
        </div>
      </section>

      {/* 4. Quiet workspace shortcuts */}
      <section className="pt-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
          Open workspace
        </p>
        <div className="flex flex-wrap gap-x-1 gap-y-1 text-sm">
          {STUDIO_BIN_ORDER.map((section, index) => (
            <span key={section} className="inline-flex items-center">
              {index > 0 ? (
                <span className="text-gray-300 mx-1 select-none" aria-hidden>
                  ·
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenWorkspace(section)}
                className="font-medium text-gray-600 hover:text-orange-700 hover:underline"
              >
                {STUDIO_BIN_LABELS[section]}
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function HealthRow({
  label,
  status,
  onClick,
  muted,
}: {
  label: string;
  status: React.ReactNode;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center justify-between gap-3 px-1 py-2 text-left rounded-md hover:bg-gray-50 transition-colors ${
          muted ? 'opacity-80' : ''
        }`}
      >
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className="flex items-center gap-1 shrink-0">
          {status}
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" aria-hidden />
        </span>
      </button>
    </li>
  );
}
