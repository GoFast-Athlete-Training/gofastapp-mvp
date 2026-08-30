import type { AthleteTipPayload } from '@/lib/gofast-with-me/athlete-tips';
import { AthleteInstagramHandleLink } from '@/components/gofast-with-me/TipMediaPicker';
import { AthleteTipStructuredCard } from '@/components/gofast-with-me/AthleteTipStructuredCard';

type Props = {
  tips: AthleteTipPayload[];
  hostFirstName: string | null;
  isOwner?: boolean;
  instagramUsername?: string | null;
};

export default function AthleteTipsSection({
  tips,
  hostFirstName,
  isOwner = false,
  instagramUsername,
}: Props) {
  const name = hostFirstName?.trim() || 'this athlete';

  return (
    <section id="tips" className="space-y-3">
      <div className="px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
          Tips &amp; Thinking
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Evergreen notes from {name} — training, nutrition, routes, and what they talk about.
        </p>
      </div>

      {tips.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {tips.map((tip) => (
            <AthleteTipStructuredCard key={tip.id} tip={tip} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          {isOwner
            ? 'No published tips yet. Add durable tips in your studio.'
            : `${name} has not published tips yet.`}
        </p>
      )}

      <AthleteInstagramHandleLink username={instagramUsername} className="px-1" />
    </section>
  );
}
