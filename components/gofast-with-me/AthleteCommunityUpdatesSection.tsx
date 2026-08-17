import Link from 'next/link';
import type { ContainerHubMessage } from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  messages: ContainerHubMessage[];
  hostFirstName: string;
  isOwner?: boolean;
};

export default function AthleteCommunityUpdatesSection({
  messages,
  hostFirstName,
  isOwner = false,
}: Props) {
  return (
    <section id="updates" className="space-y-3">
      <div className="px-1">
        <h2 className="text-lg font-bold text-gray-900">Daily log</h2>
        <p className="text-sm text-gray-500 mt-1">
          From {hostFirstName} — how they&apos;re feeling today.
        </p>
      </div>
      {messages.length > 0 ? (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li key={m.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm text-sm">
              <p className="text-gray-800 whitespace-pre-wrap">{m.body}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(m.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 rounded-xl border border-dashed border-gray-200 bg-white p-5 text-center">
          No daily logs yet.
        </p>
      )}
      {isOwner ? (
        <Link
          href="/gofast-with-others"
          className="inline-flex text-xs font-semibold text-orange-600 hover:underline"
        >
          Post daily logs from Daily log in studio →
        </Link>
      ) : null}
    </section>
  );
}
