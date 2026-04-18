'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ImagePlus } from 'lucide-react';
import { LocalStorageAPI } from '@/lib/localstorage';

type Props = {
  athleteId: string;
  hasHero: boolean;
};

/**
 * Tasteful "Add a hero photo" CTA shown only when the viewer is the athlete and they
 * have not yet uploaded a myBestRunPhotoURL. Renders nothing for everyone else, so
 * public viewers never see what's missing.
 */
export default function HeroOwnerNudge({ athleteId, hasHero }: Props) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    setIsOwner(LocalStorageAPI.getAthleteId() === athleteId);
  }, [athleteId]);

  if (!isOwner || hasHero) return null;

  return (
    <Link
      href="/athlete-edit-profile"
      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/95 text-stone-800 hover:bg-white px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm transition-colors"
    >
      <ImagePlus className="w-3.5 h-3.5" />
      Add a hero photo
    </Link>
  );
}
