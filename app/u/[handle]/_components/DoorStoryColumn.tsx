import Image from 'next/image';
import { photoFocusStyle } from '@/lib/gofast-with-me/photo-focus';

type GwmFields = {
  welcome?: string | null;
  gofastWithMeBio?: string | null;
  whatYoullSeeHere?: string | null;
  sportFocus?: string | null;
  modelFocus?: string | null;
  myAchievements?: string | null;
  gofastWithMePhotoUrl?: string | null;
  gofastWithMePhotoFocusX?: number | null;
  gofastWithMePhotoFocusY?: number | null;
  gofastWithMePhotoZoom?: number | null;
};

type Props = {
  gofastWithMe: GwmFields | null | undefined;
  profileBio: string | null;
};

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1.5">{label}</p>
      <div className="text-stone-800 text-sm leading-relaxed whitespace-pre-wrap">{children}</div>
    </div>
  );
}

export default function DoorStoryColumn({ gofastWithMe, profileBio }: Props) {
  const photoUrl = gofastWithMe?.gofastWithMePhotoUrl?.trim() || null;
  const photoFocus = photoFocusStyle(
    gofastWithMe?.gofastWithMePhotoFocusX,
    gofastWithMe?.gofastWithMePhotoFocusY,
    gofastWithMe?.gofastWithMePhotoZoom
  );
  const about =
    gofastWithMe?.gofastWithMeBio?.trim() || profileBio?.trim() || null;
  const welcome = gofastWithMe?.welcome?.trim() || null;
  const whatYoullSee = gofastWithMe?.whatYoullSeeHere?.trim() || null;
  const achievements = gofastWithMe?.myAchievements?.trim() || null;
  const focusParts = [gofastWithMe?.sportFocus, gofastWithMe?.modelFocus]
    .map((s) => s?.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {photoUrl ? (
        <div className="w-full max-h-72 aspect-[2/1] rounded-xl overflow-hidden bg-sky-100 border border-stone-200">
          <Image
            src={photoUrl}
            alt=""
            width={1200}
            height={600}
            className="w-full h-full object-cover"
            style={photoFocus}
            unoptimized
            priority
          />
        </div>
      ) : null}

      {welcome ? <Section label="Welcome">{welcome}</Section> : null}

      {focusParts.length > 0 ? (
        <p className="text-xs font-medium text-stone-500">{focusParts.join(' · ')}</p>
      ) : null}

      {about ? <Section label="About you">{about}</Section> : null}

      {whatYoullSee ? <Section label="What you&apos;ll see">{whatYoullSee}</Section> : null}

      {achievements ? <Section label="Achievements">{achievements}</Section> : null}
    </div>
  );
}
