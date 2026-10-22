'use client';

import {
  resolveRunCircleMark,
  resolveRunHeroImage,
  type RunProfileVisualInput,
} from '@/lib/city-run/run-profile-visual';

type Props = RunProfileVisualInput & {
  title: string;
  metroBadge?: string | null;
  compact?: boolean;
  centered?: boolean;
};

export default function CityRunLinksHeader({
  title,
  metroBadge,
  compact = false,
  centered = true,
  ...visual
}: Props) {
  const circle = resolveRunCircleMark(visual);
  const hero = resolveRunHeroImage(visual);
  const align = centered ? 'text-center' : 'text-left';

  return (
    <div className={align}>
      {circle ? (
        <div
          className={`mx-auto mb-3 inline-flex rounded-full bg-white p-1 shadow-md ring-1 ring-sky-100 ${
            centered ? '' : 'mx-0'
          }`}
        >
          {circle.kind === 'emoji' ? (
            <span
              className={`flex items-center justify-center rounded-full bg-gradient-to-b from-sky-50 to-white ${
                compact ? 'h-16 w-16 text-3xl' : 'h-20 w-20 text-4xl sm:h-24 sm:w-24 sm:text-5xl'
              }`}
              aria-hidden
            >
              {circle.value}
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={circle.value}
              alt={circle.alt}
              className={`rounded-full object-cover ${
                compact ? 'h-16 w-16' : 'h-20 w-20 sm:h-24 sm:w-24'
              }`}
            />
          )}
        </div>
      ) : null}

      <div
        className={`flex items-start gap-3 ${centered ? 'justify-center' : 'justify-between'}`}
      >
        <h1
          className={`font-bold text-gray-900 min-w-0 ${
            compact ? 'text-xl' : 'text-2xl sm:text-3xl'
          } ${centered ? 'text-center' : ''}`}
        >
          {title}
        </h1>
        {metroBadge ? (
          <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sky-900 ring-1 ring-sky-200/80">
            {metroBadge}
          </span>
        ) : null}
      </div>

      {hero ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero.url}
            alt={hero.source === 'cover' ? 'Run cover' : 'Route map'}
            className="w-full max-h-72 object-cover"
          />
        </div>
      ) : null}
    </div>
  );
}
