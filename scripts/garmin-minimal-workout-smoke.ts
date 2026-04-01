/**
 * POST a minimal workout to Garmin Training API using DB tokens for an athlete.
 * Isolates auth / entitlement vs full workout assembly issues.
 *
 * Usage:
 *   DATABASE_URL=... GARMIN_CLIENT_ID=... GARMIN_CLIENT_SECRET=... \
 *     npx tsx scripts/garmin-minimal-workout-smoke.ts <athleteId>
 *
 * Optional: copy .env.local into the shell or export vars manually.
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { prisma } from "../lib/prisma";
import { createGarminTrainingApiForAthlete } from "../lib/garmin-workouts/garmin-training-api";
import { minimalSmokeGarminWorkout } from "../lib/garmin-workouts/minimal-smoke-workout";
import { summarizeGarminTokenForLogs } from "../lib/garmin-access-token-claims";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  const athleteId = process.argv[2];
  if (!athleteId) {
    console.error("Usage: npx tsx scripts/garmin-minimal-workout-smoke.ts <athleteId>");
    process.exit(1);
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, garmin_access_token: true },
  });

  const token = athlete?.garmin_access_token?.trim();
  if (!token) {
    console.error("No garmin_access_token for athlete — connect Garmin in the app first.");
    process.exit(1);
  }

  console.log("Token summary:", JSON.stringify(summarizeGarminTokenForLogs(token), null, 2));

  const client = createGarminTrainingApiForAthlete(athleteId, token);
  const workout = minimalSmokeGarminWorkout();

  try {
    const result = await client.createWorkout(workout);
    console.log("OK — Garmin workoutId:", result.workoutId);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "status" in e && "details" in e) {
      const err = e as { status: number; details: string; rawBody?: string };
      console.error("Garmin error:", err.status, err.details);
      if (err.rawBody) console.error("Raw body:", err.rawBody);
    } else {
      console.error(e);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
