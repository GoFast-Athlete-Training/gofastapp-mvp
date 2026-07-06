import { redirect } from 'next/navigation';
import { clubManagerActivatePath } from '@/lib/club-manager-paths';

export default async function LegacyClubOwnerInviteRedirect({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  redirect(clubManagerActivatePath(token));
}
