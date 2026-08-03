import type { AthleteTipPayload } from '@/lib/gofast-with-me/athlete-tips';
import { AthleteInstagramHandleLink } from '@/components/gofast-with-me/TipMediaPicker';

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
            <article key={tip.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {tip.mediaUrl ? (
                <div className="border-b border-gray-100 bg-gray-50">
                  {tip.mediaType === 'video' ? (
                    <video
                      src={tip.mediaUrl}
                      controls
                      playsInline
                      className="aspect-video w-full bg-black object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tip.mediaUrl}
                      alt=""
                      className="aspect-video w-full object-cover"
                    />
                  )}
                </div>
              ) : null}
              <div className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">Tip</p>
                <h3 className="mt-1 text-base font-bold text-gray-900">{tip.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {tip.body}
                </p>
                {tip.publishedAt ? (
                  <p className="mt-3 text-xs text-gray-400">
                    Published {new Date(tip.publishedAt).toLocaleDateString()}
                  </p>
                ) : null}
              </div>
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

      <AthleteInstagramHandleLink username={instagramUsername} className="px-1" />
    </section>
  );
}
