import { Trophy } from 'lucide-react';
import type { GoFastWithMeTrainingFor } from '@/lib/gofast-with-me/training-for-types';

const MS_PER_DAY = 86_400_000;

function dayDelta(targetIso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetIso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

function countdownLabel(
  targetIso: string
): { label: string; tone: 'soft' | 'race-week' | 'race-day' } | null {
  const days = dayDelta(targetIso);
  if (days < 0) return null;
  if (days === 0) return { label: 'Race day', tone: 'race-day' };
  if (days <= 7) return { label: 'Race week', tone: 'race-week' };
  if (days <= 28) return { label: `${days} days to go`, tone: 'soft' };
  const weeks = Math.round(days / 7);
  return { label: `${weeks} weeks to go`, tone: 'soft' };
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

type Props = GoFastWithMeTrainingFor;

export default function AthleteCommunityGoalRaceCompact({
  trainingSummary,
  primaryChasingGoal,
}: Props) {
  let raceName: string | null = null;
  let raceDate: string | null = null;
  let raceCity: string | null = null;
  let raceState: string | null = null;
  let distanceLabel: string | null = null;
  let targetIso: string | null = null;
  let goalTime: string | null = null;
  let raceLogoUrl: string | null = null;

  if (trainingSummary) {
    raceName = trainingSummary.raceName;
    raceDate = trainingSummary.raceDate;
    raceCity = trainingSummary.raceCity;
    raceState = trainingSummary.raceState;
    distanceLabel = trainingSummary.raceDistanceLabel;
    targetIso = trainingSummary.raceDate;
    raceLogoUrl = primaryChasingGoal?.raceLogoUrl ?? null;
    goalTime = primaryChasingGoal?.goalTime ?? null;
  } else if (primaryChasingGoal) {
    raceName = primaryChasingGoal.raceName ?? primaryChasingGoal.name;
    raceDate = primaryChasingGoal.raceDate ?? primaryChasingGoal.targetByDate;
    raceCity = primaryChasingGoal.raceCity;
    raceState = primaryChasingGoal.raceState;
    distanceLabel = primaryChasingGoal.raceDistanceLabel ?? primaryChasingGoal.distance;
    targetIso = primaryChasingGoal.raceDate ?? primaryChasingGoal.targetByDate;
    goalTime = primaryChasingGoal.goalTime;
    raceLogoUrl = primaryChasingGoal.raceLogoUrl ?? null;
  }

  if (!raceName && !targetIso) return null;

  const countdown = targetIso ? countdownLabel(targetIso) : null;
  const pastRace = targetIso && !countdown ? 'Completed' : null;
  const dateStr = formatRaceDate(raceDate);
  const where = locationLine(raceCity, raceState);
  const meta = [dateStr, where, distanceLabel].filter(Boolean).join(' · ');

  const countdownChip = countdown
    ? countdown.tone === 'race-day'
      ? 'bg-orange-500 text-white'
      : countdown.tone === 'race-week'
        ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-200'
        : 'bg-white text-orange-700 ring-1 ring-orange-200'
    : 'bg-gray-100 text-gray-700 ring-1 ring-gray-200';

  return (
    <section className="h-full rounded-2xl border border-orange-200 bg-orange-50/70 p-5 shadow-sm">
      <div className="flex items-start gap-4">
        {raceLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={raceLogoUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl border border-orange-100 object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
            <Trophy className="h-6 w-6" aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Goal Race</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">{raceName ?? 'Goal race'}</h2>
            {countdown || pastRace ? (
              <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${countdownChip}`}>
                {countdown?.label ?? pastRace}
              </span>
            ) : null}
          </div>
          {meta ? <p className="mt-1.5 text-sm text-gray-600">{meta}</p> : null}
          {goalTime ? (
            <p className="mt-1 text-sm text-gray-700">
              Goal time: <span className="font-semibold">{goalTime}</span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
