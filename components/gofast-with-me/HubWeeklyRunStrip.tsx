'use client';

import Link from 'next/link';

type RunItem = {
  id: string;
  title: string;
  date: string;
  citySlug: string;
  meetUpPoint: string;
  gorunPath: string;
};

type Props = {
  runs: RunItem[];
};

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function HubWeeklyRunStrip({ runs }: Props) {
  const now = new Date();
  const weekStart = startOfWeekMonday(now);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const runsByDay = new Map<string, RunItem[]>();
  for (const run of runs) {
    const key = run.date.slice(0, 10);
    const list = runsByDay.get(key) ?? [];
    list.push(run);
    runsByDay.set(key, list);
  }

  const weekRuns = runs.filter((r) => {
    const d = new Date(r.date);
    return d >= weekStart && d < new Date(weekStart.getTime() + 7 * 86400000);
  });

  if (weekRuns.length === 0 && runs.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          This week&apos;s runs
        </h2>
        <p className="text-sm text-gray-600 mt-2">No upcoming runs scheduled yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          This week&apos;s runs
        </h2>
        <p className="text-xs text-gray-500 mt-1">Hosted runs on the calendar this week.</p>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d, i) => {
          const key = ymd(d);
          const dayRuns = runsByDay.get(key) ?? [];
          const isToday = ymd(now) === key;
          return (
            <div
              key={key}
              className={`rounded-lg border p-2 min-h-[4.5rem] ${
                isToday ? 'border-orange-300 bg-orange-50/50' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <p className="text-[10px] font-semibold text-gray-500 uppercase">{DAY_LABELS[i]}</p>
              <p className="text-xs font-medium text-gray-800">{d.getDate()}</p>
              {dayRuns.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {dayRuns.map((run) => (
                    <li key={run.id}>
                      <Link
                        href={run.gorunPath.startsWith('/') ? run.gorunPath : `/${run.gorunPath}`}
                        className="block text-[10px] font-semibold text-orange-700 line-clamp-2 hover:underline"
                      >
                        {run.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10px] text-gray-400 mt-1">—</p>
              )}
            </div>
          );
        })}
      </div>

      {runs.length > weekRuns.length ? (
        <ul className="space-y-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase">Later</p>
          {runs
            .filter((r) => !weekRuns.some((w) => w.id === r.id))
            .slice(0, 5)
            .map((r) => (
              <li key={r.id}>
                <Link
                  href={r.gorunPath.startsWith('/') ? r.gorunPath : `/${r.gorunPath}`}
                  className="block rounded-lg border border-gray-100 bg-gray-50 p-2 text-sm hover:border-orange-200"
                >
                  <span className="font-medium text-gray-900">{r.title}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {new Date(r.date).toLocaleString()} · {r.citySlug}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  );
}
