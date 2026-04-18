import { Trophy } from 'lucide-react';

type TrainingSummary = {
  planName: string;
  startDate: string;
  totalWeeks: number;
  raceName: string | null;
  raceDate: string | null;
  raceCity: string | null;
  raceState: string | null;
  raceDistanceLabel: string | null;
};

type ChasingGoal = {
  name: string | null;
  distance: string;
  goalTime: string | null;
  targetByDate: string;
  raceName: string | null;
  raceDate: string | null;
  raceCity: string | null;
  raceState: string | null;
  raceDistanceLabel: string | null;
};

type Props = {
  trainingSummary: TrainingSummary | null;
  primaryChasingGoal: ChasingGoal | null;
};

const MS_PER_DAY = 86_400_000;

function dayDelta(targetIso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetIso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

function countdownLabel(targetIso: string): { label: string; tone: 'soft' | 'race-week' | 'race-day' } | null {
  const days = dayDelta(targetIso);
  if (days < 0) return null;
  if (days === 0) return { label: 'Race day', tone: 'race-day' };
  if (days <= 7) return { label: 'Race week', tone: 'race-week' };
  if (days <= 28) return { label: `${days} days to go`, tone: 'soft' };
  const weeks = Math.round(days / 7);
  return { label: `${weeks} weeks to go`, tone: 'soft' };
}

function planWeekProgress(startIso: string, totalWeeks: number): { week: number; total: number; pct: number } | null {
  if (!totalWeeks || totalWeeks <= 0) return null;
  const start = new Date(startIso);
  const now = new Date();
  const weeksIn = Math.floor((now.getTime() - start.getTime()) / (7 * MS_PER_DAY));
  const week = Math.max(1, Math.min(totalWeeks, weeksIn + 1));
  return { week, total: totalWeeks, pct: Math.min(100, Math.round((week / totalWeeks) * 100)) };
}

function formatRaceDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function locationLine(city: string | null, state: string | null): string | null {
  if (city && state) return `${city}, ${state}`;
  return city || state || null;
}

export default function GoalRaceCard({ trainingSummary, primaryChasingGoal }: Props) {
  // Determine the goal target date and headline copy from whichever source is present.
  let raceName: string | null = null;
  let raceDate: string | null = null;
  let raceCity: string | null = null;
  let raceState: string | null = null;
  let distanceLabel: string | null = null;
  let targetIso: string | null = null;
  let goalTime: string | null = null;
  let progress: { week: number; total: number; pct: number } | null = null;
  let planName: string | null = null;

  if (trainingSummary) {
    raceName = trainingSummary.raceName;
    raceDate = trainingSummary.raceDate;
    raceCity = trainingSummary.raceCity;
    raceState = trainingSummary.raceState;
    distanceLabel = trainingSummary.raceDistanceLabel;
    targetIso = trainingSummary.raceDate;
    progress = planWeekProgress(trainingSummary.startDate, trainingSummary.totalWeeks);
    planName = trainingSummary.planName;
  } else if (primaryChasingGoal) {
    raceName = primaryChasingGoal.raceName ?? primaryChasingGoal.name;
    raceDate = primaryChasingGoal.raceDate ?? primaryChasingGoal.targetByDate;
    raceCity = primaryChasingGoal.raceCity;
    raceState = primaryChasingGoal.raceState;
    distanceLabel = primaryChasingGoal.raceDistanceLabel ?? primaryChasingGoal.distance;
    targetIso = primaryChasingGoal.raceDate ?? primaryChasingGoal.targetByDate;
    goalTime = primaryChasingGoal.goalTime;
  }

  if (!raceName && !targetIso) return null;

  const countdown = targetIso ? countdownLabel(targetIso) : null;
  if (!countdown) return null;

  const dateStr = formatRaceDate(raceDate);
  const where = locationLine(raceCity, raceState);
  const meta = [dateStr, where, distanceLabel].filter(Boolean).join(' \u00b7 ');

  const countdownChip =
    countdown.tone === 'race-day'
      ? 'bg-orange-500 text-white'
      : countdown.tone === 'race-week'
      ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-200 animate-pulse'
      : 'bg-white text-orange-700 ring-1 ring-orange-200';

  return (
    <section className="bg-orange-50/70 border border-orange-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-700 tracking-wider uppercase">
            <Trophy className="w-3.5 h-3.5" />
            Chasing
          </div>
          <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-stone-900 leading-tight">
            {raceName ?? 'Goal race'}
          </h2>
          {meta && <p className="mt-1.5 text-sm text-stone-600">{meta}</p>}
          {goalTime && !progress && (
            <p className="mt-1 text-sm text-stone-700">
              Goal time: <span className="font-semibold">{goalTime}</span>
            </p>
          )}
        </div>
        <span className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full ${countdownChip}`}>
          {countdown.label}
        </span>
      </div>

      {progress && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-stone-600 mb-1.5">
            <span className="font-semibold text-stone-700">
              Week {progress.week} of {progress.total}
            </span>
            {planName && <span className="truncate ml-2">{planName}</span>}
          </div>
          <div className="h-1.5 w-full bg-orange-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
