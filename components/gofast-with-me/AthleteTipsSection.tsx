import type { AthleteTipPayload } from '@/lib/gofast-with-me/athlete-tips';

type Props = {
  tips: AthleteTipPayload[];
  hostFirstName: string | null;
  isOwner?: boolean;
};

export default function AthleteTipsSection({ tips, hostFirstName, isOwner = false }: Props) {
  const name = hostFirstName?.trim() || 'this athlete';

  return (
    <section id="tips" className="space-y-3">
      <div className="px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
          Tips &amp; Thinking
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Evergreen notes from {name} — training, nutrition, routes, and what they are learning.
        </p>
      </div>

      {tips.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {tips.map((tip) => (
            <article key={tip.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">
                Tip
              </p>
              <h3 className="mt-1 text-base font-bold text-gray-900">{tip.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                {tip.body}
              </p>
              {tip.publishedAt ? (
                <p className="mt-3 text-xs text-gray-400">
                  Published {new Date(tip.publishedAt).toLocaleDateString()}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          {isOwner
            ? 'No published tips yet. Add durable tips in your studio.'
            : `${name} has not published tips yet.`}
        </p>
      )}
    </section>
  );
}
