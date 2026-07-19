/**
 * Club Manager API surface map.
 *
 * Invite accept (intentional grant — email + club + role seeded before token):
 * - GET  /api/club-manager/invite/resolve?token=   (pre-auth grant preview)
 * - POST /api/me/athlete-link                        (step 1: Firebase → Athlete)
 * - POST /api/me/club-manager-resolve                (step 2: attach membership + role)
 *
 * Legacy aliases (deprecated):
 * - GET  /api/clubowner/invite/resolve
 * - POST /api/me/club-leader-claim/attach
 *
 * Athlete-facing manager writes (requireRunClubLeader — run_club_memberships manager|admin):
 * - GET  /api/me/run-club-leaderships
 * - GET  /api/runclub/[slug]/leader
 * - PATCH /api/runclub/[slug]/leader/club
 * - GET|POST /api/runclub/[slug]/leader/announcements
 * - PATCH|DELETE /api/runclub/[slug]/leader/announcements/[id]
 * - GET|POST /api/runclub/[slug]/leader/events
 * - PATCH|DELETE /api/runclub/[slug]/leader/events/[eventId]
 * - GET /api/runclub/[slug]/leader/runs
 * - PATCH /api/runclub/[slug]/leader/runs/[runId]
 *
 * Staff / Company only:
 * - POST /api/internal/run-club-leader-claims/invite
 * - POST /api/run-clubs/update (prodpush)
 * - POST /api/run-clubs/sync
 */

export {};
