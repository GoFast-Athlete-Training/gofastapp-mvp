import Image from 'next/image';
import { MapPin, User } from 'lucide-react';
import HeroOwnerNudge from './HeroOwnerNudge';
import ShareButton from './ShareButton';

type Props = {
  athleteId: string;
  displayName: string;
  handle: string | null;
  photoURL: string | null;
  myBestRunPhotoURL: string | null;
  city: string | null;
  state: string | null;
  primarySport: string | null;
  fiveKPace: string | null;
  weeklyMileage: number | null;
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

  return (
    <header className="relative w-full">
      <div className="relative w-full aspect-[16/9] sm:aspect-[16/7] overflow-hidden bg-gradient-to-br from-orange-500 via-orange-400 to-rose-400">
        {props.myBestRunPhotoURL ? (
          <Image
            src={props.myBestRunPhotoURL}
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
          <HeroOwnerNudge athleteId={props.athleteId} hasHero={Boolean(props.myBestRunPhotoURL)} />
          <ShareButton handle={props.handle} displayName={props.displayName} />
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
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 leading-tight truncate">
              {props.displayName}
            </h1>
            {props.handle && (
              <p className="text-stone-500 text-sm font-medium">@{props.handle}</p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1 text-sm text-stone-600">
          {location && (
            <p className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 shrink-0 text-stone-400" />
              <span>{location}</span>
            </p>
          )}
          {stats && (
            <p className="text-stone-700 font-medium">{stats}</p>
          )}
        </div>
      </div>
    </header>
  );
}
