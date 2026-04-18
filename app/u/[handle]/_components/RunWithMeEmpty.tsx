'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, Search } from 'lucide-react';
import { LocalStorageAPI } from '@/lib/localstorage';

type Props = {
  athleteId: string;
  firstName: string | null;
  handle: string | null;
  city: string | null;
};

export default function RunWithMeEmpty({ athleteId, firstName, city }: Props) {
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  useEffect(() => {
    setIsOwner(LocalStorageAPI.getAthleteId() === athleteId);
  }, [athleteId]);

  // Server-render the public viewer copy by default; client swaps to owner copy if applicable.
  if (isOwner) {
    return (
      <div className="bg-orange-50/60 border border-dashed border-orange-300 rounded-2xl p-6 text-center">
        <p className="text-sm font-semibold text-stone-800">
          You haven&apos;t posted any runs yet
        </p>
        <p className="mt-1 text-sm text-stone-600">
          Profile views convert best when there&apos;s something to RSVP to. Post a run anyone can join.
        </p>
        <Link
          href="/build-a-run"
          className="mt-4 inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <CalendarPlus className="w-4 h-4" />
          Post a run
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center">
      <p className="text-sm text-stone-700">
        {firstName ? firstName : 'They'} hasn&apos;t posted public runs yet
      </p>
      <p className="mt-1 text-xs text-stone-500">Check back soon &mdash; or find runs nearby.</p>
      <Link
        href="/find-runners"
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-orange-700 hover:text-orange-800"
      >
        <Search className="w-4 h-4" />
        Find runs{city ? ` in ${city}` : ''}
      </Link>
    </div>
  );
}
