/**
 * Browser API client sends this on each request (see lib/api.ts).
 * Server reads it with requireAthleteFromBearer (lib/training/require-athlete.ts).
 */
export const ATHLETE_ID_HEADER = "x-athlete-id";

/** Client-only: skip auto GET /athlete/me bootstrap on this request (avoid recursion). */
export const SKIP_ATHLETE_BOOTSTRAP_HEADER = "x-gofast-skip-athlete-bootstrap";
