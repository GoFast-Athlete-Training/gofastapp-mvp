import {
  listAthleteHostedRunInvites,
  type AthleteHostedRunInvite,
} from "@/lib/city-run/list-athlete-hosted-invites";

/** @deprecated Use AthleteHostedRunInvite — kept for link-tree imports. */
export type AthleteHostedRunLinkOption = AthleteHostedRunInvite;

/** Hosted run invites for link-tree checkboxes (same list as Build a Run). */
export async function listUpcomingHostedRunsForLinks(
  athleteId: string,
): Promise<AthleteHostedRunLinkOption[]> {
  return listAthleteHostedRunInvites(athleteId, { limit: 50 });
}
