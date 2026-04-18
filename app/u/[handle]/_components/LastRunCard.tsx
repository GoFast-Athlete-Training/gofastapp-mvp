import { Activity } from 'lucide-react';

type LastRun = {
  activityName: string | null;
  startTime: string | null;
  distanceMiles: number | null;
  durationSeconds: number | null;
  activityType: string | null;
  source: string | null;
};

type Props = {
  lastRun: LastRun | null;
  weeklyMilesThisWeek: number;
};

const MS_PER_DAY = 86_400_000;

function relativeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  if (diffMs < 0) return 'just now';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(diffMs / MS_PER_DAY);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}

function formatDistance(miles: number | null): string {
  if (miles == null || miles <= 0) return '\u2014';
  return `${miles >= 100 ? miles.toFixed(0) : miles.toFixed(2)} mi`;
}

function formatPace(miles: number | null, seconds: number | null): string {
  if (!miles || !seconds || miles <= 0 || seconds <= 0) return '\u2014';
  const paceSecPerMile = seconds / miles;
  const m = Math.floor(paceSecPerMile / 60);
  const s = Math.floor(paceSecPerMile % 60);
  return `${m}:${s.toString().padStart(2, '0')}/mi`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '\u2014';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function sourceLabel(source: string | null): string | null {
  if (!source) return null;
  const s = source.toLowerCase();
  if (s === 'garmin') return 'Garmin';
  if (s === 'strava') return 'Strava';
  return source;
}

export default function LastRunCard({ lastRun, weeklyMilesThisWeek }: Props) {
  if (!lastRun || !lastRun.startTime) return null;

  const ago = relativeAgo(lastRun.startTime);
  const source = sourceLabel(lastRun.source);

  return (
    <section className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 tracking-wider uppercase">
          <Activity className="w-3.5 h-3.5" />
          Last run
          <span className="text-stone-400 font-normal normal-case tracking-normal">
            {'\u00b7 '}
            {ago}
          </span>
        </div>
        {source && (
          <span className="text-[10px] font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
            {source}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xl sm:text-2xl font-bold text-stone-900 tabular-nums">
            {formatDistance(lastRun.distanceMiles)}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-stone-500 font-medium mt-0.5">
            Distance
          </p>
        </div>
        <div>
          <p className="text-xl sm:text-2xl font-bold text-stone-900 tabular-nums">
            {formatPace(lastRun.distanceMiles, lastRun.durationSeconds)}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-stone-500 font-medium mt-0.5">
            Pace
          </p>
        </div>
        <div>
          <p className="text-xl sm:text-2xl font-bold text-stone-900 tabular-nums">
            {formatDuration(lastRun.durationSeconds)}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-stone-500 font-medium mt-0.5">
            Time
          </p>
        </div>
      </div>

      {lastRun.activityName && (
        <p className="mt-3 text-sm italic text-stone-500 truncate">
          &ldquo;{lastRun.activityName}&rdquo;
        </p>
      )}

      {weeklyMilesThisWeek > 0 && (
        <p className="mt-4 pt-3 border-t border-stone-100 text-xs text-stone-500">
          <span className="font-semibold text-stone-700 tabular-nums">
            {weeklyMilesThisWeek.toFixed(1)} mi
          </span>{' '}
          this week
        </p>
      )}
    </section>
  );
}
