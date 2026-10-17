'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, CheckCircle2, Copy, ExternalLink, MapPin, Pencil, Trash2 } from 'lucide-react';
import { formatCalendarDate } from '@/lib/calendar-date';
import { formatRunTime } from '@/utils/formatTime';
import type { RunnerAgendaItem } from '@/lib/runner/runner-agenda';
import { isHostRsvpRole } from '@/lib/city-run/rsvp-role';
import { companyRunLinkSliceUrl } from '@/lib/city-run-public-card-url';
import { runCompletePath } from '@/lib/city-run/run-nav-paths';
import api from '@/lib/api';

type RunnerAgendaCardProps = {
  item: RunnerAgendaItem;
  checkingInId: string | null;
  onCheckin: (runId: string) => void;
  onDeleted?: () => void;
};

export default function RunnerAgendaCard({
  item,
  checkingInId,
  onCheckin,
  onDeleted,
}: RunnerAgendaCardProps) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!item.joinedRun) return null;
  const run = item.joinedRun;

  const dateKey = item.dateKey;
  const dateLabel = formatCalendarDate(`${dateKey}T12:00:00.000Z`, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const runTimeStr = formatRunTime({
    startTimeHour: run.startTimeHour,
    startTimeMinute: run.startTimeMinute,
    startTimePeriod: run.startTimePeriod,
  });

  const runSegment = run.slug?.trim() || run.id;
  const runHref = `/cityruntogether/${encodeURIComponent(runSegment)}`;
  const recapHref = runCompletePath(runSegment);
  const showRecapCta = run.isPast || run.cityRunExecutionStatus === 'RAN';

  const isCreated = isHostRsvpRole(run.rsvpRole);
  const membershipBadge = isCreated ? 'Created' : 'Joined';

  const headerLabel = item.isToday ? "Today's run" : run.isPast ? 'Past run' : 'Upcoming';

  async function copyInviteLink() {
    const url = companyRunLinkSliceUrl(runSegment);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function deleteRun() {
    if (
      !window.confirm(`Delete "${run.title}"? This removes the invite and cannot be undone.`)
    ) {
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/me/hosted-run-invites/${encodeURIComponent(run.id)}`);
      onDeleted?.();
    } catch (err) {
      console.error('Delete run failed:', err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200/80 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">{headerLabel}</p>
          <p className="mt-1 text-sm text-gray-600 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {dateLabel}
            {runTimeStr ? ` · ${runTimeStr}` : null}
          </p>
        </div>
        {run.hasCheckin ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Checked in
          </span>
        ) : null}
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50/40 px-4 py-3 space-y-2">
        <span
          className={
            isCreated
              ? 'inline-flex rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-orange-800'
              : 'inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-900'
          }
        >
          {membershipBadge}
        </span>
        <p className="font-semibold text-gray-900">{run.title}</p>
        <p className="text-sm text-gray-600 flex items-start gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-gray-400" aria-hidden />
          <span>
            {run.meetUpPoint}
            {[run.meetUpCity, run.meetUpState].filter(Boolean).length
              ? ` · ${[run.meetUpCity, run.meetUpState].filter(Boolean).join(', ')}`
              : run.city
                ? ` · ${run.city}`
                : ''}
          </span>
        </p>
        {run.totalMiles || run.pace ? (
          <p className="text-sm text-gray-600">
            {[run.totalMiles ? `${run.totalMiles} mi` : null, run.pace].filter(Boolean).join(' · ')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {!isCreated && run.supportsCheckin && run.isLive && !run.hasCheckin ? (
          <button
            type="button"
            disabled={checkingInId !== null}
            onClick={() => onCheckin(run.id)}
            className="inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {checkingInId === run.id ? 'Checking in…' : 'Check in'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void copyInviteLink()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700"
        >
          <Copy className="h-4 w-4" />
          {copied ? 'Copied' : 'Copy invite link'}
        </button>
        {isCreated ? (
          <Link
            href={`/host-a-run/${encodeURIComponent(run.id)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        ) : null}
        {showRecapCta ? (
          <Link
            href={recapHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            <ExternalLink className="h-4 w-4" />
            See how the run went
          </Link>
        ) : (
          <Link
            href={runHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4" />
            Open run page
          </Link>
        )}
        {isCreated ? (
          <button
            type="button"
            disabled={deleting}
            onClick={() => void deleteRun()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        ) : null}
      </div>
    </article>
  );
}
