import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadPublicAthletePage } from '@/lib/server/load-public-athlete-page';
import ProfileHero from './_components/ProfileHero';
import GoalRaceCard from './_components/GoalRaceCard';
import LastRunCard from './_components/LastRunCard';
import RunWithMe from './_components/RunWithMe';
import AboutStrip from './_components/AboutStrip';

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

  const descParts: string[] = [];
  if (data.athlete.bio?.trim()) descParts.push(data.athlete.bio.trim().slice(0, 140));
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

  return (
    <div className="min-h-screen bg-stone-50">
      <ProfileHero
        athleteId={data.athlete.id}
        displayName={displayName}
        handle={data.athlete.gofastHandle}
        photoURL={data.athlete.photoURL}
        myBestRunPhotoURL={data.athlete.myBestRunPhotoURL}
        city={data.athlete.city}
        state={data.athlete.state}
        primarySport={data.athlete.primarySport}
        fiveKPace={data.athlete.fiveKPace}
        weeklyMileage={data.athlete.weeklyMileage}
      />

      <main className="max-w-2xl mx-auto px-5 sm:px-6 pt-8 pb-16 space-y-8">
        <GoalRaceCard
          trainingSummary={data.trainingSummary}
          primaryChasingGoal={data.primaryChasingGoal}
        />

        <LastRunCard
          lastRun={data.lastRun}
          weeklyMilesThisWeek={data.weeklyMilesThisWeek}
        />

        <RunWithMe
          athleteId={data.athlete.id}
          firstName={data.athlete.firstName}
          handle={data.athlete.gofastHandle}
          city={data.athlete.city}
          upcomingRuns={data.upcomingRuns}
        />

        <AboutStrip
          bio={data.athlete.bio}
          signedUpRaces={data.signedUpRaces}
          isGoFastContainer={data.isGoFastContainer}
          containerMemberCount={data.containerMemberCount}
          containerRecentMembers={data.containerRecentMembers}
          hostHandle={data.athlete.gofastHandle}
        />

        <footer className="pt-4 text-center">
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

