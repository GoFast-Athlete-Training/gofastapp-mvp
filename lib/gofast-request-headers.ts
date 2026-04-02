/**
 * Browser API client sends this on each request (see lib/api.ts).
 * Server reads it with requireAthleteFromBearer (lib/training/require-athlete.ts).
 */
export const ATHLETE_ID_HEADER = "x-athlete-id";
