type GoFastWithMeFields = {
  welcome?: string | null;
  gofastWithMeBio?: string | null;
  whatYoullSeeHere?: string | null;
  sportFocus?: string | null;
  modelFocus?: string | null;
  myAchievements?: string | null;
  creatorType?: string | null;
  coachSpecialty?: string | null;
};

type Props = {
  gofastWithMe: GoFastWithMeFields | null | undefined;
  hostFirstName: string | null;
};

function hasContent(fields: GoFastWithMeFields | null | undefined): boolean {
  if (!fields) return false;
  return Boolean(
    fields.welcome?.trim() ||
      fields.gofastWithMeBio?.trim() ||
      fields.whatYoullSeeHere?.trim() ||
      fields.sportFocus?.trim() ||
      fields.modelFocus?.trim() ||
      fields.myAchievements?.trim() ||
      fields.coachSpecialty?.trim()
  );
}

export default function GoFastWithMeIntro({
  gofastWithMe,
  hostFirstName,
}: Props) {
  if (!hasContent(gofastWithMe)) return null;

  const name = hostFirstName?.trim() || 'this runner';
  const focusParts = [gofastWithMe?.sportFocus, gofastWithMe?.modelFocus]
    .map((s) => s?.trim())
    .filter(Boolean);

  return (
    <section className="rounded-2xl border border-stone-200 bg-white px-5 py-5 shadow-sm space-y-4">
      {gofastWithMe?.creatorType === 'coach' && gofastWithMe?.coachSpecialty?.trim() ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
          Coaching · {gofastWithMe.coachSpecialty.trim()}
        </p>
      ) : null}

      {gofastWithMe?.welcome?.trim() ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-2">
            Welcome
          </p>
          <p className="text-stone-800 text-sm leading-relaxed whitespace-pre-wrap">
            {gofastWithMe.welcome.trim()}
          </p>
        </div>
      ) : null}

      {focusParts.length > 0 ? (
        <p className="text-xs font-medium text-stone-500">{focusParts.join(' · ')}</p>
      ) : null}

      {gofastWithMe?.gofastWithMeBio?.trim() ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
            About me on GoFast
          </p>
          <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap">
            {gofastWithMe.gofastWithMeBio.trim()}
          </p>
        </div>
      ) : null}

      {gofastWithMe?.whatYoullSeeHere?.trim() ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
            What you&apos;ll see here
          </p>
          <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap">
            {gofastWithMe.whatYoullSeeHere.trim()}
          </p>
        </div>
      ) : null}

      {gofastWithMe?.myAchievements?.trim() ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
            My achievements
          </p>
          <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap">
            {gofastWithMe.myAchievements.trim()}
          </p>
        </div>
      ) : null}

      <p className="text-xs text-stone-400">— GoFast With {name}</p>
    </section>
  );
}
