'use client';

import Link from 'next/link';
import HubWeeklyRunStrip from '@/components/gofast-with-me/HubWeeklyRunStrip';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  runs: ContainerHubPayload['upcomingRuns'];
  hostFirstName: string;
  isHost: boolean;
};

export default function ContainerHubRunsSection({ runs, hostFirstName, isHost }: Props) {
  return (
    <section id="goruns" className="space-y-4">
      <div className="px-1">
        <h2 className="text-lg font-bold text-gray-900">Runs</h2>
        <p className="text-sm text-gray-500 mt-1">
          {isHost
            ? 'Runs you are hosting for your audience — followers RSVP through GoRun.'
            : `Join ${hostFirstName} in real life — RSVP to upcoming hosted runs.`}
        </p>
      </div>

      <HubWeeklyRunStrip runs={runs} />

      {runs.length > 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            All upcoming runs
          </h3>
          <ul className="space-y-2">
            {runs.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.gorunPath.startsWith('/') ? r.gorunPath : `/${r.gorunPath}`}
                  className="block rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm hover:border-orange-300 hover:bg-orange-50/40 transition"
                >
                  <span className="font-medium text-gray-900">{r.title}</span>
                  <span className="block text-gray-500 mt-1">
                    {new Date(r.date).toLocaleString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {r.meetUpPoint ? ` · ${r.meetUpPoint}` : ''}
                    {r.citySlug ? ` · ${r.citySlug}` : ''}
                  </span>
                  <span className="mt-2 inline-block text-xs font-semibold text-orange-700">
                    RSVP on GoRun →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5">
          <p className="text-sm text-gray-600">
            {isHost
              ? 'No upcoming hosted runs yet. Create one from Runs in your studio to invite followers.'
              : `${hostFirstName} has not scheduled a joinable run yet.`}
          </p>
          {isHost ? (
            <Link
              href="/gofast-with-others"
              className="mt-3 inline-flex rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Open studio — Runs
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
