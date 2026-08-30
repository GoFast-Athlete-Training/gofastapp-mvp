import type { AthleteTipPayload } from '@/lib/gofast-with-me/athlete-tips';

type Props = {
  tip: AthleteTipPayload;
  compact?: boolean;
  className?: string;
};

export function AthleteTipStructuredCard({ tip, compact = false, className = '' }: Props) {
  const previewLine =
    tip.takeaway?.trim() ||
    tip.body.split('\n').find((line) => line.trim())?.trim() ||
    '';

  if (compact) {
    return (
      <article className={`flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
        <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">Tip</p>
        <h3 className="mt-1 line-clamp-2 text-base font-bold text-gray-900">{tip.title}</h3>
        {previewLine ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600">{previewLine}</p>
        ) : null}
      </article>
    );
  }

  return (
    <article className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`}>
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
            <img src={tip.mediaUrl} alt="" className="aspect-video w-full object-cover" />
          )}
        </div>
      ) : null}
      <div className="p-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">Tip</p>
        <h3 className="mt-1 text-base font-bold text-gray-900">{tip.title}</h3>
        <div className="mt-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">The Big Idea</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{tip.body}</p>
        </div>
        {tip.takeaway ? (
          <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/80 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-800">
              The Takeaway
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-relaxed text-orange-950">
              {tip.takeaway}
            </p>
          </div>
        ) : null}
        {tip.tipSeries && tip.tipSeries.tips.length > 0 ? (
          <div className="mt-4 space-y-2">
            {tip.tipSeries.title ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                {tip.tipSeries.title}
              </p>
            ) : (
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">Tip series</p>
            )}
            <ol className="space-y-2">
              {tip.tipSeries.tips.map((item, index) => (
                <li key={`${item.title}-${index}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  {item.title ? (
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  ) : null}
                  {item.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                      {item.body}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {tip.publishedAt ? (
          <p className="mt-3 text-xs text-gray-400">
            Published {new Date(tip.publishedAt).toLocaleDateString()}
          </p>
        ) : null}
      </div>
    </article>
  );
}
