/**
 * Run club leader API surface map.
 *
 * Athlete-facing (requireRunClubLeader — run_club_memberships owner|admin):
 * - GET  /api/me/run-club-leaderships
 * - GET  /api/runclub/[slug]/leader
 * - PATCH /api/runclub/[slug]/leader/club
 * - GET|POST /api/runclub/[slug]/leader/announcements
 * - PATCH|DELETE /api/runclub/[slug]/leader/announcements/[id]
 * - GET|POST /api/runclub/[slug]/leader/events
 * - PATCH|DELETE /api/runclub/[slug]/leader/events/[eventId]
 * - GET /api/runclub/[slug]/leader/runs
 * - PATCH /api/runclub/[slug]/leader/runs/[runId]
 * - PUT /api/run-clubs/[id] (when x-athlete-id present → leader-scoped patch)
 *
 * Staff / Company only (no athlete session; internal sync & workflow):
 * - POST /api/run-clubs/update (prodpush)
 * - POST /api/run-clubs/sync
 * - POST /api/run-series/create
 * - POST /api/runs/create
 * - PATCH workflow → APPROVED on /api/runs/manage/[runId]/approve
 * - PUT /api/run-clubs/[id] without x-athlete-id (staff bearer)
 */

export {};
