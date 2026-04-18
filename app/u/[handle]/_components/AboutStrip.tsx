import Image from 'next/image';
import Link from 'next/link';
import { Flag, Users } from 'lucide-react';

type SignedUpRace = {
  id: string;
  name: string;
  slug: string | null;
  raceDate: string;
  city: string | null;
  state: string | null;
  distanceLabel: string | null;
};

type ContainerMember = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  photoURL: string | null;
  gofastHandle: string | null;
};

type Props = {
  bio: string | null;
  signedUpRaces: SignedUpRace[];
  isGoFastContainer: boolean;
  containerMemberCount: number;
  containerRecentMembers: ContainerMember[];
  hostHandle: string | null;
};

function formatRaceShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function initialFor(firstName: string | null, handle: string | null): string {
  return ((firstName || handle || '?').trim().charAt(0) || '?').toUpperCase();
}

export default function AboutStrip(props: Props) {
  const hasBio = Boolean(props.bio?.trim());
  const futureRaces = props.signedUpRaces.filter((r) => new Date(r.raceDate) >= new Date()).slice(0, 8);
  const hasRaces = futureRaces.length > 0;
  const hasContainer = props.isGoFastContainer && props.containerMemberCount > 0;

  if (!hasBio && !hasRaces && !hasContainer) return null;

  return (
    <section className="bg-white border border-stone-200 rounded-2xl shadow-sm divide-y divide-stone-100">
      {hasBio && (
        <div className="p-6">
          <p className="text-xs font-semibold text-stone-500 tracking-wider uppercase mb-2">
            About
          </p>
          <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap">
            {props.bio}
          </p>
        </div>
      )}

      {hasRaces && (
        <div className="p-6">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 tracking-wider uppercase mb-3">
            <Flag className="w-3.5 h-3.5" />
            On the calendar
          </div>
          <div className="flex flex-wrap gap-2">
            {futureRaces.map((race) => {
              const meta = [formatRaceShort(race.raceDate), race.distanceLabel]
                .filter(Boolean)
                .join(' \u00b7 ');
              const inner = (
                <div className="flex flex-col">
                  <span className="font-semibold text-stone-800 text-sm">{race.name}</span>
                  {meta && <span className="text-[11px] text-stone-500">{meta}</span>}
                </div>
              );
              return race.slug ? (
                <Link
                  key={race.id}
                  href={`/join/race/${race.slug}`}
                  className="inline-flex items-center px-3 py-2 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 transition-colors"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={race.id}
                  className="inline-flex items-center px-3 py-2 rounded-xl bg-stone-50 border border-stone-200"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasContainer && (
        <div className="p-6">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 tracking-wider uppercase mb-3">
            <Users className="w-3.5 h-3.5" />
            Community
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex -space-x-2">
              {props.containerRecentMembers.slice(0, 5).map((m) =>
                m.photoURL ? (
                  <Image
                    key={m.id}
                    src={m.photoURL}
                    alt=""
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full ring-2 ring-white object-cover bg-stone-200"
                    unoptimized
                  />
                ) : (
                  <div
                    key={m.id}
                    className="w-8 h-8 rounded-full ring-2 ring-white bg-stone-300 flex items-center justify-center text-xs font-semibold text-white"
                  >
                    {initialFor(m.firstName, m.gofastHandle)}
                  </div>
                ),
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-sm text-stone-700">
                <span className="font-semibold text-stone-900">{props.containerMemberCount}</span>{' '}
                {props.containerMemberCount === 1 ? 'member' : 'members'}
              </p>
              {props.hostHandle && (
                <Link
                  href={`/container/${props.hostHandle}`}
                  className="text-xs font-semibold text-orange-700 hover:text-orange-800"
                >
                  Open community &rarr;
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
