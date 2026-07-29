import Image from 'next/image';
import Link from 'next/link';
import { MapPin, User } from 'lucide-react';
import HeroOwnerNudge from './HeroOwnerNudge';
import ShareButton from './ShareButton';
import type { PublicAction } from '@/lib/gofast-with-me/resolve-public-actions';

type Props = {
  athleteId: string;
  displayName: string;
  handle: string | null;
  photoURL: string | null;
  hasRunPhoto: boolean;
  city: string | null;
  state: string | null;
  primarySport: string | null;
  publicActions?: PublicAction[];
};

function locationLine(city: string | null, state: string | null): string | null {
  if (city && state) return `${city}, ${state}`;
  return city || state || null;
}

export default function ProfileHero(props: Props) {
  const location = locationLine(props.city, props.state);
  const actions = props.publicActions ?? [];
  const meta = [location, props.primarySport].filter(Boolean).join(' · ');

  return (
    <header className="relative w-full bg-gradient-to-r from-sky-400 via-sky-500 to-sky-600">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {props.photoURL ? (
              <Image
                src={props.photoURL}
                alt=""
                width={64}
                height={64}
                className="rounded-full object-cover w-14 h-14 sm:w-16 sm:h-16 ring-2 ring-white/80 shadow-md shrink-0"
                unoptimized
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/90 ring-2 ring-white/80 shadow-md flex items-center justify-center shrink-0">
                <User className="w-7 h-7 text-sky-600" />
              </div>
            )}

            <div className="min-w-0">
              <p className="text-sky-100 text-[10px] font-semibold uppercase tracking-[0.15em]">
                GoFast With Me
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight truncate">
                {props.displayName}
              </h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-sky-50">
                {props.handle ? <span className="font-medium">@{props.handle}</span> : null}
                {meta ? (
                  <span className="inline-flex items-center gap-1 text-sky-100/90">
                    {location ? <MapPin className="w-3.5 h-3.5 shrink-0" /> : null}
                    <span>{meta}</span>
                  </span>
                ) : null}
              </div>
              {actions.length > 0 ? (
                <Link
                  href={actions[0].href}
                  className="mt-3 inline-flex items-center rounded-lg bg-white px-3.5 py-1.5 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                >
                  {actions[0].label}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/welcome" className="hidden sm:block shrink-0" aria-label="GoFast home">
              <Image
                src="/logo.png"
                alt="GoFast"
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover border-2 border-white"
              />
            </Link>
            <HeroOwnerNudge athleteId={props.athleteId} hasHero={props.hasRunPhoto} />
            <ShareButton handle={props.handle} displayName={props.displayName} />
          </div>
        </div>
      </div>
    </header>
  );
}
