import { prisma } from '@/lib/prisma';
import { RSVP_ROLE_HOST } from '@/lib/city-run/rsvp-role';

function generateRsvpId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

/** Host junction row — role host (not a fake going join). Status stays going for chatter. */
export async function autoRsvpHostRole(runId: string, athleteId: string): Promise<void> {
  await prisma.city_run_rsvps.upsert({
    where: { runId_athleteId: { runId, athleteId } },
    create: {
      id: generateRsvpId(),
      runId,
      athleteId,
      status: 'going',
      role: RSVP_ROLE_HOST,
    },
    update: {
      role: RSVP_ROLE_HOST,
    },
  });
}

/** @deprecated Use autoRsvpHostRole */
export const autoRsvpHostGoing = autoRsvpHostRole;

export function buildJoinRunSignupUrl(slug: string | null | undefined, baseUrl?: string): string | null {
  if (!slug?.trim()) return null;
  const base =
    baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_CONTENT_PUBLIC_BASE_DOMAIN ||
    'https://gofastapp.com';
  return `${base.replace(/\/$/, '')}/join/run/${encodeURIComponent(slug.trim())}/signup`;
}

/** Map completed hosted runs (host checked in) to a 1–5 star tier. */
export function hostedRunCountToStars(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 7) return 3;
  if (count <= 14) return 4;
  return 5;
}
