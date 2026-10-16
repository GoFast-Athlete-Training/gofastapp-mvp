'use client';

import Link from 'next/link';
import { Calendar, CheckCircle2, MapPin } from 'lucide-react';
import { formatCalendarDate } from '@/lib/calendar-date';
import { formatRunTime } from '@/utils/formatTime';
import type { RunnerAgendaItem } from '@/lib/runner/runner-agenda';
import { isHostRsvpRole } from '@/lib/city-run/rsvp-role';

type RunnerAgendaCardProps = {
  item: RunnerAgendaItem;
  checkingInId: string | null;
  onCheckin: (runId: string) => void;
};

export default function RunnerAgendaCard({ item, checkingInId, onCheckin }: RunnerAgendaCardProps) {
  const run = item.joinedRun;
  if (!run) return null;

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

  const runHref = run.runClub?.slug
    ? `/runclub/${run.runClub.slug}`
    : run.slug
      ? `/gorun/${run.slug}`
      : `/gorun/${run.id}`;

  const isHost = isHostRsvpRole(run.rsvpRole);
  const roleLabel = isHost
    ? 'Run you created'
    : run.runClub?.name
      ? run.runClub.name
      : 'Member';

  const headerLabel = item.isToday
    ? "Today's run"
    : run.needsWereYouThere
      ? 'Confirm attendance'
      : 'Upcoming';

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
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">{roleLabel}</p>
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
        {run.supportsCheckin && run.isLive && !run.hasCheckin ? (
          <button
            type="button"
            disabled={checkingInId !== null}
            onClick={() => onCheckin(run.id)}
            className="inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {checkingInId === run.id ? 'Checking in…' : 'Check in'}
          </button>
        ) : null}
        {run.supportsCheckin && run.needsWereYouThere && !run.hasCheckin ? (
          <button
            type="button"
            disabled={checkingInId !== null}
            onClick={() => onCheckin(run.id)}
            className="inline-flex rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {checkingInId === run.id ? 'Saving…' : 'Were you there?'}
          </button>
        ) : null}
        <Link
          href={runHref}
          className="inline-flex rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          {run.runClub?.slug ? 'Club home' : 'Run details'}
        </Link>
      </div>
    </article>
  );
}
