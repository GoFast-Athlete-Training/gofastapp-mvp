/**
 * Club Manager API surface map. See docs/CLUB_MANAGER_FORKS.md for fork boundaries.
 *
 * Staff-assign entry (authority = run_club_memberships):
 * - GET  /api/athlete/[id]  (leaderContext + clubManagerState)
 * - POST /api/me/club-manager-welcome  (first-ack only — not membership write)
 *
 * Invite-new voucher path (stashed — only when no membership yet):
 * - GET  /api/club-manager/invite/resolve?token=
 * - POST /api/me/club-manager-resolve  (writes membership from run_club_leader_claims)
 * Athlete-facing manager writes (requireRunClubLeader — run_club_memberships manager|admin):
 * - GET  /api/me/run-club-leaderships
 * - GET  /api/runclub/[slug]/leader
 * - PATCH /api/runclub/[slug]/leader/club
 * - GET|POST /api/runclub/[slug]/leader/announcements
 * - PATCH|DELETE /api/runclub/[slug]/leader/announcements/[id]
 * - GET|POST /api/runclub/[slug]/leader/events
 * - PATCH|DELETE /api/runclub/[slug]/leader/events/[eventId]
 * - GET /api/runclub/[slug]/leader/runs
 * - PATCH /api/runclub/[slug]/leader/runs/[runId]  (manager self-publish APPROVED + published)
 *
 * Staff / Company only:
 * - POST /api/internal/run-club-leader-claims/invite
 * - POST /api/run-clubs/update (prodpush)
 * - POST /api/run-clubs/sync
 */

export {};
