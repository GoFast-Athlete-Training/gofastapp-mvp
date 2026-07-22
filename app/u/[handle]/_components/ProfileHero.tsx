import Image from 'next/image';
import Link from 'next/link';
import { MapPin, User } from 'lucide-react';
import HeroOwnerNudge from './HeroOwnerNudge';
import ShareButton from './ShareButton';
import type { PublicAction } from '@/lib/gofast-with-me/resolve-public-actions';

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

export default function ProfileHero(props: Props) {
  const location = locationLine(props.city, props.state);
  const stats = statLine({
    primarySport: props.primarySport,
    weeklyMileage: props.weeklyMileage,
    fiveKPace: props.fiveKPace,
  });
  const pagePhoto = props.gofastWithMePhotoUrl?.trim() || null;
  const actions = props.publicActions ?? [];

  return (
    <header className="relative w-full bg-stone-50">
      <div className="bg-gradient-to-r from-sky-400 via-sky-500 to-sky-600">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-4 min-w-0">
              {props.photoURL ? (
                <Image
                  src={props.photoURL}
                  alt=""
                  width={80}
                  height={80}
                  className="rounded-full object-cover w-16 h-16 sm:w-20 sm:h-20 ring-4 ring-white shadow-md shrink-0"
                  unoptimized
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/90 ring-4 ring-white shadow-md flex items-center justify-center shrink-0">
                  <User className="w-8 h-8 text-sky-600" />
                </div>
              )}

              <div className="min-w-0 pt-1">
                <p className="text-sky-100 text-[10px] font-semibold uppercase tracking-[0.15em] mb-1">
                  GoFastWithMe
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight truncate">
                  {props.displayName}
                </h1>
                {props.handle ? (
                  <p className="text-sky-100 text-sm font-medium mt-1">@{props.handle}</p>
                ) : null}
                {location ? (
                  <p className="mt-2 text-sm text-sky-50 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>{location}</span>
                  </p>
                ) : null}
                {stats ? <p className="mt-1 text-sm text-sky-100">{stats}</p> : null}

                {actions.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <Link
                      href={actions[0].href}
                      className="inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                    >
                      {actions[0].label}
                    </Link>
                    {actions.length > 1 ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {actions.slice(1).map((action) => (
                          <Link
                            key={`${action.label}-${action.href}`}
                            href={action.href}
                            className="text-xs font-medium text-sky-100 hover:text-white underline-offset-2 hover:underline"
                          >
                            {action.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link href="/welcome" className="hidden sm:block shrink-0" aria-label="GoFast home">
                <Image
                  src="/logo.png"
                  alt="GoFast"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover border-2 border-white"
                />
              </Link>
              <HeroOwnerNudge athleteId={props.athleteId} hasHero={Boolean(pagePhoto)} />
              <ShareButton handle={props.handle} displayName={props.displayName} />
            </div>
          </div>
        </div>
      </div>

      {pagePhoto ? (
        <div className="max-w-2xl mx-auto px-5 sm:px-6 pt-5">
          <div className="w-full aspect-[16/9] rounded-2xl overflow-hidden shadow-md bg-sky-100">
            <Image
              src={pagePhoto}
              alt=""
              width={1200}
              height={525}
              className="w-full h-full object-cover"
              unoptimized
              priority
            />
          </div>
        </div>
      ) : null}
    </header>
  );
}
