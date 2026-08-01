import { ExternalLink, Instagram } from 'lucide-react';
import type { AthleteInstagramMediaPayload } from '@/lib/gofast-with-me/instagram-hydration';

type Props = {
  media: AthleteInstagramMediaPayload[];
  username?: string | null;
};

export default function AthleteInstagramSection({ media, username }: Props) {
  if (media.length === 0 && !username?.trim()) return null;

  const profileHref = username?.trim()
    ? `https://www.instagram.com/${username.replace(/^@/, '').trim()}`
    : null;

  return (
    <section id="instagram" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-gray-900">
            <Instagram className="h-4 w-4 text-pink-600" />
            Instagram
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Recent public posts can hydrate here after Instagram is connected.
          </p>
        </div>
        {profileHref ? (
          <a
            href={profileHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-pink-700 hover:underline"
          >
            @{username?.replace(/^@/, '').trim()}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>

      {media.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {media.map((item) => {
            const image = item.thumbnailUrl || item.mediaUrl;
            const Card = (
              <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-gray-100 text-xs font-semibold text-gray-400">
                    {item.mediaType}
                  </div>
                )}
                {item.caption ? (
                  <p className="line-clamp-3 p-3 text-xs leading-relaxed text-gray-600">
                    {item.caption}
                  </p>
                ) : null}
              </article>
            );

            return item.permalink ? (
              <a key={item.id} href={item.permalink} target="_blank" rel="noopener noreferrer">
                {Card}
              </a>
            ) : (
              <div key={item.id}>{Card}</div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-pink-200 bg-pink-50/50 p-4 text-sm text-pink-900">
          Instagram handle is saved. Connect/sync can populate the latest posts here.
        </p>
      )}
    </section>
  );
}
