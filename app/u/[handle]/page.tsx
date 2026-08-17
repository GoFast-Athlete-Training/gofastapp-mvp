import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { loadPublicAthletePage } from '@/lib/server/load-public-athlete-page';
import { athletePublicLandingUrl } from '@/lib/gofast-with-me/athlete-community-routes';

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
    return { title: 'Profile not found · GoFast' };
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
    ? `${name}${handleStr} · Chasing ${chasing} on GoFast`
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

/** Legacy in-app door — canonical public landing lives on the runner content host. */
export default async function PublicAthleteRedirectPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { handle } = await params;
  const data = await loadPublicAthletePage(handle);

  if (!data) {
    return notFound();
  }

  redirect(athletePublicLandingUrl(handle));
}
