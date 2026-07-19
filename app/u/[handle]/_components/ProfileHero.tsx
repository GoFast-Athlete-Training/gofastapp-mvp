import Image from 'next/image';
import Link from 'next/link';
import { MapPin, User } from 'lucide-react';
import HeroOwnerNudge from './HeroOwnerNudge';
import ShareButton from './ShareButton';
import type { PublicAction } from '@/lib/gofast-with-me/resolve-public-actions';
import { goFastWithPersonHeadline } from '@/lib/gofast-with-me/resolve-public-actions';

type Props = {
  athleteId: string;
  firstName: string | null;
  displayName: string;
  handle: string | null;
  photoURL: string | null;
  gofastWithMePhotoUrl: string | null;
  city: string | null;
  state: string | null;
  primarySport: string | null;
  fiveKPace: string | null;
  weeklyMileage: number | null;
  publicActions?: PublicAction[];
};

function locationLine(city: string | null, state: string | null): string | null {
  if (city && state) return `${city}, ${state}`;
  return city || state || null;
}

function statLine(args: {
  primarySport: string | null;
  weeklyMileage: number | null;
  fiveKPace: string | null;
}): string | null {
  const parts: string[] = [];
  if (args.primarySport) parts.push(args.primarySport);
  if (args.weeklyMileage && args.weeklyMileage > 0) parts.push(`${args.weeklyMileage} mpw`);
  if (args.fiveKPace) parts.push(`${args.fiveKPace} 5K`);
  return parts.length ? parts.join(' \u00b7 ') : null;
}

function initialFor(name: string, handle: string | null): string {
  const c = (name || handle || '?').trim().charAt(0);
  return (c || '?').toUpperCase();
}

export default function ProfileHero(props: Props) {
  const location = locationLine(props.city, props.state);
  const stats = statLine({
    primarySport: props.primarySport,
    weeklyMileage: props.weeklyMileage,
    fiveKPace: props.fiveKPace,
  });
  const initial = initialFor(props.displayName, props.handle);
  const headline = goFastWithPersonHeadline(props.firstName, props.displayName);
  const heroPhoto = props.gofastWithMePhotoUrl?.trim() || null;
  const actions = props.publicActions ?? [];

  return (
    <header className="relative w-full">
      <div className="relative w-full aspect-[16/9] sm:aspect-[16/7] overflow-hidden bg-gradient-to-br from-orange-500 via-orange-400 to-rose-400">
        {heroPhoto ? (
          <Image
            src={heroPhoto}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 720px"
            className="object-cover"
            unoptimized
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none select-none">
            <span className="font-black text-white/15 text-[18rem] leading-none -mr-6">
              {initial}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/55" />

        <div className="absolute top-4 right-4 flex items-center gap-2">
          <HeroOwnerNudge athleteId={props.athleteId} hasHero={Boolean(heroPhoto)} />
          <ShareButton handle={props.handle} displayName={props.displayName} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-5 sm:px-6 pb-8 pt-16 bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-200 mb-2">
            {headline}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
            {props.displayName}
          </h1>
          {props.handle ? (
            <p className="text-orange-100 text-sm font-medium mt-1">@{props.handle}</p>
          ) : null}
          {location ? (
            <p className="mt-2 text-sm text-white/90 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 shrink-0" />
              <span>{location}</span>
            </p>
          ) : null}
          {actions.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {actions.map((action) => (
                <Link
                  key={`${action.label}-${action.href}`}
                  href={action.href}
                  className="inline-flex items-center rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 sm:px-6">
        <div className="flex items-end gap-4 -mt-10 sm:-mt-12">
          <div className="shrink-0">
            {props.photoURL ? (
              <Image
                src={props.photoURL}
                alt=""
                width={96}
                height={96}
                className="rounded-full object-cover w-20 h-20 sm:w-24 sm:h-24 ring-4 ring-white shadow-md bg-white"
                unoptimized
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-stone-200 ring-4 ring-white shadow-md flex items-center justify-center">
                <User className="w-9 h-9 text-stone-400" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 pb-1">
            {stats ? <p className="text-stone-700 font-medium text-sm">{stats}</p> : null}
          </div>
        </div>
      </div>
    </header>
  );
}
