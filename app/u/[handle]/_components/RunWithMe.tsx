import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Users } from 'lucide-react';
import RunWithMeEmpty from './RunWithMeEmpty';

type GoingAvatar = {
  id: string;
  firstName: string | null;
  gofastHandle: string | null;
  photoURL: string | null;
};

type UpcomingRun = {
  id: string;
  title: string;
  date: string;
  gofastCity: string;
  meetUpPoint: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  gorunPath: string;
  goingCount: number;
  goingAvatars: GoingAvatar[];
};

type Props = {
  athleteId: string;
  firstName: string | null;
  handle: string | null;
  city: string | null;
  upcomingRuns: UpcomingRun[];
};

const DAY_LABEL = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function calendarChip(iso: string): { day: string; date: number; month: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '\u2014', date: 0, month: '' };
  return {
    day: DAY_LABEL[d.getDay()],
    date: d.getDate(),
    month: MONTH_LABEL[d.getMonth()],
  };
}

function formatStartTime(
  iso: string,
  hour: number | null,
  minute: number | null,
  period: string | null,
): string {
  if (hour != null && minute != null) {
    const m = minute.toString().padStart(2, '0');
    if (period) return `${hour}:${m} ${period.toUpperCase()}`;
    return `${hour}:${m}`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function initialFor(name: string | null, handle: string | null): string {
  return ((name || handle || '?').trim().charAt(0) || '?').toUpperCase();
}

function GoingStack({ avatars, count }: { avatars: GoingAvatar[]; count: number }) {
  if (count === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-stone-500">
        <Users className="w-3.5 h-3.5" />
        Be the first
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {avatars.slice(0, 3).map((a) =>
          a.photoURL ? (
            <Image
              key={a.id}
              src={a.photoURL}
              alt=""
              width={24}
              height={24}
              className="rounded-full ring-2 ring-white object-cover w-6 h-6 bg-stone-200"
              unoptimized
            />
          ) : (
            <div
              key={a.id}
              className="w-6 h-6 rounded-full ring-2 ring-white bg-stone-300 flex items-center justify-center text-[10px] font-semibold text-white"
            >
              {initialFor(a.firstName, a.gofastHandle)}
            </div>
          ),
        )}
      </div>
      <span className="text-xs text-stone-600 font-medium">
        {count} going
      </span>
    </div>
  );
}

export default function RunWithMe({ athleteId, firstName, handle, city, upcomingRuns }: Props) {
  const heading = `Run with ${firstName ?? (handle ? `@${handle}` : 'them')}`;

  return (
    <section>
      <div className="px-1 mb-3">
        <h2 className="text-xl font-bold text-stone-900">{heading}</h2>
        <p className="text-xs text-stone-500 mt-0.5">Open to anyone &middot; RSVP to join</p>
      </div>

      {upcomingRuns.length === 0 ? (
        <RunWithMeEmpty
          athleteId={athleteId}
          firstName={firstName}
          handle={handle}
          city={city}
        />
      ) : (
        <ul className="space-y-3">
          {upcomingRuns.map((run, idx) => {
            const cal = calendarChip(run.date);
            const time = formatStartTime(
              run.date,
              run.startTimeHour,
              run.startTimeMinute,
              run.startTimePeriod,
            );
            const isNext = idx === 0;
            return (
              <li
                key={run.id}
                className={`bg-white rounded-2xl shadow-sm overflow-hidden border ${
                  isNext ? 'border-orange-300 ring-1 ring-orange-200' : 'border-stone-200'
                }`}
              >
                {isNext && (
                  <div className="px-5 pt-3">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                      Next up
                    </span>
                  </div>
                )}
                <div className="flex items-stretch gap-4 p-5">
                  <div className="shrink-0 w-16 sm:w-20 flex flex-col items-center justify-center bg-stone-50 border border-stone-200 rounded-xl py-2.5">
                    <span className="text-[11px] font-bold tracking-wider text-orange-600">
                      {cal.day}
                    </span>
                    <span className="text-3xl font-extrabold text-stone-900 leading-none mt-0.5 tabular-nums">
                      {cal.date}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-stone-500 mt-1">
                      {cal.month}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                    <h3 className="font-semibold text-stone-900 leading-tight line-clamp-2">
                      {run.title}
                    </h3>
                    <p className="text-sm text-stone-600 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-stone-400" />
                      <span className="truncate">
                        {run.meetUpPoint}
                        {run.gofastCity ? ` \u00b7 ${run.gofastCity}` : ''}
                      </span>
                    </p>
                    {time && (
                      <p className="text-sm text-stone-700 font-medium tabular-nums">{time}</p>
                    )}
                    <div className="mt-1">
                      <GoingStack avatars={run.goingAvatars} count={run.goingCount} />
                    </div>
                  </div>
                </div>
                <div className="px-5 pb-5">
                  <Link
                    href={run.gorunPath}
                    className="block w-full text-center bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-semibold py-2.5 rounded-xl transition-all"
                  >
                    RSVP to join {firstName ? firstName : 'this run'}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
