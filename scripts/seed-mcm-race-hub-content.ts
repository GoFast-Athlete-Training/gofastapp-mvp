/**
 * Seed Marine Corps Marathon race hub welcome content on prod (announcement + shakeout).
 *
 * Usage (from gofastapp-mvp root):
 *   node scripts/with-env-local.mjs npx tsx scripts/seed-mcm-race-hub-content.ts
 *
 * Idempotent: skips when matching title / shakeout already exists for the registry.
 */
import { resolveCityRunType } from "../lib/city-run-type";
import { inferRegionSlugFromCitySlug } from "../lib/region-slug";
import { prisma } from "../lib/prisma";
import {
  citySlugFromRegistry,
  generateCityRunId,
  utcTo12h,
} from "../lib/race-hub-shakeout-utils";
import { resolveActiveRaceByCompanyRaceId } from "../lib/race-hub-internal-company";

const COMPANY_RACE_ID = "cmomycd2z0000l504nzfqyu8g";
const FALLBACK_STAFF_ID = "cmqpz9yqf0001i804hldtj0cz";

const WELCOME_TITLE = "Welcome to the MCM hub";
const SHAKEOUT_TITLE = "Marine Corps Marathon shakeout";

async function resolveStaffId(): Promise<string> {
  const fromEnv = process.env.GOFAST_SEED_STAFF_ID?.trim();
  if (fromEnv) return fromEnv;
  const existing = await prisma.city_runs.findFirst({
    where: { staffGeneratedId: { not: null } },
    select: { staffGeneratedId: true },
  });
  return existing?.staffGeneratedId?.trim() || FALLBACK_STAFF_ID;
}

async function seedAnnouncement(raceId: string, staffGeneratedId: string) {
  const existing = await prisma.race_announcements.findFirst({
    where: { raceId, title: WELCOME_TITLE, archivedAt: null },
    select: { id: true },
  });
  if (existing) {
    console.log(`Announcement already exists: ${existing.id}`);
    return existing.id;
  }

  const row = await prisma.race_announcements.create({
    data: {
      raceId,
      staffGeneratedId,
      title: WELCOME_TITLE,
      content:
        "You are in the GoFast hub for Marine Corps Marathon. Check shakeouts, race-day updates, and chatter with runners training for The People's Marathon. Add your goal in My Races and say hi in the feed.",
    },
  });
  console.log(`Created announcement: ${row.id}`);
  return row.id;
}

async function seedShakeout(
  race: NonNullable<Awaited<ReturnType<typeof resolveActiveRaceByCompanyRaceId>>>,
  staffGeneratedId: string,
) {
  const existing = await prisma.city_runs.findFirst({
    where: { raceRegistryId: race.id, title: SHAKEOUT_TITLE },
    select: { id: true },
  });
  if (existing) {
    console.log(`Shakeout already exists: ${existing.id}`);
    return existing.id;
  }

  const runAt = new Date(race.raceDate);
  runAt.setUTCDate(runAt.getUTCDate() - 1);
  runAt.setUTCHours(14, 0, 0, 0); // 10:00 AM Eastern (approx) on shakeout day

  const citySlug = citySlugFromRegistry(race.city, race.slug);
  const { hour, minute, period } = utcTo12h(runAt);
  const id = generateCityRunId();
  const meetUpPoint = "National Mall area — details in hub RSVP";

  const run = await prisma.city_runs.create({
    data: {
      id,
      title: SHAKEOUT_TITLE,
      date: runAt,
      meetUpPoint,
      description:
        "Easy shakeout run the day before MCM. RSVP here so we know who is coming.",
      totalMiles: 3,
      pace: "Easy / conversational",
      startTimeHour: hour,
      startTimeMinute: minute,
      startTimePeriod: period,
      citySlug,
      regionSlug: inferRegionSlugFromCitySlug(citySlug),
      raceRegistryId: race.id,
      staffGeneratedId,
      workflowStatus: "DEVELOP",
      published: true,
      cityRunType: resolveCityRunType({
        runClubId: null,
        shakeoutDedupeKey: null,
        raceRegistryId: race.id,
      }),
      updatedAt: new Date(),
    },
  });
  console.log(`Created shakeout city_run: ${run.id} (${run.date.toISOString()})`);
  return run.id;
}

async function main() {
  const race = await resolveActiveRaceByCompanyRaceId(COMPANY_RACE_ID);
  if (!race) {
    throw new Error(`No active race_registry for companyRaceId ${COMPANY_RACE_ID}`);
  }

  console.log(`Registry ${race.id} slug=${race.slug}`);

  const staffGeneratedId = await resolveStaffId();
  await seedAnnouncement(race.id, staffGeneratedId);
  await seedShakeout(race, staffGeneratedId);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
