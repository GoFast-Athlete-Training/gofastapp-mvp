import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import type { AthleteAnnouncement } from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  announcements: AthleteAnnouncement[];
  hostFirstName: string;
  isOwner?: boolean;
};

export default function AthleteCommunityUpdatesSection({
  announcements,
  hostFirstName,
  isOwner = false,
}: Props) {
  const latest = announcements[0] ?? null;
  const earlier = announcements.slice(1);

  return (
    <section id="updates" className="space-y-3">
      <div className="px-1">
        <h2 className="text-lg font-bold text-gray-900">Weekly message</h2>
        <p className="text-sm text-gray-500 mt-1">
          From {hostFirstName} — race prep, milestones, what&apos;s next this week.
        </p>
      </div>

      {latest ? (
        <article className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-orange-100 p-2 text-orange-700 shrink-0">
              <Megaphone className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-orange-800">
                This week from {hostFirstName}
              </p>
              {latest.title ? (
                <h3 className="mt-1 text-base font-semibold text-gray-900">{latest.title}</h3>
              ) : null}
              <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{latest.body}</p>
              <p className="mt-2 text-xs text-gray-500">
                {new Date(latest.publishedAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </article>
      ) : (
        <p className="text-sm text-gray-500 rounded-xl border border-dashed border-gray-200 bg-white p-5 text-center">
          No weekly message yet.
        </p>
      )}

      {earlier.length > 0 ? (
        <ul className="space-y-2">
          {earlier.map((a) => (
            <li key={a.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm text-sm">
              {a.title ? <p className="font-semibold text-gray-900 mb-1">{a.title}</p> : null}
              <p className="text-gray-800 whitespace-pre-wrap">{a.body}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(a.publishedAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {isOwner ? (
        <Link
          href="/gofast-with-others"
          className="inline-flex text-xs font-semibold text-orange-600 hover:underline"
        >
          Post weekly message from studio →
        </Link>
      ) : null}
    </section>
  );
}
