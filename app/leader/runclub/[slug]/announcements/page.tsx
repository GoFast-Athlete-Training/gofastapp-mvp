import { redirect } from 'next/navigation';
import { clubManagerClubPath } from '@/lib/club-manager-paths';

export default async function LegacyLeaderAnnouncementsRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(clubManagerClubPath(slug, 'announcements'));
}
