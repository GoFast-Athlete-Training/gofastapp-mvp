import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadPublicAthletePage } from '@/lib/server/load-public-athlete-page';
import ProfileHero from './_components/ProfileHero';
import DoorStoryColumn from './_components/DoorStoryColumn';
import DoorSidebar from './_components/DoorSidebar';
import RunWithMe from './_components/RunWithMe';
import GroupTrainingCard from './_components/GroupTrainingCard';
import { ProfileContainerSponsorshipSlot } from './_components/ProfileContainerSponsorshipSlot';
import AthleteTipsSection from '@/components/gofast-with-me/AthleteTipsSection';
import AthleteInstagramSection from '@/components/gofast-with-me/AthleteInstagramSection';

export const dynamic = 'force-dynamic';

type RouteParams = { handle: string };

function displayNameFor(
  firstName: string | null,
  lastName: string | null,
  handle: string | null,
): string {
  const composed = [firstName, lastName].filter(Boolean).join(' ');
  if (composed) return composed;
  return handle ? `@${handle}` : 'Runner';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { handle } = await params;
  const data = await loadPublicAthletePage(handle);
  if (!data) {
    return { title: 'Profile not found \u00b7 GoFast' };
  }

  const name = displayNameFor(
    data.athlete.firstName,
    data.athlete.lastName,
    data.athlete.gofastHandle,
  );
  const chasing =
    data.trainingSummary?.raceName ??
    data.primaryChasingGoal?.raceName ??
    data.primaryChasingGoal?.name ??
    null;
  const handleStr = data.athlete.gofastHandle ? ` (@${data.athlete.gofastHandle})` : '';
  const title = chasing
    ? `${name}${handleStr} \u00b7 Chasing ${chasing} on GoFast`
    : `${name}${handleStr} on GoFast`;

  const about =
    data.gofastWithMe?.gofastWithMeBio?.trim() ||
    data.gofastWithMe?.welcome?.trim() ||
    data.athlete.bio?.trim() ||
    null;
  const descParts: string[] = [];
  if (about) descParts.push(about.slice(0, 140));
  else if (chasing) descParts.push(`Chasing ${chasing}.`);
  if (data.upcomingRuns.length > 0) {
    descParts.push(
      data.upcomingRuns.length === 1
        ? '1 upcoming run open to anyone.'
        : `${data.upcomingRuns.length} upcoming runs open to anyone.`,
    );
  }

  return {
    title,
    description: descParts.join(' ') || 'Run with them on GoFast.',
    openGraph: {
      title,
      description: descParts.join(' ') || 'Run with them on GoFast.',
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: descParts.join(' ') || 'Run with them on GoFast.',
    },
  };
}

export default async function PublicAthletePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { handle } = await params;
  const data = await loadPublicAthletePage(handle);

  if (!data) {
    return notFound();
  }

  const displayName = displayNameFor(
    data.athlete.firstName,
    data.athlete.lastName,
    data.athlete.gofastHandle,
  );
  const hasRunPhoto = Boolean(data.gofastWithMe?.gofastWithMePhotoUrl?.trim());

  return (
    <div className="min-h-screen bg-stone-50">
      <ProfileHero
        athleteId={data.athlete.id}
        displayName={displayName}
        handle={data.athlete.gofastHandle}
        photoURL={data.athlete.photoURL}
        hasRunPhoto={hasRunPhoto}
        city={data.athlete.city}
        state={data.athlete.state}
        primarySport={data.athlete.primarySport}
        publicActions={data.publicActions}
      />

      <main className="max-w-5xl mx-auto px-5 sm:px-6 pt-8 pb-16">
        <div className="lg:grid lg:grid-cols-3 lg:gap-10 space-y-10 lg:space-y-0">
          <div className="lg:col-span-2">
            <DoorStoryColumn
              gofastWithMe={data.gofastWithMe}
              profileBio={data.athlete.bio}
            />
          </div>
          <DoorSidebar
            trainingSummary={data.trainingSummary}
            primaryChasingGoal={data.primaryChasingGoal}
            publishedPlans={data.publishedPlans ?? []}
            signedUpRaces={data.signedUpRaces}
            containerMemberCount={data.containerMemberCount}
          />
        </div>

        <div className="mt-12 space-y-8">
          {data.athleteTips.length > 0 ? (
            <AthleteTipsSection
              tips={data.athleteTips}
              hostFirstName={data.athlete.firstName}
            />
          ) : null}

          <AthleteInstagramSection
            media={data.instagramMedia}
            username={data.athlete.instagramUsername || data.athlete.instagram}
          />

          {data.joinableGroupTraining ? (
            <GroupTrainingCard cohort={data.joinableGroupTraining} />
          ) : null}

          <RunWithMe
            athleteId={data.athlete.id}
            firstName={data.athlete.firstName}
            handle={data.athlete.gofastHandle}
            city={data.athlete.city}
            upcomingRuns={data.upcomingRuns}
          />

          {data.isGoFastContainer ? (
            <ProfileContainerSponsorshipSlot
              isGoFastContainer={data.isGoFastContainer}
              activeSponsorship={data.activeSponsorship}
            />
          ) : null}
        </div>

        <footer className="pt-10 text-center">
          <Link
            href="/welcome"
            className="text-xs font-semibold text-stone-500 hover:text-stone-700"
          >
            Powered by GoFast
          </Link>
        </footer>
      </main>
    </div>
  );
}
