import { redirect } from 'next/navigation';
import { clubManagerActivatePath, clubManagerHubPath } from '@/lib/club-manager-paths';

export default async function LegacyClubOwnerEntryRedirect({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  redirect(token ? clubManagerActivatePath(token) : clubManagerHubPath());
}
