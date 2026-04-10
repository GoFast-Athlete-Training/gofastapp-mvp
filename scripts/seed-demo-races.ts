/**
 * Upsert demo rows in race_registry for local/staging browse filters and cards.
 * Run: npx tsx scripts/seed-demo-races.ts
 */
import { prisma } from "../lib/prisma";
import { METERS_PER_MILE } from "../lib/pace-utils";

function milesToMeters(miles: number): number {
  return Math.round(miles * METERS_PER_MILE);
}

const now = new Date();
const y = now.getUTCFullYear();
const nextY = y + 1;

const d = (month0: number, day: number, h = 12, min = 0) =>
  new Date(Date.UTC(nextY, month0, day, h, min, 0));

const demos = [
  {
    id: "demo_seed_boston_marathon",
    name: "Boston Marathon",
    distanceLabel: "Marathon",
    distanceMeters: milesToMeters(26.2),
    raceDate: d(3, 21, 14, 0),
    city: "Boston",
    state: "MA",
    tags: ["boston-qualifier", "major", "road"],
    registrationUrl: "https://example.com/register/boston",
    logoUrl: "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=200&h=200&fit=crop",
    startTime: d(3, 21, 14, 0),
  },
  {
    id: "demo_seed_chicago_marathon",
    name: "Chicago Marathon",
    distanceLabel: "Marathon",
    distanceMeters: milesToMeters(26.2),
    raceDate: d(9, 12, 7, 30),
    city: "Chicago",
    state: "IL",
    tags: ["boston-qualifier", "major", "flat"],
    registrationUrl: "https://example.com/register/chicago",
    logoUrl: "https://images.unsplash.com/photo-1494522358652-f30e61a603d5?w=200&h=200&fit=crop",
    startTime: d(9, 12, 7, 30),
  },
  {
    id: "demo_seed_nyc_marathon",
    name: "TCS New York City Marathon",
    distanceLabel: "Marathon",
    distanceMeters: milesToMeters(26.2),
    raceDate: d(10, 2, 9, 0),
    city: "New York",
    state: "NY",
    tags: ["boston-qualifier", "major"],
    registrationUrl: "https://example.com/register/nyc",
    logoUrl: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=200&h=200&fit=crop",
  },
  {
    id: "demo_seed_austin_half",
    name: "Austin Half Marathon",
    distanceLabel: "Half Marathon",
    distanceMeters: milesToMeters(13.1),
    raceDate: d(1, 15, 15, 0),
    city: "Austin",
    state: "TX",
    tags: ["hilly", "road"],
    registrationUrl: "https://example.com/register/austin-half",
    logoUrl: "https://images.unsplash.com/photo-1530089711124-87ca61435a48?w=200&h=200&fit=crop",
  },
  {
    id: "demo_seed_denver_10k",
    name: "Denver Sunrise 10K",
    distanceLabel: "10K",
    distanceMeters: 10_000,
    raceDate: d(8, 7, 8, 0),
    city: "Denver",
    state: "CO",
    tags: ["altitude", "road"],
    registrationUrl: "https://example.com/register/denver-10k",
  },
  {
    id: "demo_seed_seattle_5k",
    name: "Seattle Waterfront 5K",
    distanceLabel: "5K",
    distanceMeters: 5_000,
    raceDate: d(8, 20, 9, 0),
    city: "Seattle",
    state: "WA",
    tags: ["flat", "family"],
    registrationUrl: "https://example.com/register/seattle-5k",
    logoUrl: "https://images.unsplash.com/photo-1502175353174-a7a70e06776a?w=200&h=200&fit=crop",
  },
  {
    id: "demo_seed_portland_half",
    name: "Portland Autumn Half",
    distanceLabel: "Half Marathon",
    distanceMeters: milesToMeters(13.1),
    raceDate: d(9, 5, 8, 30),
    city: "Portland",
    state: "OR",
    tags: ["trail-mix", "road"],
    registrationUrl: "https://example.com/register/portland-half",
  },
  {
    id: "demo_seed_miami_marathon",
    name: "Miami Marathon",
    distanceLabel: "Marathon",
    distanceMeters: milesToMeters(26.2),
    raceDate: d(0, 26, 6, 0),
    city: "Miami",
    state: "FL",
    tags: ["boston-qualifier", "warm"],
    registrationUrl: "https://example.com/register/miami",
    logoUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop",
  },
  {
    id: "demo_seed_nashville_10m",
    name: "Music City 10 Miler",
    distanceLabel: "10 Mile",
    distanceMeters: milesToMeters(10),
    raceDate: d(3, 6, 7, 0),
    city: "Nashville",
    state: "TN",
    tags: ["road"],
    registrationUrl: "https://example.com/register/nashville-10",
  },
  {
    id: "demo_seed_phoenix_10k",
    name: "Desert Dash 10K",
    distanceLabel: "10K",
    distanceMeters: 10_000,
    raceDate: d(10, 15, 7, 0),
    city: "Phoenix",
    state: "AZ",
    tags: ["warm", "road"],
    registrationUrl: "https://example.com/register/phoenix-10k",
  },
];

async function main() {
  console.log("Seeding demo race_registry rows…");
  for (const row of demos) {
    const slug = row.id.replace(/^demo_seed_/, "");
    await prisma.race_registry.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        name: row.name,
        distanceLabel: row.distanceLabel,
        distanceMeters: row.distanceMeters,
        raceDate: row.raceDate,
        city: row.city,
        state: row.state,
        country: "USA",
        tags: row.tags,
        registrationUrl: row.registrationUrl,
        logoUrl: row.logoUrl ?? null,
        startTime: row.startTime ?? null,
        slug,
        isActive: true,
        isCancelled: false,
        isVirtual: false,
        updatedAt: new Date(),
      },
      update: {
        name: row.name,
        distanceLabel: row.distanceLabel,
        distanceMeters: row.distanceMeters,
        raceDate: row.raceDate,
        city: row.city,
        state: row.state,
        tags: row.tags,
        registrationUrl: row.registrationUrl,
        logoUrl: row.logoUrl ?? null,
        startTime: row.startTime ?? null,
        slug,
        updatedAt: new Date(),
      },
    });
  }
  console.log(`Upserted ${demos.length} demo races.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
