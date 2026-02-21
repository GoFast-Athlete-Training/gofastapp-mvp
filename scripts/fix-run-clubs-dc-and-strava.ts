/**
 * Fix run_clubs rows with websiteUrl "D.C." or stravaUrl containing Instagram.
 * Re-fetches from GoFastCompany by-slug API and updates with normalized values.
 *
 * Requires: GOFAST_COMPANY_API_URL or NEXT_PUBLIC_GOFAST_COMPANY_API_URL
 * Usage: npx tsx scripts/fix-run-clubs-dc-and-strava.ts
 */

import { prisma } from "../lib/prisma";
import { normalizeWebsiteUrl, normalizeStravaUrl } from "../lib/runclub-urls";

const GOFAST_COMPANY_API_URL =
  process.env.GOFAST_COMPANY_API_URL ||
  process.env.NEXT_PUBLIC_GOFAST_COMPANY_API_URL;

async function main() {
  const badWebsite = await prisma.run_clubs.findMany({
    where: { websiteUrl: "D.C." },
    select: { id: true, slug: true, name: true, websiteUrl: true, stravaUrl: true },
  });
  const badStrava = await prisma.run_clubs.findMany({
    where: {
      stravaUrl: { contains: "instagram", mode: "insensitive" },
    },
    select: { id: true, slug: true, name: true, websiteUrl: true, stravaUrl: true },
  });
  const byId = new Map(badWebsite.map((r) => [r.id, r]));
  badStrava.forEach((r) => byId.set(r.id, r));
  const toFix = Array.from(byId.values());
  if (toFix.length === 0) {
    console.log("No run_clubs rows with websiteUrl 'D.C.' or Instagram in stravaUrl.");
    return;
  }

  console.log(`Found ${toFix.length} run_clubs to fix.\n`);

  if (!GOFAST_COMPANY_API_URL) {
    console.warn("GOFAST_COMPANY_API_URL not set. Setting bad values to null only.");
    for (const r of toFix) {
      await prisma.run_clubs.update({
        where: { id: r.id },
        data: {
          ...(r.websiteUrl === "D.C." ? { websiteUrl: null } : {}),
          ...(r.stravaUrl?.toLowerCase().includes("instagram") ? { stravaUrl: null } : {}),
        },
      });
      console.log(`  ${r.name} (${r.slug}): bad fields set to null`);
    }
    console.log("\nDone. Run again with GOFAST_COMPANY_API_URL set to backfill from acq_run_clubs.");
    return;
  }

  const base = GOFAST_COMPANY_API_URL.replace(/\/$/, "");

  for (const r of toFix) {
    let websiteUrl: string | null = null;
    let stravaUrl: string | null = null;
    try {
      const res = await fetch(`${base}/api/runclub-public/by-slug/${encodeURIComponent(r.slug)}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        console.warn(`  ${r.name} (${r.slug}): by-slug returned ${res.status}, setting bad fields to null`);
        websiteUrl = r.websiteUrl === "D.C." ? null : r.websiteUrl;
        stravaUrl = r.stravaUrl?.toLowerCase().includes("instagram") ? null : r.stravaUrl ?? null;
      } else {
        const data = await res.json();
        const club = data.runClub;
        if (club) {
          websiteUrl = normalizeWebsiteUrl(club.websiteUrl, club.url);
          stravaUrl = normalizeStravaUrl(club.stravaUrl, club.stravaClubUrl);
        } else {
          websiteUrl = r.websiteUrl === "D.C." ? null : r.websiteUrl;
          stravaUrl = r.stravaUrl?.toLowerCase().includes("instagram") ? null : r.stravaUrl ?? null;
        }
      }
    } catch (e) {
      console.warn(`  ${r.name} (${r.slug}): fetch failed`, (e as Error).message);
      websiteUrl = r.websiteUrl === "D.C." ? null : r.websiteUrl;
      stravaUrl = r.stravaUrl?.toLowerCase().includes("instagram") ? null : r.stravaUrl ?? null;
    }

    await prisma.run_clubs.update({
      where: { id: r.id },
      data: {
        websiteUrl: websiteUrl ?? (r.websiteUrl === "D.C." ? null : r.websiteUrl),
        stravaUrl: stravaUrl ?? (r.stravaUrl?.toLowerCase().includes("instagram") ? null : r.stravaUrl),
      },
    });
    console.log(`  ${r.name} (${r.slug}): websiteUrl=${websiteUrl ?? "null"}, stravaUrl=${stravaUrl ?? "null"}`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
