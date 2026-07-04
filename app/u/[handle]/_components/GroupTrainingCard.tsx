import Link from 'next/link';
import { Users } from 'lucide-react';
import { formatCohortStartLabel } from '@/lib/training/cohort-display';

export type JoinableGroupTraining = {
  id: string;
  handle: string;
  cohortName: string;
  defaultPlanStartDate: string | null;
  currentWeekNumber: number | null;
  memberCount: number;
  race: {
    name: string;
    distanceLabel: string | null;
  };
  hostFirstName: string | null;
};

type Props = {
  cohort: JoinableGroupTraining;
};

export default function GroupTrainingCard({ cohort }: Props) {
  const startLabel = formatCohortStartLabel(cohort.defaultPlanStartDate);
  const weekNum = cohort.currentWeekNumber ?? 1;
  const joinHref = `/join/training/${encodeURIComponent(cohort.handle)}`;
  const hostLabel = cohort.hostFirstName ?? 'them';

  return (
    <section className="bg-gradient-to-br from-orange-50 to-amber-50/80 border border-orange-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-800 tracking-wider uppercase mb-2">
          <Users className="w-3.5 h-3.5" />
          Group training
        </div>
        <h2 className="text-xl font-bold text-stone-900 leading-snug">
          Train for {cohort.race.name} with {hostLabel}
        </h2>
        {startLabel ? (
          <p className="text-sm text-stone-700 mt-2">
            Group training starts <span className="font-semibold">{startLabel}</span>
            {' — '}
            join week {weekNum}!
          </p>
        ) : (
          <p className="text-sm text-stone-700 mt-2">
            Join {hostLabel}&apos;s training group — your own plan, same structure.
          </p>
        )}
        {cohort.race.distanceLabel ? (
          <p className="text-xs text-stone-500 mt-1">{cohort.race.distanceLabel}</p>
        ) : null}
        <p className="text-xs text-stone-500 mt-2">
          {cohort.memberCount} runner{cohort.memberCount !== 1 ? 's' : ''} already in
        </p>
        <Link
          href={joinHref}
          className="mt-4 block w-full text-center bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-semibold py-2.5 rounded-xl transition-all"
        >
          Join week {weekNum}
        </Link>
      </div>
    </section>
  );
}
