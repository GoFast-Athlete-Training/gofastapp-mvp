import Link from 'next/link';
import { Flag, Trophy } from 'lucide-react';
import {
  filterDoorCalendarRaces,
  resolveDoorGoalRace,
} from '@/lib/gofast-with-me/public-door-sidebar';

type TrainingSummary = {
  planName: string;
  startDate: string;
  totalWeeks: number;
  primaryAthleteRaceId?: string | null;
  raceName: string | null;
  raceDate: string | null;
  raceCity: string | null;
  raceState: string | null;
  raceDistanceLabel: string | null;
};

type ChasingGoal = {
  athleteRaceId?: string | null;
  name: string | null;
  distance: string;
  goalTime: string | null;
  targetByDate: string;
  raceName: string | null;
  raceDate: string | null;
  raceCity: string | null;
  raceState: string | null;
  raceDistanceLabel: string | null;
  raceSlug?: string | null;
};

type SignedUpRace = {
  id: string;
  athleteRaceId?: string | null;
  name: string;
  slug: string | null;
  raceDate: string;
  city: string | null;
  state: string | null;
  distanceLabel: string | null;
};

type PublishedPlan = {
  id: string;
  slug: string;
  title: string;
};

type Props = {
  trainingSummary: TrainingSummary | null;
  primaryChasingGoal: ChasingGoal | null;
  publishedPlans: PublishedPlan[];
  signedUpRaces: SignedUpRace[];
  containerMemberCount?: number;
};

function formatRaceDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRaceShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DoorSidebar({
  trainingSummary,
  primaryChasingGoal,
  publishedPlans,
  signedUpRaces,
  containerMemberCount = 0,
}: Props) {
  const primaryPlan = publishedPlans.find((p) => p.slug?.trim()) ?? null;
  const goalRace = resolveDoorGoalRace({
    primaryChasingGoal,
    trainingSummary,
    signedUpRaces,
  });
  const calendarRaces = filterDoorCalendarRaces(signedUpRaces, goalRace);

  const hasGoalRace = Boolean(goalRace);
  const hasPlan = Boolean(primaryPlan);
  const hasCalendar = calendarRaces.length > 0;
  const hasMembers = containerMemberCount > 0;

  if (!hasGoalRace && !hasPlan && !hasCalendar && !hasMembers) return null;

  const goalMeta = goalRace
    ? [formatRaceDate(goalRace.raceDate), goalRace.distanceLabel?.trim()].filter(Boolean).join(' · ')
    : null;

  return (
    <aside className="space-y-8">
      {hasGoalRace && goalRace ? (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-orange-700 mb-2">
            <Trophy className="w-3.5 h-3.5" />
            Goal race
          </div>
          <p className="text-lg font-bold text-stone-900 leading-snug">{goalRace.name}</p>
          {goalMeta ? <p className="mt-1 text-sm text-stone-600">{goalMeta}</p> : null}
        </div>
      ) : null}

      {hasPlan && primaryPlan ? (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
            My Training Plan
          </div>
          <p className="text-sm font-semibold text-stone-900 leading-snug">{primaryPlan.title}</p>
          <Link
            href={`/plans/${encodeURIComponent(primaryPlan.slug)}`}
            className="mt-3 inline-flex text-sm font-semibold text-orange-700 hover:text-orange-800"
          >
            See my plan →
          </Link>
        </div>
      ) : null}

      {hasCalendar ? (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">
            <Flag className="w-3.5 h-3.5" />
            On the calendar
          </div>
          <ul className="space-y-3">
            {calendarRaces.map((race) => {
              const meta = [formatRaceShort(race.raceDate), race.distanceLabel?.trim()]
                .filter(Boolean)
                .join(' · ');
              const inner = (
                <>
                  <p className="font-semibold text-stone-800 text-sm">{race.name}</p>
                  {meta ? <p className="text-xs text-stone-500 mt-0.5">{meta}</p> : null}
                </>
              );
              return (
                <li key={race.athleteRaceId ?? race.id}>
                  {race.slug ? (
                    <Link href={`/join/race/${race.slug}`} className="block hover:opacity-80">
                      {inner}
                    </Link>
                  ) : (
                    <div>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {hasMembers ? (
        <p className="text-xs text-stone-500">
          {containerMemberCount} {containerMemberCount === 1 ? 'runner' : 'runners'} following along
        </p>
      ) : null}
    </aside>
  );
}
