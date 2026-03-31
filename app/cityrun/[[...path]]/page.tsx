import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * /cityrun/{runSlug} or /cityrun/{clubSlug}/{runSlug} — resolve slug URL → in-app run.
 */
export default async function CityRunSlugRedirectPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path: segments } = await params;
  if (!segments?.length) notFound();

  if (segments.length === 1) {
    const runSlug = segments[0]?.trim();
    if (!runSlug) notFound();
    const run = await prisma.city_runs.findFirst({
      where: { slug: runSlug },
      select: { id: true },
    });
    if (!run) notFound();
    redirect(`/gorun/${run.id}`);
  }

  if (segments.length === 2) {
    const clubSlug = segments[0]?.trim();
    const runSlug = segments[1]?.trim();
    if (!clubSlug || !runSlug) notFound();

    const club = await prisma.run_clubs.findUnique({
      where: { slug: clubSlug },
      select: { id: true },
    });
    if (!club) notFound();

    const run = await prisma.city_runs.findFirst({
      where: { slug: runSlug, runClubId: club.id },
      select: { id: true },
    });
    if (!run) notFound();
    redirect(`/gorun/${run.id}`);
  }

  notFound();
}
