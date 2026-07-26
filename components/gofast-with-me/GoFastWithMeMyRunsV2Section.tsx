'use client';

import Link from 'next/link';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  runs: ContainerHubPayload['upcomingRuns'];
  isHost: boolean;
};

export default function GoFastWithMeMyRunsV2Section({ runs, isHost }: Props) {
  return (
    <details className="rounded-2xl border border-gray-100 bg-white group">
      <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Coming later</p>
          <h2 className="text-sm font-semibold text-gray-700 mt-0.5">My Runs</h2>
        </div>
        <span className="text-xs text-gray-400 group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="px-5 pb-5 pt-0 space-y-2 border-t border-gray-100">
        <p className="text-sm text-gray-600 pt-3">
          Manual hosted runs are v2. The primary loop is goal + plan — surface what you&apos;re
          training for and share your plan strip. Most athletes won&apos;t hand-enter every run.
        </p>
        {runs.length > 0 ? (
          <ul className="space-y-2">
            {runs.slice(0, 3).map((r) => (
              <li key={r.id}>
                <Link
                  href={r.gorunPath.startsWith('/') ? r.gorunPath : `/${r.gorunPath}`}
                  className="block text-sm text-orange-700 hover:underline"
                >
                  {r.title} — {new Date(r.date).toLocaleDateString()}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {isHost ? (
          <Link
            href="/gofast-with-others"
            className="inline-flex text-xs font-semibold text-orange-600 hover:underline"
          >
            Open GoFast With Me studio
          </Link>
        ) : null}
      </div>
    </details>
  );
}
